// src/pages/admin/wizardSandbox.js
// ─────────────────────────────────────────────────────────────────────────────
// The fake personnel payload behind the wizard preview, plus what PUT and confirm would do to it.
// Plain functions over a plain object: it lives in the preview component's state and dies with it.
// Same payload shape as GET /personnel/me/onboarding (see lib/onboarding.js), with obviously fake
// values. It does not imitate the server's checks: only the page's own validation runs.
// ─────────────────────────────────────────────────────────────────────────────
import { NONE_SECTIONS, SECTION_KEYS } from "../../lib/onboarding"

const FAKE_DATE = "2026-01-01T00:00:00+07:00"

export function seedPayload() {
  return {
    onboarded: false,
    unlocked: false,
    exempt: false,
    completed_at: null,
    tour_completed_at: null,
    sections: Object.fromEntries(SECTION_KEYS.map((key) => [key, { confirmed_at: null, missing: [] }])),
    values: {
      account: { first_name: "", last_name: "", th_first_name: "นายตัวอย่าง", th_last_name: "ทดลองระบบ", email: "" },
      personal: { cid: "0000000000000", hired: "2026-01-01" },
      address: {},
      family: [],
      education: [],
      work: [],
      criminal: [],
      license: [],
    },
    none_flags: Object.fromEntries(NONE_SECTIONS.map((key) => [key, false])),
  }
}

let nextRowId = -1 // negative: can never be mistaken for a real row

function applyRows(list, { rows = [], delete_ids: deleteIds = [] }) {
  let next = list.filter((row) => !deleteIds.includes(row.id))
  for (const row of rows) {
    if (row.id == null) {
      next = [...next, { ...row, id: nextRowId, hr_verified: false, can_delete: true }]
      nextRowId -= 1
    } else {
      next = next.map((old) => (old.id === row.id ? { ...old, ...row } : old))
    }
  }
  return next
}

/** What PUT /personnel/me/onboarding/{key} would answer. */
export function applySave(data, key, body) {
  const current = data.values[key]
  const values = {
    ...data.values,
    [key]: Array.isArray(current) ? applyRows(current, body) : { ...current, ...body },
  }
  const none_flags = typeof body.none === "boolean" ? { ...data.none_flags, [key]: body.none } : data.none_flags
  return { ...data, values, none_flags }
}

/** What POST /personnel/me/onboarding/{key}/confirm would answer. */
export function applyConfirm(data, key) {
  const sections = { ...data.sections, [key]: { confirmed_at: FAKE_DATE, missing: [] } }
  return { ...data, sections, unlocked: SECTION_KEYS.every((k) => sections[k].confirmed_at) }
}
