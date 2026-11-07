// src/components/onboarding/InstallIntro.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time intro: "the app can now be installed" (lazy: see InstallIntroGate.jsx).
// Three steps in a <Sheet>, with น้องมะลิ beside the copy and a drawn demo of what installing gives you.
// The last step hands over to the real install guide.
//
// Marked seen in the layout effect that first opens it, so a reload mid-way doesn't repeat it.
// X, Esc and the backdrop close it; the "ติดตั้งแอป" menu entry stays for later.
//
// The demo is a schematic like InstallGuideArt.jsx: generic frames in theme classes, the real logo,
// no browser artwork and no screenshots. aria-hidden, because the copy carries all the meaning.
// It moves only with transform and opacity. Reduced motion gets the final frame and no timers.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { ArrowLeft, Download } from "lucide-react"
import InstallGuideLazy from "../InstallGuideLazy"
import Mascot from "../ui/Mascot"
import Sheet from "../ui/Sheet"
import useMediaQuery from "../../hooks/useMediaQuery"
import { claimInstallIntro } from "../../lib/installIntro"
import { isPageBusy } from "../../lib/searchIntro"
import { detectInstallPlatform, useAppInstalled } from "../../lib/pwa"
import { cx, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { INSTALL_INTRO_ACTIONS as ACTIONS, INSTALL_INTRO_STEPS as STEPS } from "./installIntroSteps"

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

const APP_NAME = "SKT สุรินทร์" // manifest short_name
const MENU_LABEL = "ติดตั้งแอป" // Sidebar.jsx

// One loop of each demo, ms. Most of it is the hold on the result: this should read as calm.
const HOME_LOOP = [
  { name: "empty", ms: 1000 },
  { name: "land", ms: 4200 },
  { name: "clear", ms: 450 },
]
const OPEN_LOOP = [
  { name: "browser", ms: 1800 },
  { name: "press", ms: 170 },
  { name: "open", ms: 3800 },
  { name: "clear", ms: 340 },
]

const EASE_OUT = "cubic-bezier(.16,1,.3,1)"
const EASE_SETTLE = "cubic-bezier(.34,1.35,.64,1)" // one soft overshoot, then still
const BROWSER_BAR_H = 30

// Phones, and any touch screen too short for her full size (a landscape phone at md and up).
const SMALL_MASCOT = "(max-width: 767.98px), (pointer: coarse) and (max-height: 500px)"

const BONE = "bg-gray-200 dark:bg-white/15"
const NO_MOTION = "motion-reduce:!transition-none"

const subscribeVisibility = (fn) => {
  document.addEventListener("visibilitychange", fn)
  return () => document.removeEventListener("visibilitychange", fn)
}
const isTabVisible = () => document.visibilityState === "visible"

/**
 * Current phase name of a loop. Reduced motion: the given final phase and no timers.
 * Pauses where it is while the tab is hidden. Timers die with the step, which unmounts the demo.
 */
function useLoopPhase(loop, finalPhase) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  const tabVisible = useSyncExternalStore(subscribeVisibility, isTabVisible, isTabVisible)
  const [index, setIndex] = useState(0)
  const position = useRef(0)
  const running = !reduced && tabVisible

  useEffect(() => {
    if (!running) return
    let timer
    const advance = () => {
      position.current = (position.current + 1) % loop.length
      setIndex(position.current)
      timer = setTimeout(advance, loop[position.current].ms)
    }
    timer = setTimeout(advance, loop[position.current].ms)
    return () => clearTimeout(timer)
  }, [loop, running])

  return reduced ? finalPhase : loop[index].name
}

function AppIcon({ className }) {
  return (
    <img
      src={asset("/pwa/icon-192.png")}
      alt=""
      width={192}
      height={192}
      draggable={false}
      className={cx("rounded-[24%] bg-white object-contain ring-1 ring-black/10 dark:ring-white/15", className)}
    />
  )
}

/** A phone running off the bottom of the stage, or a whole desktop screen. */
function DeviceFrame({ device, children }) {
  return (
    <div
      className={cx(
        "absolute overflow-hidden bg-white ring-1 ring-gray-300 dark:bg-raised dark:ring-line-strong",
        device === "phone" ? "bottom-0 left-1/2 top-3 w-44 -translate-x-1/2 rounded-t-[22px]" : "inset-3 rounded-lg",
      )}
    >
      {children}
    </div>
  )
}

function Taskbar() {
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center gap-1.5 bg-gray-100 dark:bg-white/[.06]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cx("size-3 rounded-[4px]", BONE)} />
      ))}
    </div>
  )
}

/** Grey icons with one empty slot; the app lands in it. */
function HomeScene({ device }) {
  const phase = useLoopPhase(HOME_LOOP, "land")
  const phone = device === "phone"
  const slot = phone ? 6 : 7
  const landed = phase !== "empty"
  const iconStyle = {
    opacity: phase === "land" ? 1 : 0,
    transform: landed ? "none" : "translateY(-26px) scale(.9)",
    transition:
      phase === "land"
        ? `transform 560ms ${EASE_SETTLE}, opacity 160ms linear`
        : phase === "clear"
          ? "opacity 400ms linear"
          : "none",
  }

  return (
    <DeviceFrame device={device}>
      {phone && <span className={cx("absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full", BONE)} />}
      <div
        className={cx(
          "grid justify-between gap-y-5 px-4",
          phone ? "grid-cols-[repeat(4,1.75rem)] pt-6" : "grid-cols-[repeat(6,1.75rem)] pt-3",
        )}
      >
        {Array.from({ length: 12 }, (_, i) =>
          i === slot ? (
            <span key={i} className="relative size-7">
              <span
                className={cx(
                  "absolute inset-0 rounded-[24%] border border-dashed border-gray-300 transition-opacity duration-200 dark:border-white/25",
                  NO_MOTION,
                  phase === "land" ? "opacity-0" : "opacity-100",
                )}
              />
              <span className={cx("absolute inset-0", NO_MOTION)} style={iconStyle}>
                <AppIcon className="size-7 shadow-sm" />
              </span>
              <span
                className={cx(
                  "absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium leading-4 text-gray-700 transition-opacity dark:text-gray-200",
                  NO_MOTION,
                  phase === "land" ? "opacity-100 delay-300 duration-300" : "opacity-0 duration-300",
                )}
              >
                {APP_NAME}
              </span>
            </span>
          ) : (
            <span key={i} className={cx("size-7 rounded-[24%]", BONE)} />
          ),
        )}
      </div>
      {!phone && <Taskbar />}
    </DeviceFrame>
  )
}

const CONTENT_BARS = ["w-full", "w-4/5", "w-full", "w-3/5", "w-full", "w-4/5", "w-full", "w-2/3"]

/** A browser bar over the page; pressing the icon slides the bar away and the page takes the frame. */
function OpenScene({ device }) {
  const phase = useLoopPhase(OPEN_LOOP, "open")
  const opened = phase === "open" || phase === "clear"
  const pressed = phase === "press"

  return (
    <DeviceFrame device={device}>
      {/* Two layers: the fade between loops on the outer one, the slide on the inner one. */}
      <div className={cx("absolute inset-0 transition-opacity duration-300", NO_MOTION, phase === "clear" ? "opacity-0" : "opacity-100")}>
        <div
          className={NO_MOTION}
          style={{
            transform: opened ? `translateY(-${BROWSER_BAR_H}px)` : "none",
            transition: phase === "open" ? `transform 520ms ${EASE_OUT}` : "none",
          }}
        >
          <div style={{ height: BROWSER_BAR_H }} className="flex items-center gap-1.5 bg-gray-100 px-2 dark:bg-white/[.06]">
            <span className={cx("size-2 shrink-0 rounded-full", BONE)} />
            <span className="flex h-[18px] min-w-0 flex-1 items-center rounded-full bg-white px-2 ring-1 ring-gray-300 dark:bg-white/[.08] dark:ring-line">
              <span className={cx("h-1 w-3/5 rounded-full", BONE)} />
            </span>
            <span className={cx("size-2 shrink-0 rounded-full", BONE)} />
          </div>
          <div className="space-y-2.5 px-3 pt-2.5">
            <div className="flex items-center gap-1.5">
              <AppIcon className="size-[18px]" />
              <span className={cx("h-1.5 w-14 rounded-full", BONE)} />
            </div>
            {CONTENT_BARS.map((width, i) => (
              <div key={i} className={cx("h-1.5 rounded-full", width, BONE)} />
            ))}
          </div>
        </div>

        <div
          className={cx(
            "absolute inset-x-0 bottom-2 flex justify-center transition-opacity duration-200",
            NO_MOTION,
            opened ? "opacity-0" : "opacity-100",
          )}
        >
          <div className="flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-surface dark:ring-line-strong">
            <span className={cx("size-6 rounded-[24%]", BONE)} />
            <span className="relative size-6">
              <span
                className={cx(
                  "absolute -inset-1 rounded-[10px] bg-indigo-500/25 transition-opacity duration-100 dark:bg-indigo-400/30",
                  pressed ? "opacity-100" : "opacity-0",
                )}
              />
              <span className={cx("absolute inset-0 transition-transform duration-100", pressed && "scale-[.86]")}>
                <AppIcon className="size-6" />
              </span>
            </span>
            <span className={cx("size-6 rounded-[24%]", BONE)} />
          </div>
        </div>
      </div>
    </DeviceFrame>
  )
}

/** The side menu as it really is: the list above, then ติดตั้งแอป first in the block at the bottom. */
function WhereScene({ device }) {
  return (
    <DeviceFrame device={device}>
      <div className="absolute inset-0 space-y-2.5 py-3 pl-[55%] pr-3">
        {CONTENT_BARS.map((width, i) => (
          <div key={i} className={cx("h-1.5 rounded-full", width, BONE)} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gray-900/10 dark:bg-black/35" />
      <div
        className={cx(
          "absolute inset-y-0 left-0 flex flex-col bg-white shadow-lg ring-1 ring-gray-200 dark:bg-surface dark:shadow-black/40 dark:ring-line-strong",
          device === "phone" ? "w-[80%]" : "w-48",
        )}
      >
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-2 pt-3">
          {["w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/5"].map((width, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={cx("size-4 shrink-0 rounded", BONE)} />
              <span className={cx("h-1.5 rounded-full", width, BONE)} />
            </div>
          ))}
        </div>
        <div className="shrink-0 space-y-1 border-t border-gray-200 p-1.5 dark:border-line">
          <div className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-50 pl-1 pr-2 ring-1 ring-indigo-300 dark:bg-indigo-500/15 dark:ring-indigo-400/60">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              <Download strokeWidth={1.75} className="size-3.5" />
            </span>
            <span className="truncate text-xs font-semibold text-indigo-700 dark:text-indigo-200">{MENU_LABEL}</span>
          </div>
          <div className="flex h-6 items-center gap-1.5 pl-1.5">
            <span className={cx("size-4 shrink-0 rounded", BONE)} />
            <span className={cx("h-1.5 w-1/2 rounded-full", BONE)} />
          </div>
        </div>
      </div>
    </DeviceFrame>
  )
}

const SCENES = { home: HomeScene, open: OpenScene, where: WhereScene }

function Demo({ stepKey }) {
  const [device] = useState(() => (detectInstallPlatform().platform === "desktop" ? "desktop" : "phone"))
  const Scene = SCENES[stepKey]
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative mt-3 h-44 select-none overflow-hidden rounded-xl bg-gray-50 ring-1 ring-inset ring-gray-200/70 md:h-52 short-touch:h-32 dark:bg-field dark:ring-line"
    >
      {/* key: a new step starts a new demo, and unmounting the old one clears its timers */}
      <div key={stepKey} className="animate-fade-in absolute inset-0">
        <Scene device={device} />
      </div>
    </div>
  )
}

/** A quoted menu name stays on one line: Thai can otherwise wrap inside it. */
function Line({ text }) {
  return text.split(/(“[^”]*”)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

function Dots({ index }) {
  return (
    <div aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s.key}
          className={cx(
            "h-1.5 rounded-full transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)]",
            i === index ? "w-5 bg-indigo-600 dark:bg-indigo-400" : i < index ? "w-1.5 bg-indigo-300 dark:bg-indigo-400/50" : "w-1.5 bg-gray-300 dark:bg-white/15",
          )}
        />
      ))}
    </div>
  )
}

/** `preview` (gallery, Super Admin): nothing is claimed as seen, and focus goes back to the gallery. */
export default function InstallIntro({ userId, paused = false, onClose, onPostpone, preview = false }) {
  const [claimed, setClaimed] = useState(preview)
  const [guideOpen, setGuideOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const claimedRef = useRef(false) // survives StrictMode's second effect run, which would find it seen
  const primaryRef = useRef(null)
  const smallMascot = useMediaQuery(SMALL_MASCOT)
  const installed = useAppInstalled()

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const closedByInstall = installed && !preview

  // The gate checked a moment ago, but the chunk may have taken a while: check again, then claim.
  useLayoutEffect(() => {
    if (preview || claimedRef.current) return
    if (isPageBusy()) {
      onPostpone()
      return
    }
    if (!claimInstallIntro(userId)) {
      onClose()
      return
    }
    claimedRef.current = true
    setClaimed(true)
  }, [userId, onClose, onPostpone, preview])

  // Installed from the browser's own menu while this is up. The guide stays: it shows the success.
  useEffect(() => {
    if (closedByInstall && !guideOpen) onClose()
  }, [closedByInstall, guideOpen, onClose])

  // Keyboard users keep their place on the main button as they step; "ย้อนกลับ" can vanish under them.
  useEffect(() => {
    if (claimed) primaryRef.current?.focus({ preventScroll: true })
  }, [stepIndex, claimed])

  // So the swap to the guide doesn't leave a gap with no sheet on screen.
  useEffect(() => {
    if (isLast) import("../InstallGuide").catch(() => {}) // InstallGuideLazy reports a failure
  }, [isLast])

  const focusMenuButton = () => {
    if (!preview) document.querySelector("[data-sidebar-toggle]")?.focus({ preventScroll: true })
  }
  const dismiss = () => {
    onClose()
    // After the Sheet's focus trap has restored focus on its way out.
    requestAnimationFrame(focusMenuButton)
  }
  const showGuide = () => {
    focusMenuButton() // the guide's Sheet returns focus to whatever had it when it opened
    setGuideOpen(true)
  }

  if (!claimed) return null
  if (guideOpen) return <InstallGuideLazy open onClose={onClose} preview={preview} />
  if (paused || closedByInstall) return null

  return (
    <Sheet
      open
      onClose={dismiss}
      title={step.title}
      size="sm"
      initialFocus="[data-autofocus]"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Dots index={stepIndex} />
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex(stepIndex - 1)}
                className={cx(neutralBtnCls, "whitespace-nowrap !px-3 max-[374px]:w-11 max-[374px]:!px-0")}
              >
                <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} />
                {/* A 320px screen can't hold three labelled buttons and the dots. */}
                <span className="sr-only min-[375px]:not-sr-only">{ACTIONS.back}</span>
              </button>
            )}
            {isLast && (
              <button type="button" onClick={dismiss} className={cx(neutralBtnCls, "whitespace-nowrap !px-3")}>
                {ACTIONS.later}
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              data-autofocus
              onClick={isLast ? showGuide : () => setStepIndex(stepIndex + 1)}
              className={cx(primaryBtnCls, "whitespace-nowrap max-[374px]:!px-3")}
            >
              {isLast ? ACTIONS.guide : ACTIONS.next}
            </button>
          </div>
        </div>
      }
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`ขั้นที่ ${stepIndex + 1} จาก ${STEPS.length}: ${step.title} ${step.lines.join(" ")}`}
      </p>

      <div className="flex items-start gap-3">
        {/* Stays mounted across steps so her state machine keeps running. */}
        <Mascot
          mood={isLast ? "success" : "onboard"}
          point="down"
          size={smallMascot ? 72 : 104}
          tappable
          className="-my-1 -ml-2 shrink-0"
        />
        {/* Every step sits in one grid cell, so the tallest copy sets the height for all of them. */}
        <div className="grid min-w-0 flex-1 self-center">
          {STEPS.map((s, i) => (
            <div key={s.key} className={cx("[grid-area:1/1]", i === stepIndex ? "animate-fade-in" : "invisible")}>
              {s.lines.map((line) => (
                <p key={line} className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                  <Line text={line} />
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Demo stepKey={step.key} />
    </Sheet>
  )
}
