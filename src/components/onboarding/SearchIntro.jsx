// src/components/onboarding/SearchIntro.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time intro for the header function search (lazy: see SearchIntroGate.jsx).
// Spotlights the real box like TourOverlay (a fixed box whose huge shadow is the scrim, plus a
// click shield) with a card anchored under it. Separate from TOUR_STOPS: that tour is for
// first-time staff and completes once on the backend.
//
// The overlay is marked seen in the layout effect that first opens it, so a reload mid-demo
// doesn't replay it. Clicks outside the card do nothing: only ข้าม, Esc and the final button close.
//
// z 10045: above Sheet (10040), below popovers (10050) / ConfirmDialog / Toaster.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ArrowLeft, Search, X } from "lucide-react"
import Portal from "../Portal"
import Mascot from "../ui/Mascot"
import useMediaQuery from "../../hooks/useMediaQuery"
import { getFunctionSearchIndex, visibleFunctionIds } from "../../lib/functionCatalogue"
import { highlightParts, hitSecondaryLine, searchIndex } from "../../lib/functionSearch"
import { useCan } from "../../lib/permissions"
import { claimSearchIntro, findFunctionSearch, isPageBusy } from "../../lib/searchIntro"
import { cx, focusRingCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import useFocusTrap from "../../lib/useFocusTrap"
import useModalDismiss from "../../lib/useModalDismiss"

// Copy rules (same as onboardingTour.js): short Thai sentences, no em dash, one idea per line.
const STEPS = [
  {
    key: "find",
    title: "ค้นหาฟังก์ชันได้จากช่องนี้",
    lines: ["พิมพ์คำที่นึกออก แล้วไปยังฟังก์ชันที่คุณใช้ได้ทันที", "ใช้ได้จากทุกหน้า"],
    queries: ["ลา", "สลิป", "รายงาน"],
    fallback: "พิมพ์ชื่อฟังก์ชันที่ต้องการ แล้วเลือกจากรายการ",
  },
  {
    key: "typos",
    title: "พิมพ์ผิดก็เจอ",
    lines: ["ไม่ใส่วรรณยุกต์ หรือพิมพ์ผิดบางตัว ก็ยังเจอ", "คำที่พูดกันทุกวันก็ใช้ได้"],
    queries: ["เงนเดือน", "แจง", "กู้"],
    fallback: "พิมพ์คำที่นึกออก ระบบจะหาฟังก์ชันที่ใกล้เคียงให้",
  },
  {
    key: "try",
    title: "ลองเลย",
    lines: ["กดปุ่มด้านล่าง แล้วพิมพ์ในช่องค้นหาได้เลย"],
    queries: [],
    tryWords: ["ลา", "สลิป", "กู้", "รายงาน"],
    fallback: "พิมพ์ชื่อฟังก์ชันที่ต้องการ",
  },
]

const DEMO_ROW_LIMIT = 3
const Z = 10045
const PAD = 6
const GAP = 12
const CARD_W = 400
const CARD_PADDED_W = CARD_W - 40

// Demo timeline, ms. One query takes about 4 seconds.
const BEFORE_TYPING = 300
const PER_CHARACTER = 120
const BEFORE_RESULTS = 220
const READ_RESULTS = 900
const CURSOR_TRAVEL = 380
const CURSOR_PRESS = 130
const AFTER_CLICK = 900
const CLEARING = 220
const BETWEEN_QUERIES = 300
const ROW_STAGGER = 40

// Cursor tip inside the demo stage: rests below the list, lands on the middle of the top row.
const CURSOR_REST = { x: CARD_PADDED_W - 60, y: 190 }
const CURSOR_ON_ROW = { x: CARD_PADDED_W - 130, y: 78 }

const IDLE_FRAME = { index: 0, typed: "", phase: "typing" }
const ROWS_RENDERED = new Set(["results", "aim", "press", "release", "clearing"])
const CURSOR_SHOWN = new Set(["aim", "press", "release"])

const subscribeVisibility = (fn) => {
  document.addEventListener("visibilitychange", fn)
  return () => document.removeEventListener("visibilitychange", fn)
}
const isTabVisible = () => document.visibilityState === "visible"

/** Plays the script on a loop while `running`. Every timer dies with the step or the overlay. */
function useDemoFrame(script, running) {
  const [frame, setFrame] = useState(IDLE_FRAME)

  useEffect(() => {
    if (!running || script.length === 0) return
    let timers = []
    const play = (index) => {
      timers = []
      const at = (ms, fn) => timers.push(setTimeout(fn, ms))
      const characters = Array.from(script[index].query)
      const show = (typed, phase) => setFrame({ index, typed, phase })

      at(0, () => show("", "typing"))
      let t = BEFORE_TYPING
      characters.forEach((_, n) => {
        t += PER_CHARACTER
        at(t, () => show(characters.slice(0, n + 1).join(""), "typing"))
      })
      const query = script[index].query
      at((t += BEFORE_RESULTS), () => show(query, "results"))
      at((t += READ_RESULTS), () => show(query, "aim"))
      at((t += CURSOR_TRAVEL), () => show(query, "press"))
      at((t += CURSOR_PRESS), () => show(query, "release"))
      at((t += AFTER_CLICK), () => show("", "clearing"))
      at((t += CLEARING + BETWEEN_QUERIES), () => play((index + 1) % script.length))
    }
    play(0)
    return () => timers.forEach(clearTimeout)
  }, [script, running])

  return frame
}

/** Same anatomy as the row in GlobalFunctionSearch.jsx. Keep the classes in step with it. */
function DemoRow({ hit, query, active, pressed, enterDelay }) {
  const { entry } = hit
  const Icon = entry.icon
  return (
    <div
      style={{ animationDelay: `${enterDelay}ms` }}
      className={cx(
        "animate-sheet-in flex items-center gap-3 rounded-xl px-2 py-1.5 transition-transform duration-100",
        active && "bg-indigo-50 dark:bg-white/[.06]",
        pressed && "scale-[.98]",
      )}
    >
      <span
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
            : "bg-gray-100 text-gray-600 dark:bg-white/[.06] dark:text-gray-300",
        )}
      >
        <Icon strokeWidth={1.75} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-5 text-gray-800 dark:text-gray-100">
          {highlightParts(hit.display, hit.ranges).map((part, i) =>
            part.match ? (
              <mark key={i} className="bg-transparent font-bold text-indigo-700 dark:text-indigo-300">
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </span>
        <span className="block truncate text-xs leading-5 text-gray-600 dark:text-gray-400">
          {hitSecondaryLine(hit, query)}
        </span>
      </span>
    </div>
  )
}

function DemoCursor({ phase }) {
  const shown = CURSOR_SHOWN.has(phase)
  const { x, y } = shown ? CURSOR_ON_ROW : CURSOR_REST
  return (
    <div
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, transitionDuration: shown ? `${CURSOR_TRAVEL}ms` : "0ms" }}
      className={cx(
        "absolute left-0 top-0 transition-[transform,opacity] ease-[cubic-bezier(.16,1,.3,1)]",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      <svg
        viewBox="0 0 20 22"
        className={cx(
          "size-5 origin-top-left drop-shadow-sm transition-transform duration-100",
          phase === "press" && "scale-[.82]",
        )}
      >
        <path
          d="M2 1.5v16.2l4.4-4 2.9 6.8 3-1.3-2.9-6.7 6.1-.3Z"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="fill-gray-900 stroke-white dark:fill-white dark:stroke-gray-900"
        />
      </svg>
    </div>
  )
}

/** The real box in its focused state. A drawing, not an input: the caret is a span. */
function DemoStage({ typed, typing, children }) {
  return (
    <div aria-hidden="true" className="pointer-events-none relative mt-3 select-none">
      <div className="relative flex h-[38px] items-center rounded-xl border border-indigo-400 bg-white pl-9 pr-9 text-sm ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-field dark:ring-1 dark:ring-indigo-400">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" strokeWidth={2} />
        <span className="whitespace-pre text-gray-900 dark:text-gray-100">{typed}</span>
        <span className={cx("h-4 w-px bg-indigo-600 dark:bg-indigo-300", !typing && "animate-pulse")} />
        {!typed && <span className="pl-px text-gray-500 dark:text-gray-400">ค้นหาฟังก์ชัน</span>}
        {typed && (
          <span className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-gray-500 dark:text-gray-400">
            <X className="size-4" strokeWidth={2} />
          </span>
        )}
      </div>
      {/* Three rows plus the panel's padding and border: reserved so the card never changes height. */}
      <div className="mt-2 h-[166px]">{children}</div>
    </div>
  )
}

const panelCls =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-line-strong dark:bg-raised"

/** Same look as the real panel's empty state. */
function HintPanel({ children }) {
  return <div className={cx(panelCls, "px-4 py-5 text-center text-xs leading-relaxed text-gray-600 dark:text-gray-400")}>{children}</div>
}

function SearchDemo({ step, script }) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  const tabVisible = useSyncExternalStore(subscribeVisibility, isTabVisible, isTabVisible)
  const played = useDemoFrame(script, !reduced && tabVisible)

  if (script.length === 0) {
    return (
      <DemoStage typed="" typing={false}>
        <HintPanel>{step.fallback}</HintPanel>
      </DemoStage>
    )
  }

  // Reduced motion: only the final frame of the first query, no typing and no cursor.
  const frame = reduced ? { index: 0, typed: script[0].query, phase: "results" } : played
  const { query, hits } = script[frame.index] ?? script[0]
  const { phase } = frame

  return (
    <DemoStage typed={frame.typed} typing={phase === "typing" && frame.typed !== ""}>
      {ROWS_RENDERED.has(phase) && (
        // Two layers: the inner entrance animation holds opacity, so the exit fade sits on the outer one.
        <div className={cx("transition-opacity duration-200", phase === "clearing" ? "opacity-0" : "opacity-100")}>
          <div key={frame.index} className={cx(panelCls, "animate-fade-in p-1")}>
            {hits.map((hit, i) => (
              <DemoRow
                key={hit.entry.id}
                hit={hit}
                query={query}
                active={i === 0}
                pressed={i === 0 && phase === "press"}
                enterDelay={reduced ? 0 : i * ROW_STAGGER}
              />
            ))}
          </div>
        </div>
      )}
      <DemoCursor phase={phase} />
    </DemoStage>
  )
}

/** Last step: the empty box, ready, with words that find something for this user. */
function TryDemo({ step, words }) {
  return (
    <DemoStage typed="" typing={false}>
      <HintPanel>
        {words.length === 0 ? (
          step.fallback
        ) : (
          <>
            ลองพิมพ์{" "}
            {words.map((word, i) => (
              <span key={word}>
                {i > 0 && (i === words.length - 1 ? " หรือ " : " ")}
                <b className="font-semibold text-indigo-700 dark:text-indigo-300">{word}</b>
              </span>
            ))}
          </>
        )}
      </HintPanel>
    </DemoStage>
  )
}

function Dots({ index }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
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

const readRect = (el) => {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export default function SearchIntro({ userId, onClose, onPostpone }) {
  const titleId = useId()
  const descId = useId()
  const cardRef = useRef(null)
  const primaryRef = useRef(null)
  const targetRef = useRef(null)
  const openerRef = useRef(null)
  const claimedRef = useRef(false) // survives StrictMode's second effect run, which would find it seen
  const [rect, setRect] = useState(null)
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [stepIndex, setStepIndex] = useState(0)
  const opened = rect !== null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  // The gate checked a moment ago, but the chunk may have taken a while: check again, then claim.
  useLayoutEffect(() => {
    if (claimedRef.current) return
    const target = findFunctionSearch()
    if (!target || isPageBusy()) {
      onPostpone()
      return
    }
    if (!claimSearchIntro(userId)) {
      onClose()
      return
    }
    claimedRef.current = true
    targetRef.current = target
    openerRef.current = document.activeElement
    setRect(readRect(target))
  }, [userId, onClose, onPostpone])

  // Real engine, this user's functions: the demo never lists what they can't open.
  const perms = useCan()
  const { scripts, tryWords } = useMemo(() => {
    const index = getFunctionSearchIndex()
    const visibleIds = visibleFunctionIds(perms)
    const search = (query) =>
      searchIndex(index, query, { limit: DEMO_ROW_LIMIT, isVisible: (entry) => visibleIds.has(entry.id) })
    return {
      // Only candidates that find something for this user.
      scripts: Object.fromEntries(
        STEPS.map((s) => [
          s.key,
          s.queries.map((query) => ({ query, hits: search(query) })).filter((item) => item.hits.length > 0),
        ]),
      ),
      tryWords: STEPS.flatMap((s) => s.tryWords ?? []).filter((word) => search(word).length > 0),
    }
  }, [perms])

  // Follow the box. If it goes away (window narrowed below md) there is nothing left to point at.
  useEffect(() => {
    if (!opened) return
    const measure = () => {
      const target = targetRef.current
      if (!target?.isConnected || target.getClientRects().length === 0) {
        onClose()
        return
      }
      setRect(readRect(target))
      setVp({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener("resize", measure)
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null
    observer?.observe(targetRef.current)
    return () => {
      window.removeEventListener("resize", measure)
      observer?.disconnect()
    }
  }, [opened, onClose])

  const dismiss = () => {
    const opener = openerRef.current
    onClose()
    if (opener && opener !== document.body && opener.isConnected) opener.focus?.({ preventScroll: true })
  }
  const finish = () => {
    const input = targetRef.current?.querySelector("input")
    onClose()
    input?.focus({ preventScroll: true })
  }

  useFocusTrap(cardRef, { active: opened, initialSelector: "[data-autofocus]", restoreFocus: false })
  useModalDismiss(dismiss, { open: opened })

  // Keyboard users keep their place on the main button as they step; "ย้อนกลับ" can vanish under them.
  useEffect(() => {
    if (opened) primaryRef.current?.focus({ preventScroll: true })
  }, [stepIndex, opened])

  if (!opened) return null

  const hole = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + 2 * PAD,
    height: rect.height + 2 * PAD,
  }
  const cardW = Math.min(CARD_W, vp.w - 2 * GAP)
  const cardLeft = Math.max(GAP, Math.min(hole.left, vp.w - cardW - GAP))
  const cardTop = hole.top + hole.height + GAP

  return (
    <Portal>
      <div style={{ zIndex: Z }} className="animate-fade-in fixed inset-0">
        {/* click shield: keeps focus where it is and doesn't dismiss */}
        <div className="absolute inset-0" aria-hidden="true" onMouseDown={(e) => e.preventDefault()} />
        <div
          aria-hidden="true"
          className="ob-spotlight pointer-events-none fixed rounded-[18px] outline-2 outline-white/80 shadow-[0_0_0_9999px_rgb(17_17_24/.55)] dark:outline-indigo-300/70 dark:shadow-[0_0_0_9999px_rgb(0_0_0/.72)]"
          style={hole}
        />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {`ขั้นที่ ${stepIndex + 1} จาก ${STEPS.length}: ${step.title}`}
        </p>

        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          style={{ top: cardTop, left: cardLeft, width: cardW, maxHeight: vp.h - cardTop - GAP }}
          className="animate-dialog-in fixed flex origin-top flex-col rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-gray-200 focus:outline-none dark:bg-surface dark:shadow-black/60 dark:ring-line-strong"
        >
          <button
            type="button"
            onClick={dismiss}
            className={cx(
              "absolute right-3 top-3 z-10 inline-flex min-h-8 cursor-pointer items-center rounded-lg px-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
              focusRingCls,
            )}
          >
            ข้าม
          </button>

          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-1">
            <div className="flex items-start gap-3">
              {/* Stays mounted across steps so her state machine keeps running. */}
              <Mascot
                mood={isLast ? "success" : "onboard"}
                point="up"
                size={104}
                tappable
                className="-my-1 -ml-2 shrink-0"
              />
              {/* Every step sits in one grid cell, so the tallest copy sets the height for all of them. */}
              <div className="grid min-w-0 flex-1">
                {STEPS.map((s, i) => (
                  <div
                    key={s.key}
                    className={cx("[grid-area:1/1]", i === stepIndex ? "animate-fade-in" : "invisible")}
                  >
                    <h2
                      id={i === stepIndex ? titleId : undefined}
                      className="pr-10 text-lg font-bold leading-snug text-gray-900 text-balance dark:text-gray-100"
                    >
                      {s.title}
                    </h2>
                    <div id={i === stepIndex ? descId : undefined} className="mt-1">
                      {s.lines.map((line) => (
                        <p key={line} className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* key: a new step starts a new demo, and unmounting the old one clears its timers */}
            {step.tryWords ? (
              <TryDemo key={step.key} step={step} words={tryWords} />
            ) : (
              <SearchDemo key={step.key} step={step} script={scripts[step.key]} />
            )}
          </div>

          <div className="mt-4 flex shrink-0 items-center justify-between gap-2">
            <Dots index={stepIndex} />
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex(stepIndex - 1)}
                  className={cx(neutralBtnCls, "whitespace-nowrap px-3")}
                >
                  <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} />
                  ย้อนกลับ
                </button>
              )}
              <button
                ref={primaryRef}
                type="button"
                data-autofocus
                onClick={isLast ? finish : () => setStepIndex(stepIndex + 1)}
                className={cx(primaryBtnCls, "whitespace-nowrap")}
              >
                {isLast ? "เริ่มค้นหา" : "ถัดไป"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
