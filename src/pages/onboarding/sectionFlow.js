// src/pages/onboarding/sectionFlow.js
// Shared save → confirm flow of one onboarding section (no JSX here: react-refresh rule).
//
//   const flow = useSectionFlow("personal", { onDone, onLocked, onFailed })
//   flow.submit(body)   PUT body (only when it has keys) then POST confirm
//   flow.busy · flow.problem { missing: string[], message } · flow.shake ("a" | "b" | "")
//   flow.clearField(k)  drop k from the 422 problem list once the user edits it
//   flow.fail(problem)  client-side rejection: same summary / shake / focus as a server 422
//
// problem = { missing: string[], message, hints?: { [key]: "inline text" } }.
// Every failure toasts a short summary and focuses the first flagged field
// (`fieldId(key)` → DOM id; unknown keys fall back to `fallbackId`, default the problem panel).
//
// Connection trouble (lib/onboarding isConnectionError: offline, timeout, 5xx, 408, 429) is not a
// failure of what the person typed: problem.kind === "connection", no shake, no red step, no
// raw server text, and the typing stays. A 401 means the page is already leaving for the login
// page, so nothing is shown at all (the draft brings the typing back).
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "../../components/ui"
import { focusFirstError, reportInvalid } from "../../lib/formErrors"
import {
  confirmSection,
  isConnectionError,
  isLockedForEdits,
  missingLabel,
  readValidation,
  saveSection,
} from "../../lib/onboarding"
import { clearDraft, clearEditorDraft, readEditorDraft } from "../../lib/onboardingDraft"

export const blank = (v) => v == null || (typeof v === "string" && !v.trim())

/** id of the step's <ProblemPanel> — focus fallback when no field matches. */
export const PROBLEM_PANEL_ID = "ob-problem"

/** Red border on a plain baseField input once a save rejected it. */
export const invalidInputCls = "!border-red-500 dark:!border-red-400"

export const CONNECTION_TITLE = "ยังบันทึกไม่สำเร็จ"
/** "การเชื่อมต่อขัดข้อง…": `action` = the label of the button that retries. */
export const connectionMessage = (action = "บันทึกและไปต่อ") =>
  `การเชื่อมต่อกับระบบขัดข้อง ข้อมูลที่กรอกยังอยู่ครบ กด “${action}” อีกครั้งเมื่อเน็ตกลับมา`

export const DRAFT_RESTORED_TEXT = "กู้ข้อมูลที่กรอกค้างไว้ให้แล้ว ยังไม่ได้บันทึก"

let connectionToastSeq = 0

/** One connection toast with a retry; gone when the step unmounts so a retry can't fire elsewhere. */
export function useConnectionToast() {
  const idRef = useRef(null)
  const dismiss = useCallback(() => {
    if (idRef.current) toast.dismiss(idRef.current)
    idRef.current = null
  }, [])
  useEffect(() => dismiss, [dismiss])
  const show = useCallback(
    (description, onRetry) => {
      dismiss()
      // a fresh id each time: reusing one would let the previous toast's timer close this one
      connectionToastSeq += 1
      idRef.current = `ob-connection-${connectionToastSeq}`
      toast.error(CONNECTION_TITLE, {
        id: idRef.current,
        description,
        action: onRetry ? { label: "ลองอีกครั้ง", onClick: onRetry } : undefined,
      })
    },
    [dismiss],
  )
  return { show, dismiss }
}

/** Toast + focus for a failed save. `fieldId(k)` → DOM id or null (non-field codes). */
export function reportProblem(problem, fieldId, fallbackId = PROBLEM_PANEL_ID) {
  if (problem?.kind === "connection") {
    reportInvalid({ ids: [], count: 0, title: CONNECTION_TITLE, description: problem.message || connectionMessage(), fallbackId })
    return
  }
  const missing = problem?.missing ?? []
  const ids = missing.map((k) => fieldId?.(k)).filter(Boolean)
  const fieldsOnly = ids.length === missing.length
  reportInvalid({
    ids,
    count: missing.length,
    fallbackId,
    ...(problem?.message
      ? { title: "ข้อมูลไม่ถูกต้อง", description: problem.message }
      : fieldsOnly
        ? {}
        : { title: "ยังกรอกไม่ครบ", description: missing.map(missingLabel).join(" · ") }),
  })
}

/** Inline Thai error for an empty required column: "เลือก…" for pickers, "กรอก…" for text. */
export const requiredHint = (c) =>
  `${["select", "year", "date", "prefixedName"].includes(c.type) ? "เลือก" : "กรอก"}${c.label}`

export function useSectionFlow(key, { onDone, onLocked, onFailed, fieldId, fallbackId } = {}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)
  const [shake, setShake] = useState("")
  const busyRef = useRef(false)
  const resubmitRef = useRef(null)
  const { show: showConnectionToast, dismiss: dismissConnectionToast } = useConnectionToast()

  /** The step's own submit: the toast's retry then re-reads the form instead of re-sending old values. */
  const setResubmit = useCallback((fn) => {
    resubmitRef.current = fn
  }, [])

  const fail = useCallback(
    (v) => {
      setProblem(v)
      setShake((s) => (s === "a" ? "b" : "a"))
      reportProblem(v, fieldId, fallbackId)
      onFailed?.(key, v)
    },
    [key, onFailed, fieldId, fallbackId],
  )

  const submit = useCallback(
    async function run(body) {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setProblem(null)
      dismissConnectionToast()
      let needsPut = Boolean(body && Object.keys(body).length)
      try {
        if (needsPut) {
          await saveSection(key, body)
          needsPut = false
        }
        const payload = await confirmSection(key)
        clearDraft(key)
        onDone?.(payload)
      } catch (err) {
        if (err?.onboardingRequired || err?.status === 401) return
        if (isLockedForEdits(err)) onLocked?.()
        else if (isConnectionError(err)) {
          setProblem({ kind: "connection", missing: [], message: "" })
          showConnectionToast(connectionMessage(), () =>
            resubmitRef.current ? resubmitRef.current() : run(needsPut ? body : null),
          )
          focusFirstError([], { fallbackId: PROBLEM_PANEL_ID })
        } else fail(readValidation(err))
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [key, onDone, onLocked, fail, showConnectionToast, dismissConnectionToast],
  )

  const clearField = useCallback((k) => {
    setProblem((p) => (p && p.missing.includes(k) ? { ...p, missing: p.missing.filter((m) => m !== k) } : p))
  }, [])

  return { submit, busy, problem, shake, clearField, setProblem, fail, setResubmit }
}

/**
 * The row editor left open at the last reload, as `editor` state: { row, key, form, restored }.
 * Dropped when its row is gone, or when a new row's key fields are already in the list
 * (its save got through and only the answer was lost).
 */
export function restoreEditorDraft(sectionKey, rows, columns) {
  const draft = readEditorDraft(sectionKey)
  if (!draft) return null
  const { rowId, form } = draft
  const row = rowId == null ? null : (rows.find((r) => r.id === rowId) ?? null)
  const text = (v) => String(v ?? "").trim()
  const keyColumns = columns.filter((c) => c.required && !hiddenIn(c, form))
  const alreadySaved =
    rowId == null && keyColumns.length > 0 && rows.some((r) => keyColumns.every((c) => text(r[c.key]) === text(form[c.key])))
  if ((rowId != null && !row) || alreadySaved) {
    clearEditorDraft(sectionKey)
    return null
  }
  return { row, key: `draft-${rowId ?? "new"}`, form, restored: true }
}

/** Thai date "1 พ.ค. 2533" from YYYY-MM-DD (null-safe). */
export function thaiDate(iso, month = "short") {
  if (!iso) return ""
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("th-TH", { day: "numeric", month, year: "numeric" })
}

/** "มิ.ย. 2551" (month + BE year) for row ranges. */
export function thaiMonthYear(iso) {
  if (!iso) return ""
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

/** "นายสมชาย" → "สมชาย" for a friendly greeting. */
export function firstNameOnly(thFirst) {
  return String(thFirst ?? "")
    .replace(/^(นางสาว|นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|ดร\.|ว่าที่\s*ร\.ต\.)\s*/, "")
    .trim()
}

const hiddenIn = (c, form) => Boolean(c.showIf && !c.showIf(form))

/**
 * Only non-blank keys for a new row; only changed keys for an edit.
 * A hidden (showIf false) non-checkbox column is left out — on an edit it is cleared (null)
 * when the stored row still holds a value (e.g. lifetime license → no expiry date).
 */
export function rowBody(columns, form, original) {
  const out = {}
  for (const c of columns) {
    if (c.type !== "checkbox" && hiddenIn(c, form)) {
      if (original && !blank(original[c.key])) out[c.key] = null
      continue
    }
    let v = form[c.key]
    if (typeof v === "string") v = v.trim()
    if (c.type === "checkbox") v = Boolean(v)
    if (original) {
      const before = original[c.key] ?? (c.type === "checkbox" ? false : "")
      if ((before ?? "") === (v ?? "")) continue
      out[c.key] = v === "" ? null : v
    } else if (!blank(v) || c.type === "checkbox") out[c.key] = v === "" ? null : v
  }
  return out
}

/** Client check for the key fields of a new row (backend rule §3.3). */
export const missingKeys = (columns, form, isNew) =>
  columns.filter((c) => c.required && !hiddenIn(c, form) && (isNew || c.key in form) && blank(form[c.key])).map((c) => c.key)
