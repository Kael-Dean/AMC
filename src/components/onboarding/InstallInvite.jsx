// src/components/onboarding/InstallInvite.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time card: "you can install this app" (lazy: see InstallInviteGate.jsx).
// Non-modal on purpose: the page stays usable, nothing takes focus, nothing is dimmed.
//
// Marked seen in the layout effect that first shows it, so a reload doesn't repeat it.
//
// z 9980: under the Sidebar (9990) and every overlay, so a Sheet, a popover or the Toaster always
// wins. Bottom left from md up, away from the Toaster (bottom right) and the right-aligned save
// buttons. It steps aside while a Sheet or the Sidebar is open, while a phone's StickyActionBar is
// up, and while the on-screen keyboard is up.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Download } from "lucide-react"
import InstallGuideLazy from "../InstallGuideLazy"
import useVisualViewport from "../../hooks/useVisualViewport"
import { claimInstallInvite, isStickyBarShown } from "../../lib/installInvite"
import { useAppInstalled } from "../../lib/pwa"
import { isPageBusy } from "../../lib/searchIntro"
import { cx, neutralBtnCls, primaryBtnCls } from "../../lib/styles"

const Z = 9980

const isCovered = () => Boolean(document.body.dataset.sheetOpen) || isStickyBarShown()

function useCovered() {
  const [covered, setCovered] = useState(isCovered)
  useEffect(() => {
    const update = () => setCovered(isCovered())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] })
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-sheet-open"] })
    update()
    return () => observer.disconnect()
  }, [])
  return covered
}

export default function InstallInvite({ userId, paused, onClose, onPostpone }) {
  const [claimed, setClaimed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const claimedRef = useRef(false)
  const cardRef = useRef(null)
  const covered = useCovered()
  const { keyboardOpen } = useVisualViewport()
  const installed = useAppInstalled()

  // The gate checked a moment ago, but the chunk may have taken a while: check again, then claim.
  useLayoutEffect(() => {
    if (claimedRef.current) return
    if (isPageBusy()) {
      onPostpone()
      return
    }
    if (!claimInstallInvite(userId)) {
      onClose()
      return
    }
    claimedRef.current = true
    setClaimed(true)
  }, [userId, onClose, onPostpone])

  // The buttons unmount with the card: hand focus to the menu button, where "ติดตั้งแอป" lives.
  const keepFocus = () => {
    if (cardRef.current?.contains(document.activeElement)) {
      document.querySelector("[data-sidebar-toggle]")?.focus({ preventScroll: true })
    }
  }
  const dismiss = () => {
    keepFocus()
    onClose()
  }
  const showGuide = () => {
    keepFocus()
    setGuideOpen(true)
  }

  if (!claimed) return null
  if (guideOpen) return <InstallGuideLazy open onClose={onClose} />
  if (paused || covered || keyboardOpen || installed) return null

  return createPortal(
    <aside
      ref={cardRef}
      aria-label="ติดตั้งแอป"
      style={{ zIndex: Z }}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss()
      }}
      className={cx(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-[calc(1rem+env(safe-area-inset-left,0px))]",
        "right-[calc(1rem+env(safe-area-inset-right,0px))] md:right-auto md:w-[22rem]",
        "animate-fade-up rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200",
        "dark:bg-raised dark:shadow-black/50 dark:ring-line-strong",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
        >
          <Download strokeWidth={1.75} className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-6 text-gray-900 dark:text-gray-100">ติดตั้งแอปลงเครื่องได้</p>
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">เปิดจากไอคอนบนเครื่องได้เลย โดยไม่มีแถบเบราว์เซอร์</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={dismiss} className={neutralBtnCls}>
          ไว้ก่อน
        </button>
        <button type="button" onClick={showGuide} className={primaryBtnCls}>
          ดูวิธีติดตั้ง
        </button>
      </div>
    </aside>,
    document.body,
  )
}
