// src/components/onboarding/InstallInviteGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Decides WHEN the one-time install invitation shows (rules: lib/installInvite.js).
// Mounted once in AppLayout and stays small: the card is a lazy chunk that people who have already
// seen it never download.
//
// Plain React.lazy, not lazyWithReload: a missing chunk must not reload the page under someone's
// work for an optional card. It just stays unseen and tries again on the next visit.
// ─────────────────────────────────────────────────────────────────────────────
import { Component, lazy, Suspense, useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { getUser } from "../../lib/auth"
import {
  hasSeenInstallInvite,
  isDataEntryRoute,
  isInstallInviteEligible,
  isStickyBarShown,
} from "../../lib/installInvite"
import { useOnboarding } from "../../lib/onboarding"
import { useAppInstalled, useInstallOption } from "../../lib/pwa"
import { hasSeenSearchIntro, isPageBusy } from "../../lib/searchIntro"
import { useTourState } from "../../lib/tourState"
import { useIsPhone } from "../../hooks/useMediaQuery"

const loadInvite = () => import("./InstallInvite")
const InstallInvite = lazy(loadInvite)

const SETTLE_MS = 1500 // let the page, and the person, settle first
const RETRY_MS = 1000 // while something else has the screen

class ChunkBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function InstallInviteGate() {
  const { pathname } = useLocation()
  const isPhone = useIsPhone()
  const onboarding = useOnboarding()
  const tour = useTourState()
  const installOption = useInstallOption()
  const installed = useAppInstalled()
  const userId = getUser()?.id ?? null
  const [phase, setPhase] = useState("waiting") // waiting → showing → done

  const onDataEntry = isDataEntryRoute(pathname)
  const wanted =
    phase === "waiting" &&
    !onDataEntry &&
    isInstallInviteEligible({
      userId,
      installOption,
      installed,
      onboardingStatus: onboarding.status,
      needsOnboarding: onboarding.needsOnboarding,
      locked: onboarding.locked,
      tourActive: tour.active,
    }) &&
    !hasSeenInstallInvite(userId)

  // Restarts on navigation: a page that just opened hasn't settled yet.
  useEffect(() => {
    if (!wanted) return
    loadInvite().catch(() => {}) // the lazy render below reports a failure
    let timer
    const check = (wasBlocked) => {
      // The search intro only runs from md up (on phones it never comes, so don't wait for it).
      const introPending = !isPhone && !hasSeenSearchIntro(userId)
      if (introPending || isStickyBarShown() || isPageBusy()) timer = setTimeout(() => check(true), RETRY_MS)
      // Don't pop up the instant something closes: wait for the page to settle again.
      else if (wasBlocked) timer = setTimeout(() => check(false), SETTLE_MS)
      else setPhase("showing")
    }
    timer = setTimeout(() => check(false), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [wanted, pathname, isPhone, userId])

  const close = useCallback(() => setPhase("done"), [])
  const postpone = useCallback(() => setPhase("waiting"), [])

  if (phase !== "showing") return null
  return (
    <ChunkBoundary onError={close}>
      <Suspense fallback={null}>
        <InstallInvite
          userId={userId}
          paused={onDataEntry || tour.active}
          onClose={close}
          onPostpone={postpone}
        />
      </Suspense>
    </ChunkBoundary>
  )
}
