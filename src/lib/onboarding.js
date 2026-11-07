// src/lib/onboarding.js
// ─────────────────────────────────────────────────────────────────────────────
// First-login onboarding (backend PR 59 — api-handoff "first-login onboarding" 2026-10-23)
//
//   GET  /personnel/me/onboarding                    status + prefill of the 8 sections
//   PUT  /personnel/me/onboarding/{section}          save (writes live, returns the payload)
//   POST /personnel/me/onboarding/{section}/confirm  mark done (422 { detail: { section, missing } })
//   POST /personnel/me/onboarding/tour-complete      idempotent
//   POST /personnel/me/onboarding/complete           422 { detail: { sections, tour } }
//
// Out of scope (login-only accounts, Super Admin) → 404 → status "out_of_scope": never gated.
// Same store pattern as myPermissions.js: in-memory, bound to the token that loaded it.
//
// The front-end gate: AppLayout keeps everyone with `gate === "pending"` on /onboarding. The last
// real answer is cached per user (localStorage onboarding_gate:<user>) so a reload or a server
// outage cannot open the app to someone who has not finished. The backend's own gate
// (403 detail.code === "ONBOARDING_REQUIRED", detected in api.js and dispatched as
// ONBOARDING_REQUIRED_EVENT) stays as the backstop.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"
import { apiAuth } from "./api"
import { getToken, getUserKey } from "./auth"
import { isPreviewActive } from "./previewMode"

const BASE = "/personnel/me/onboarding"
const READ_TIMEOUT_MS = 20_000
const WRITE_TIMEOUT_MS = 30_000
const RETRY_BASE_MS = 3_000
const RETRY_MAX_MS = 30_000
const CONNECTION_LOAD_MESSAGE = "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ระบบจะลองใหม่ให้เอง ข้อมูลที่กรอกค้างไว้ยังอยู่"

/** No usable answer from the server: nothing the person typed can be at fault. */
export const isConnectionError = (err) => {
  const s = err?.status
  return s === 0 || s === 408 || s === 429 || s >= 500
}

/** Section keys in backend order + display data. Icons live in the page (no React here). */
export const SECTIONS = [
  { key: "account", label: "ชื่อและอีเมล", short: "ชื่อ", purpose: "ชื่อ-นามสกุลที่ใช้ในเอกสารและสลิปเงินเดือน" },
  { key: "personal", label: "ข้อมูลส่วนตัว", short: "ส่วนตัว", purpose: "วันเกิด สถานภาพ เบอร์โทร และบัญชีรับเงินเดือน" },
  { key: "address", label: "ที่อยู่ตามทะเบียนบ้าน", short: "ที่อยู่", purpose: "ใช้ส่งเอกสารและติดต่อในกรณีจำเป็น" },
  { key: "family", label: "ครอบครัว", short: "ครอบครัว", purpose: "บิดา มารดา คู่สมรส และบุตร ใช้คำนวณสวัสดิการ" },
  { key: "education", label: "การศึกษา", short: "การศึกษา", purpose: "วุฒิการศึกษาอย่างน้อย 1 รายการ" },
  { key: "work", label: "ประวัติการทำงาน", short: "การทำงาน", purpose: "ที่ทำงานก่อนหน้า หรือเลือก “ไม่มีประวัติ”" },
  { key: "criminal", label: "ประวัติคดีความ", short: "คดีความ", purpose: "ระบุตามจริง หรือเลือก “ไม่มีประวัติ”" },
  // section 8 (api-handoff licenses): stays editable after completion — PUT works, others 409
  { key: "license", label: "ใบขับขี่", short: "ใบขับขี่", purpose: "ใบขับขี่ทุกใบที่มี หรือเลือก “ไม่มีใบขับขี่”" },
]
export const SECTION_KEYS = SECTIONS.map((s) => s.key)
export const sectionMeta = (key) => SECTIONS.find((s) => s.key === key)

/** Thai labels for the field names that come back in `missing` / validation. */
export const FIELD_LABELS = {
  first_name: "ชื่อ (ภาษาอังกฤษ)",
  last_name: "นามสกุล (ภาษาอังกฤษ)",
  th_first_name: "คำนำหน้าและชื่อ (ภาษาไทย)",
  th_last_name: "นามสกุล (ภาษาไทย)",
  email: "อีเมล",
  birthday: "วันเกิด",
  gender: "เพศ",
  m_status: "สถานภาพสมรส",
  p_number: "เบอร์โทรศัพท์",
  line_id: "LINE ID",
  e_contact: "เบอร์ติดต่อฉุกเฉิน",
  children_number: "จำนวนบุตร",
  bank_no: "เลขบัญชีธนาคาร",
  guarantee_bank_no: "เลขบัญชีค้ำประกัน",
  underlying_disease: "โรคประจำตัว",
  cid: "เลขบัตรประชาชน",
  hired: "วันเริ่มงาน",
  h_address: "บ้านเลขที่",
  mhoo: "หมู่",
  soi: "ซอย",
  road: "ถนน",
  sub_district: "ตำบล/แขวง",
  district: "อำเภอ/เขต",
  province: "จังหวัด",
  postal_code: "รหัสไปรษณีย์",
  ed_level: "ระดับการศึกษา",
  inst_name: "ชื่อสถาบัน",
  company_name: "ชื่อที่ทำงาน",
  position: "ตำแหน่ง",
  charge: "ข้อหา",
  court: "ศาล",
  case_date: "วันที่",
  outcome: "ผลคดี",
  relationship: "ความสัมพันธ์",
  name_title: "คำนำหน้า",
  legal_status: "สถานะทางกฎหมาย",
  deceased_date: "วันที่เสียชีวิต",
  license_type: "ประเภทใบขับขี่",
  license_no: "เลขที่ใบขับขี่",
  expiry_date: "วันหมดอายุ",
  from_date: "ตั้งแต่",
  to_date: "ถึง",
}

/** `missing` codes that are not field names. */
export const MISSING_MESSAGES = {
  spouse_row: "ระบุคู่สมรสอย่างน้อย 1 คน (สถานภาพเป็น “สมรส”)",
  children_count: "จำนวนบุตรที่กรอกต้องเท่ากับจำนวนบุตรที่ระบุในข้อมูลส่วนตัว",
  rows: "เพิ่มอย่างน้อย 1 รายการ",
  ex_spouse_row: "ระบุอดีตคู่สมรสอย่างน้อย 1 คน (สถานภาพเป็น “หย่า”)",
  family_details: "ระบุคำนำหน้าและสถานะทางกฎหมายของสมาชิกที่เพิ่มเอง",
}
export const missingLabel = (code) => MISSING_MESSAGES[code] ?? FIELD_LABELS[code] ?? code

export const RELATIONSHIPS = ["บิดา", "มารดา", "คู่สมรส", "อดีตคู่สมรส", "บุตร"]
/** Allowed legal_status per relationship — any other pairing is 422 on the backend. */
export const LEGAL_STATUS_BY_RELATIONSHIP = {
  บิดา: ["บิดาชอบด้วยกฎหมาย", "บิดาไม่ชอบด้วยกฎหมาย", "บิดาบุญธรรม"],
  มารดา: ["มารดาชอบด้วยกฎหมาย", "มารดาบุญธรรม"],
  คู่สมรส: ["จดทะเบียนสมรส", "ไม่ได้จดทะเบียนสมรส"],
  อดีตคู่สมรส: ["จดทะเบียนหย่า", "แยกกันโดยไม่ได้จดทะเบียนหย่า"],
  บุตร: ["บุตรชอบด้วยกฎหมาย", "บุตรบุญธรรม", "บุตรนอกสมรส"],
}
export const legalStatusOptions = (relationship) => LEGAL_STATUS_BY_RELATIONSHIP[relationship] ?? []
/** Family name titles (sent apart from first_name). Children may use เด็กชาย/เด็กหญิง. */
export const FAMILY_TITLES = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง"]
// children: child titles first (most are minors); adult titles stay for grown-up children
export const familyTitleOptions = (relationship) =>
  relationship === "บุตร"
    ? ["เด็กชาย", "เด็กหญิง", "นาย", "นาง", "นางสาว"]
    : FAMILY_TITLES.filter((t) => !t.startsWith("เด็ก"))
/** "นาง สมศรี ใจดี" — prefers backend display_name; the title is joined without a space. */
export const familyDisplayName = (r) =>
  r?.display_name || [`${r?.name_title ?? ""}${r?.first_name ?? ""}`, r?.last_name].filter(Boolean).join(" ") || ""

/** DLT driver's license types, grouped. The two …ตลอดชีพ types never have an expiry date. */
export const LICENSE_TYPE_GROUPS = [
  ["รถยนต์", ["รถยนต์ส่วนบุคคลชั่วคราว", "รถยนต์ส่วนบุคคล", "รถยนต์ส่วนบุคคลตลอดชีพ", "รถยนต์สาธารณะ"]],
  ["รถจักรยานยนต์", ["รถจักรยานยนต์ส่วนบุคคลชั่วคราว", "รถจักรยานยนต์ส่วนบุคคล", "รถจักรยานยนต์ส่วนบุคคลตลอดชีพ", "รถจักรยานยนต์สาธารณะ"]],
  ["รถสามล้อ", ["รถสามล้อส่วนบุคคล", "รถสามล้อสาธารณะ"]],
  ["พ.ร.บ.การขนส่งทางบก", ["ท.1", "ท.2", "ท.3", "ท.4"]],
]
export const LICENSE_TYPE_OPTIONS = LICENSE_TYPE_GROUPS.flatMap(([group, types]) =>
  types.map((t) => ({ value: t, label: t, sublabel: group })),
)
export const isLifetimeLicense = (type) => typeof type === "string" && type.endsWith("ตลอดชีพ")
export const GENDERS = ["ชาย", "หญิง"]
export const NONE_SECTIONS = ["work", "criminal", "license"]
/** Read-only in onboarding — changed only through a 3F request (category personal_info). */
export const READ_ONLY_PERSONAL = ["cid", "hired"]

// ─── store ───────────────────────────────────────────────────────────────────
/** @type {{ token: string|null, status: "idle"|"loading"|"ready"|"out_of_scope"|"error", data: object|null, error?: string }} */
let state = { token: null, status: "idle", data: null }
let version = 0
let inflight = null
let writeSeq = 0
const listeners = new Set()

function setState(next) {
  state = next
  version += 1
  listeners.forEach((fn) => fn())
}

function current() {
  const token = getToken()
  if (!token || state.token !== token) return { token, status: "idle", data: null }
  return state
}

// ─── gate status (per user, survives logout and reload) ──────────────────────
const gateKey = () => {
  const id = getUserKey()
  return id ? `onboarding_gate:${id}` : null
}

function writeGate(value) {
  if (isPreviewActive()) return
  const key = gateKey()
  if (!key) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage disabled: the live status still gates this page view
  }
}

/** The last real answer for this user on this device: "pending" | "done" | null. */
export function readOnboardingGate() {
  const key = gateKey()
  if (!key) return null
  try {
    const v = localStorage.getItem(key)
    return v === "pending" || v === "done" ? v : null
  } catch {
    return null
  }
}

// ─── silent retry while the first load cannot reach the server ───────────────
const retry = { token: null, attempt: 0, timer: null, listening: false }

function fireRetry() {
  clearTimeout(retry.timer)
  retry.timer = null
  if (getToken() !== retry.token) return clearRetry()
  loadOnboarding({ force: true, silent: true })
}

function clearRetry() {
  clearTimeout(retry.timer)
  retry.timer = null
  retry.token = null
  retry.attempt = 0
  if (retry.listening) {
    window.removeEventListener("online", fireRetry)
    retry.listening = false
  }
}

function scheduleRetry(token) {
  if (retry.token !== token) {
    clearRetry()
    retry.token = token
  }
  clearTimeout(retry.timer)
  retry.timer = setTimeout(fireRetry, Math.min(RETRY_BASE_MS * 2 ** retry.attempt, RETRY_MAX_MS))
  retry.attempt += 1
  if (!retry.listening) {
    window.addEventListener("online", fireRetry)
    retry.listening = true
  }
}

/** Replace the cached payload (every PUT/confirm/complete returns the full payload). */
function accept(data) {
  const token = getToken()
  if (data && typeof data === "object" && data.sections) {
    clearRetry()
    writeGate(data.onboarded ? "done" : "pending")
    setState({ token, status: "ready", data })
  }
  return data
}

/** A write's answer is newer than any GET still on the way (see loadOnboarding). */
function acceptWrite(data) {
  writeSeq += 1
  return accept(data)
}

export function getOnboardingState() {
  return current()
}

/** `silent` = background retry: no "loading" flip, so nothing on screen flickers. */
export function loadOnboarding({ force = false, silent = false } = {}) {
  const token = getToken()
  if (!token) {
    clearRetry()
    if (state.token) setState({ token: null, status: "idle", data: null })
    return Promise.resolve(null)
  }
  const s = current()
  if (!force && (s.status === "ready" || s.status === "out_of_scope")) return Promise.resolve(s.data)
  const showLoading = !silent && s.status !== "ready"
  if (inflight && inflight.token === token) {
    if (showLoading && s.status !== "loading") setState({ token, status: "loading", data: null })
    return inflight.promise
  }

  if (showLoading) setState({ token, status: "loading", data: null })
  const seqAtStart = writeSeq
  const hasGoodData = () => state.token === token && state.status === "ready"
  const promise = apiAuth(BASE, { timeoutMs: READ_TIMEOUT_MS })
    .then((d) => {
      if (getToken() !== token) return null
      clearRetry()
      if (writeSeq !== seqAtStart) return current().data // a write landed meanwhile: this answer is older
      if (d && typeof d === "object" && d.sections) return accept(d)
      if (hasGoodData()) return state.data
      setState({ token, status: "error", data: null, error: "ข้อมูลที่ได้รับจากระบบไม่ครบ กรุณาลองใหม่" })
      return null
    })
    .catch((err) => {
      if (getToken() !== token) return null
      if (err?.status === 404) {
        clearRetry()
        writeGate("done")
        setState({ token, status: "out_of_scope", data: null })
        return null
      }
      if (hasGoodData()) return null // keep the last good payload
      const connection = isConnectionError(err)
      if (connection) scheduleRetry(token)
      const error = connection ? CONNECTION_LOAD_MESSAGE : err?.message
      if (!(silent && state.token === token && state.status === "error" && state.error === error)) {
        setState({ token, status: "error", data: null, error })
      }
      return null
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { token, promise }
  return promise
}

// The wizard preview (pages/admin/OnboardingWizardPreview.jsx) answers these from its own memory.
let previewWrites = null // { save(key, body), confirm(key) } → Promise<payload>
export const setOnboardingPreviewWrites = (writes) => {
  previewWrites = writes
}

export const saveSection = (key, body) =>
  previewWrites
    ? previewWrites.save(key, body)
    : apiAuth(`${BASE}/${key}`, { method: "PUT", body, timeoutMs: WRITE_TIMEOUT_MS }).then(acceptWrite)
export const confirmSection = (key) =>
  previewWrites
    ? previewWrites.confirm(key)
    : apiAuth(`${BASE}/${key}/confirm`, { method: "POST", timeoutMs: WRITE_TIMEOUT_MS }).then(acceptWrite)
export const tourComplete = () =>
  apiAuth(`${BASE}/tour-complete`, { method: "POST", timeoutMs: WRITE_TIMEOUT_MS }).then(acceptWrite)
export const completeOnboarding = () =>
  apiAuth(`${BASE}/complete`, { method: "POST", timeoutMs: WRITE_TIMEOUT_MS }).then(acceptWrite)

// ─── row writes whose response may have been lost ────────────────────────────
// Adding a row is not idempotent: if the server saved it but the answer never arrived, a retry
// makes a duplicate. So after a connection error (and before re-sending a write we could not
// verify, which is the usual case when the signal is gone) read the list back and check.
const uncertainWrites = new Map() // section key → { sig, before }

const canVerify = (body) =>
  (body?.rows ?? []).some((r) => r?.id == null) ||
  Boolean(body?.delete_ids?.length) ||
  (typeof body?.none === "boolean" && !body?.rows?.length)

function rowIdsOf(key) {
  const rows = current().data?.values?.[key]
  return Array.isArray(rows) ? new Set(rows.map((r) => r.id)) : null
}

/** The fresh payload when the server already holds this write, otherwise null. */
async function readBackWrite(key, body, before) {
  const added = (body.rows ?? []).filter((r) => r?.id == null).length
  if (added > 0 && !before) return null
  let fresh
  try {
    fresh = await apiAuth(BASE, { timeoutMs: READ_TIMEOUT_MS })
  } catch {
    return null
  }
  const rows = fresh?.values?.[key]
  if (!fresh?.sections || !Array.isArray(rows)) return null
  const ids = rows.map((r) => r.id)
  let applied
  if (added > 0) applied = ids.filter((id) => !before.has(id)).length >= added
  else if (body.delete_ids?.length) applied = body.delete_ids.every((id) => !ids.includes(id))
  else applied = Boolean(fresh.none_flags?.[key]) === body.none
  return applied ? acceptWrite(fresh) : null
}

/** saveSection for list sections: a retry after a lost response never adds the row twice. */
export async function saveSectionSafe(key, body) {
  if (previewWrites) return previewWrites.save(key, body)
  const verifiable = canVerify(body)
  const sig = JSON.stringify(body)
  const prior = uncertainWrites.get(key)
  const before = prior?.sig === sig ? prior.before : rowIdsOf(key)
  if (verifiable && prior?.sig === sig) {
    const applied = await readBackWrite(key, body, before)
    if (applied) {
      uncertainWrites.delete(key)
      return applied
    }
  }
  try {
    const payload = await saveSection(key, body)
    uncertainWrites.delete(key)
    return payload
  } catch (err) {
    if (!isConnectionError(err) || !verifiable) {
      uncertainWrites.delete(key)
      throw err
    }
    const applied = await readBackWrite(key, body, before)
    if (applied) {
      uncertainWrites.delete(key)
      return applied
    }
    uncertainWrites.set(key, { sig, before })
    throw err
  }
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const getVersion = () => version

/**
 * Hook. `locked` = self-service menus should show locked (only when we positively know it).
 * `needsOnboarding` = in scope and not completed/exempt (spec §6.1 redirect rule).
 * `gate` = "pending" | "done" | "unknown": the live answer first, then the answer cached on this device.
 */
export function useOnboarding() {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const s = current()
  const data = s.status === "ready" ? s.data : null
  const sections = data?.sections ?? {}
  const confirmedCount = SECTION_KEYS.filter((k) => sections[k]?.confirmed_at).length
  const liveGate = data ? (data.onboarded ? "done" : "pending") : s.status === "out_of_scope" ? "done" : null
  return {
    status: s.status,
    gate: liveGate ?? readOnboardingGate() ?? "unknown",
    error: s.error,
    data,
    sections,
    confirmedCount,
    onboarded: data ? Boolean(data.onboarded) : null,
    unlocked: data ? Boolean(data.unlocked) : null,
    needsOnboarding: Boolean(data && !data.onboarded),
    locked: Boolean(data && !data.unlocked),
    completed: Boolean(data?.completed_at),
    tourDone: Boolean(data?.tour_completed_at),
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
/** First section that is not confirmed (or still missing something). */
export function firstOpenSection(data) {
  const sections = data?.sections ?? {}
  return SECTION_KEYS.find((k) => !sections[k]?.confirmed_at || sections[k]?.missing?.length) ?? null
}

const norm = (v) => (v === "" || v === undefined ? null : typeof v === "string" ? v.trim() || null : v)

/** Only the keys that changed (backend uses exclude_unset). Never sends read-only keys. */
export function diffBody(original = {}, form = {}, allowed = Object.keys(form)) {
  const body = {}
  for (const k of allowed) {
    if (READ_ONLY_PERSONAL.includes(k)) continue
    if (!(k in form)) continue
    const a = norm(original?.[k])
    const b = norm(form[k])
    if (a === b) continue
    // account names: explicit null → 422, so leave the key out instead
    if (b === null && ["first_name", "last_name", "th_first_name", "th_last_name"].includes(k)) continue
    // guarantee_bank_no is cleared with "" (backend contract), not null
    body[k] = b === null && k === "guarantee_bank_no" ? "" : b
  }
  return body
}

/**
 * Read a 422 into `{ missing: string[], message: string }`.
 * confirm: detail = { section, missing }; pydantic: detail = [{ loc, msg }]; string detail = message.
 */
export function readValidation(err) {
  const d = err?.data?.detail
  if (d && !Array.isArray(d) && typeof d === "object" && Array.isArray(d.missing)) {
    return { missing: d.missing, message: "" }
  }
  if (Array.isArray(d)) {
    const missing = []
    const msgs = d.map((x) => {
      const field = Array.isArray(x?.loc) ? [...x.loc].reverse().find((p) => typeof p === "string" && p !== "body") : null
      if (field) missing.push(field)
      return field && FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: ${x.msg}` : x?.msg
    })
    return { missing, message: msgs.filter(Boolean).join(" · ") }
  }
  return { missing: [], message: typeof d === "string" ? d : err?.message || "บันทึกไม่สำเร็จ" }
}

/** 409 after completion = edits go through 3F only. */
export const isLockedForEdits = (err) => err?.status === 409

// ─── session flags (cleared on logout via auth.js) ───────────────────────────
export const TOUR_STATE_KEY = "onboarding_tour"
