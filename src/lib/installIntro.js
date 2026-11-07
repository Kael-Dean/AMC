// src/lib/installIntro.js
// ─────────────────────────────────────────────────────────────────────────────
// One-time "the app can now be installed" intro: seen state and the rules. No React here.
//   gate     components/onboarding/InstallIntroGate.jsx (always loaded, decides when)
//   overlay  components/onboarding/InstallIntro.jsx     (lazy chunk)
//
// Seen state is frontend-only: localStorage["install_intro_seen:<userId>"].
// It must survive logout, so this key must never join AUTH_STORAGE_KEYS in lib/auth.js.
// ─────────────────────────────────────────────────────────────────────────────

import { isPreviewActive } from "./previewMode"

const SEEN_PREFIX = "install_intro_seen:"
const STICKY_BAR_VAR = "--sticky-bar-h" // published by a visible phone <StickyActionBar>
const DATA_ENTRY_ROUTE = /^\/(buy|sales)(\/|$)/i

const hasUserId = (userId) => userId !== null && userId !== undefined && userId !== ""

export const installIntroKey = (userId) => `${SEEN_PREFIX}${userId}`

/** Unreadable storage counts as seen: if we can't remember showing it, showing it could repeat forever. */
export function hasSeenInstallIntro(userId) {
  try {
    return localStorage.getItem(installIntroKey(userId)) !== null
  } catch {
    return true
  }
}

/**
 * Marks it seen and returns true only if this call is the one that may open the intro:
 * false when it was already seen (another tab won the race) or the write did not stick.
 */
export function claimInstallIntro(userId) {
  if (isPreviewActive()) return false
  try {
    const key = installIntroKey(userId)
    if (localStorage.getItem(key) !== null) return false
    localStorage.setItem(key, "1")
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/** The conditions that come from app state. While any fails nothing is shown and nothing is marked. */
export function isInstallIntroEligible({
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

/** A phone's bottom action bar is up, so someone is in the middle of a form. */
export const isStickyBarShown = () => document.documentElement.style.getPropertyValue(STICKY_BAR_VAR) !== ""
