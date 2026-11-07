// src/lib/previewMode.js
// ─────────────────────────────────────────────────────────────────────────────
// "A Super Admin is previewing an onboarding" flag (gallery page: pages/admin/OnboardingGallery.jsx).
// Lives in memory only, so a reload always ends a preview. No React state, no storage, no network.
//
// While it is set, the real onboarding code keeps its hands off everything lasting:
//   lib/onboardingDraft.js   no draft is read or written
//   lib/onboarding.js        the gate status is not written; wizard saves go to the preview's memory
//   lib/tourState.js         the tour's sessionStorage key is not written
//   lib/searchIntro.js, lib/installIntro.js   nothing can be claimed as seen
//   SearchIntroGate, InstallIntroGate          the real ones hold back until the preview ends
//
// Only the flag is here, because those modules are always loaded. The start / stop actions and the
// network wall are in the gallery's lazy chunk (pages/admin/previewSession.js).
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"

/** The gallery page. Its route and its preview route must both stay under this path. */
export const ONBOARDING_GALLERY_PATH = "/admin/onboarding"
export const isOnboardingGalleryPath = (pathname) =>
  pathname === ONBOARDING_GALLERY_PATH || pathname.startsWith(`${ONBOARDING_GALLERY_PATH}/`)

let current = null // { kind, trigger }
const listeners = new Set()

function set(next) {
  current = next
  listeners.forEach((fn) => fn())
}

export const isPreviewActive = () => current !== null
export const getPreview = () => current
/** Internal to pages/admin/previewSession.js: everyone else starts and stops through that file. */
export const setPreview = set

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** The running preview, `{ kind, trigger }` or null. */
export function usePreview() {
  return useSyncExternalStore(subscribe, getPreview, getPreview)
}
