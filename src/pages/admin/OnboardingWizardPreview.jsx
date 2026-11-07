// src/pages/admin/OnboardingWizardPreview.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The real first-login wizard (pages/onboarding/Onboarding.jsx) on a fake, in-memory record.
// Its own route because the real one is full screen, outside AppLayout. Leaving the route for any
// reason, browser back included, drops everything typed.
//
// The preview flag is up before any step renders: steps read drafts while they first render.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useLayoutEffect, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { loadMyPermissions } from "../../lib/myPermissions"
import { SECTION_KEYS, setOnboardingPreviewWrites } from "../../lib/onboarding"
import { ONBOARDING_GALLERY_PATH } from "../../lib/previewMode"
import Onboarding from "../onboarding/Onboarding"
import PreviewBar from "./PreviewBar"
import { startPreview, stopPreview } from "./previewSession"
import { applyConfirm, applySave, seedPayload } from "./wizardSandbox"

// Room for the strip above the wizard's own sticky header (h-14) and stepper.
const OFFSET = { pageCls: "pt-11", headerCls: "top-11", stepperCls: "!top-[6.25rem]" }

export default function OnboardingWizardPreview() {
  const navigate = useNavigate()
  const location = useLocation()
  // Read once: moving between steps drops the location state.
  const [trigger] = useState(() => location.state?.trigger ?? "wizard")
  const [data, setData] = useState(seedPayload)
  const [ready, setReady] = useState(false)
  const dataRef = useRef(data)

  useEffect(() => {
    // A direct visit: this route is outside AppLayout, which is what normally loads them. The guard
    // re-checks when they arrive, so a Super Admin acting as another role is sent away here too.
    loadMyPermissions()
  }, [])

  useLayoutEffect(() => {
    const answer = (next) => {
      dataRef.current = next
      setData(next)
      return Promise.resolve(next)
    }
    startPreview("wizard", trigger)
    setOnboardingPreviewWrites({
      save: (key, body) => answer(applySave(dataRef.current, key, body)),
      confirm: (key) => answer(applyConfirm(dataRef.current, key)),
    })
    setReady(true)
    return () => {
      setOnboardingPreviewWrites(null)
      stopPreview()
    }
  }, [trigger])

  const leave = useCallback(
    (state) => navigate(ONBOARDING_GALLERY_PATH, { replace: true, state }),
    [navigate],
  )
  const exit = useCallback(() => leave({ previewReturn: trigger }), [leave, trigger])

  const preview = useMemo(
    () => ({
      ob: {
        status: "ready",
        data,
        sections: data.sections,
        confirmedCount: SECTION_KEYS.filter((key) => data.sections[key]?.confirmed_at).length,
      },
      exit,
      exitPath: ONBOARDING_GALLERY_PATH,
      // The tour has its own preview: hand over to its row rather than start it from in here.
      onStartTour: () => leave({ previewReturn: "tour", previewNext: "tour" }),
      offset: OFFSET,
    }),
    [data, exit, leave],
  )

  if (!ready) return null
  return (
    <>
      <PreviewBar placement="strip" onExit={exit} />
      <Onboarding preview={preview} />
    </>
  )
}
