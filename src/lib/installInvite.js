// src/lib/installInvite.js
// ─────────────────────────────────────────────────────────────────────────────
// One-time "you can install this app" invitation: seen state and the rules. No React here.
//   gate  components/onboarding/InstallInviteGate.jsx (always loaded, decides when)
//   card  components/onboarding/InstallInvite.jsx     (lazy chunk)
//
// Seen state is frontend-only: localStorage["install_invite_seen:<userId>"].
// It must survive logout, so this key must never join AUTH_STORAGE_KEYS in lib/auth.js.
// ─────────────────────────────────────────────────────────────────────────────

import { isPreviewActive } from "./previewMode"

const SEEN_PREFIX = "install_invite_seen:"
const STICKY_BAR_VAR = "--sticky-bar-h" // published by a visible phone <StickyActionBar>
const DATA_ENTRY_ROUTE = /^\/(buy|sales)(\/|$)/i

const hasUserId = (userId) => userId !== null && userId !== undefined && userId !== ""

export const installInviteKey = (userId) => `${SEEN_PREFIX}${userId}`

/** The card's words: InstallInvite.jsx shows them, the gallery lists them. */
export const INSTALL_INVITE_COPY = {
  title: "ติดตั้งแอปลงเครื่องได้",
  body: "เปิดจากไอคอนบนเครื่องได้เลย โดยไม่มีแถบเบราว์เซอร์",
  later: "ไว้ก่อน",
  guide: "ดูวิธีติดตั้ง",
}

/** Unreadable storage counts as seen: if we can't remember showing it, showing it could repeat forever. */
export function hasSeenInstallInvite(userId) {
  try {
    return localStorage.getItem(installInviteKey(userId)) !== null
  } catch {
    return true
  }
}

/**
 * Marks it seen and returns true only if this call is the one that may show the card:
 * false when it was already seen (another tab won the race) or the write did not stick.
 */
export function claimInstallInvite(userId) {
  if (isPreviewActive()) return false
  try {
    const key = installInviteKey(userId)
    if (localStorage.getItem(key) !== null) return false
    localStorage.setItem(key, "1")
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/** The conditions that come from app state. While any fails nothing is shown and nothing is marked. */
export function isInstallInviteEligible({
  userId,
  installOption,
  installed,
  onboardingStatus,
  needsOnboarding,
  locked,
  tourActive,
}) {
  if (!hasUserId(userId) || !installOption || installed) return false
  if (onboardingStatus !== "ready" && onboardingStatus !== "out_of_scope") return false
  return !(needsOnboarding || locked || tourActive)
}

/** Buy and Sales are long entry forms worked through step by step: don't start or stay there. */
export const isDataEntryRoute = (pathname) => DATA_ENTRY_ROUTE.test(pathname)

/** The card would sit on the phone's bottom action bar. */
export const isStickyBarShown = () => document.documentElement.style.getPropertyValue(STICKY_BAR_VAR) !== ""
