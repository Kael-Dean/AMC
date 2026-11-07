// src/pages/admin/OnboardingPreviewHost.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Runs the real onboarding components in preview mode, over the app, for the Super Admin's gallery.
// Mounted by AppLayout rather than the gallery so that the tour can walk real pages and still be here.
// This chunk statically imports them; the gates' own dynamic imports keep them out of the main bundle.
// The wizard is not here: it is full screen, on its own route (OnboardingWizardPreview.jsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import InstallGuideLazy from "../../components/InstallGuideLazy"
import InstallInvite from "../../components/onboarding/InstallInvite"
import OnboardingBanner from "../../components/onboarding/OnboardingBanner"
import SearchIntro from "../../components/onboarding/SearchIntro"
import { TourPreview } from "../../components/onboarding/TourOverlay"
import { BANNER_STATES } from "../../components/onboarding/bannerCopy"
import { Sheet, toast } from "../../components/ui"
import { getUser } from "../../lib/auth"
import { ONBOARDING_GALLERY_PATH, getPreview, isOnboardingGalleryPath, usePreview } from "../../lib/previewMode"
import PreviewBar from "./PreviewBar"
import { stopPreview } from "./previewSession"

const onBannerAction = () => toast.info("โหมดตัวอย่าง ปุ่มนี้ไม่พาไปไหน ของจริงจะพาไปกรอกข้อมูลหรือเริ่มทัวร์")

function BannerPreview({ onClose }) {
  return (
    <Sheet open onClose={onClose} title="แถบบนหน้าหลัก ทั้ง 4 สถานะ" size="lg">
      <div className="space-y-3">
        {BANNER_STATES.map(({ key, ob, tour }) => (
          <OnboardingBanner key={key} preview={{ ob, tour, onAction: onBannerAction }} />
        ))}
      </div>
    </Sheet>
  )
}

export default function OnboardingPreviewHost() {
  const preview = usePreview()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const kind = preview?.kind
  const trigger = preview?.trigger
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  const exit = useCallback(() => {
    stopPreview()
    // The tour may have walked off to a real page: come back with no extra history entry.
    if (!isOnboardingGalleryPath(pathRef.current)) {
      navigate(ONBOARDING_GALLERY_PATH, { replace: true, state: { previewReturn: trigger } })
    }
  }, [navigate, trigger])

  // Leaving AppLayout mid-preview (a redirect, say) must not leave the flag and the wall up. Deferred
  // and re-checked because StrictMode unmounts and remounts once in development.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      setTimeout(() => {
        if (!mounted.current && getPreview()?.kind !== "wizard") stopPreview()
      }, 0)
    }
  }, [])

  if (!kind || kind === "wizard") return null
  return (
    <>
      <PreviewBar onExit={exit} escapeAlways={kind === "tour"} />
      {kind === "search" && <SearchIntro preview userId={getUser()?.id ?? null} onClose={exit} onPostpone={exit} />}
      {kind === "invite" && <InstallInvite preview userId={getUser()?.id ?? null} onClose={exit} onPostpone={exit} />}
      {kind === "guide" && <InstallGuideLazy preview open onClose={exit} />}
      {kind === "banner" && <BannerPreview onClose={exit} />}
      {kind === "tour" && <TourPreview onExit={exit} />}
    </>
  )
}
