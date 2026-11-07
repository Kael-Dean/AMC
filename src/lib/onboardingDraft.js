// src/lib/onboardingDraft.js
// ─────────────────────────────────────────────────────────────────────────────
// Unsaved onboarding typing, kept in this browser so a reload, crash, lost connection or
// expired session never costs the person what they typed.
//
//   localStorage["onboarding_draft:<user>"] = {
//     sections: { <key>: { values, savedAt } },        one-form steps: only the changed keys
//     editors:  { <key>: { rowId, form, savedAt } },   the row editor that was open (rowId null = new)
//   }
//
// Entries older than 7 days are purged on read. Every call survives disabled/full storage.
// auth.logout() must NOT clear this: session expiry calls logout() and the person gets their
// typing back after logging in again. Only "ออกจากระบบ" on the onboarding page, a confirmed
// section or a 409 lock clears drafts.
// ─────────────────────────────────────────────────────────────────────────────
import { getUserKey } from "./auth"
import { isPreviewActive } from "./previewMode"

const PREFIX = "onboarding_draft:"
export const DRAFT_TTL_DAYS = 7
const TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000

// No key makes every function below a no-op: a preview neither reads nor writes real drafts.
const storageKey = () => {
  if (isPreviewActive()) return null
  const id = getUserKey()
  return id ? `${PREFIX}${id}` : null
}

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v)

function persist(key, store) {
  try {
    if (Object.keys(store.sections).length || Object.keys(store.editors).length) {
      localStorage.setItem(key, JSON.stringify(store))
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // storage disabled or full: the form still works, it just cannot be restored
  }
}

function freshEntries(group, now) {
  const kept = {}
  for (const [k, entry] of Object.entries(isObject(group) ? group : {})) {
    if (isObject(entry) && now - Number(entry.savedAt) < TTL_MS) kept[k] = entry
  }
  return kept
}

function load() {
  const key = storageKey()
  const empty = { key, store: { sections: {}, editors: {} } }
  if (!key) return empty
  let raw = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return empty
  }
  if (!raw) return empty
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  const now = Date.now()
  const store = { sections: freshEntries(parsed?.sections, now), editors: freshEntries(parsed?.editors, now) }
  const next = JSON.stringify(store)
  if (next !== raw) persist(key, store)
  return { key, store }
}

function update(mutate) {
  const { key, store } = load()
  if (!key) return
  mutate(store)
  persist(key, store)
}

/** The changed values of a one-form section, or null. */
export function readDraft(section) {
  const values = load().store.sections[section]?.values
  return isObject(values) ? values : null
}

/** Store the changed values; an empty object removes the entry. */
export function writeDraft(section, values) {
  update((store) => {
    if (isObject(values) && Object.keys(values).length) {
      store.sections[section] = { values, savedAt: Date.now() }
    } else {
      delete store.sections[section]
    }
  })
}

/** Forget everything unsaved of one section (its values and its open row editor). */
export function clearDraft(section) {
  update((store) => {
    delete store.sections[section]
    delete store.editors[section]
  })
}

/** The row editor left open in a section: `{ rowId, form }` or null. */
export function readEditorDraft(section) {
  const entry = load().store.editors[section]
  return entry && isObject(entry.form) ? { rowId: entry.rowId ?? null, form: entry.form } : null
}

export function writeEditorDraft(section, { rowId = null, form }) {
  update((store) => {
    store.editors[section] = { rowId, form, savedAt: Date.now() }
  })
}

export function clearEditorDraft(section) {
  update((store) => {
    delete store.editors[section]
  })
}

/** Forget all unsaved typing of the current user. */
export function clearAllDrafts() {
  const key = storageKey()
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    // storage disabled: nothing to clear
  }
}
