// src/components/GlobalFunctionSearch.jsx
// Topbar search: type a word, jump to any function this user can open (desktop only;
// the Topbar's wrapper hides it below md).
//   list + permissions  lib/functionCatalogue.js
//   matching            lib/functionSearch.js
//
// Combobox: focus stays in the input; ↑/↓ wrap, Enter opens the active row (first by default),
// Esc clears then blurs, Tab or an outside click closes. The panel is portaled to <body> with fixed
// coords and z-index 10050 like SelectDropdown, so sticky table scrollbars can't cover it.
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { Lock, Search, X } from "lucide-react"
import { useCan } from "../lib/permissions"
import { useOnboarding } from "../lib/onboarding"
import { goToOnboardingFromLocked } from "../lib/onboardingGate"
import { backState } from "../lib/drill"
import useAnchoredPanel from "../lib/useAnchoredPanel"
import { useIsPhone } from "../hooks/useMediaQuery"
import { getFunctionSearchIndex, visibleFunctionIds } from "../lib/functionCatalogue"
import { highlightParts, searchIndex } from "../lib/functionSearch"

const PANEL_Z = 10050
const PANEL_MAX_H = 440 // 8 rows of two lines
const PANEL_MIN_W = 360
const PANEL_MAX_W = 560
const RESULT_LIMIT = 8
const MAX_QUERY_LENGTH = 80
const LONG_KEYWORD = 24 // a longer match is a sentence: show what the user typed instead

function secondaryLine(hit, query, locked) {
  if (locked) return "เปิดเมื่อกรอกข้อมูลเริ่มต้นครบ"
  if (hit.ranges) return hit.entry.group
  const word = hit.keyword && hit.keyword.length <= LONG_KEYWORD ? hit.keyword : query
  return `คำค้น: ${word} · ${hit.entry.group}`
}

export default function GlobalFunctionSearch() {
  const navigate = useNavigate()
  const perms = useCan()
  const { locked: onboardingLocked } = useOnboarding()
  const isPhone = useIsPhone()

  const [query, setQuery] = useState("")
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  const uid = useId()
  const listId = `${uid}-listbox`
  const optId = (i) => `${uid}-opt-${i}`

  const trimmed = query.trim()
  const hasQuery = trimmed.length > 0

  // Re-evaluated when perms change: permissions loading, or Super Admin acting as another role.
  const visibleIds = useMemo(() => (hasQuery ? visibleFunctionIds(perms) : null), [hasQuery, perms])
  const results = useMemo(
    () =>
      visibleIds
        ? searchIndex(getFunctionSearchIndex(), trimmed, {
            limit: RESULT_LIMIT,
            isVisible: (entry) => visibleIds.has(entry.id),
          })
        : [],
    [trimmed, visibleIds],
  )

  const open = panelOpen && hasQuery && !isPhone
  const active = results.length ? Math.min(activeIdx, results.length - 1) : -1

  const { style: panelStyle } = useAnchoredPanel(rootRef, {
    open,
    maxH: PANEL_MAX_H,
    minW: PANEL_MIN_W,
    maxW: PANEL_MAX_W,
  })

  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId is derived from a stable useId
  }, [open, active])

  // Panel is portaled: outside means outside both the input box and the panel.
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setPanelOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const reset = () => {
    setQuery("")
    setActiveIdx(0)
    setPanelOpen(false)
  }

  const openHit = (hit) => {
    const { entry } = hit
    const locked = entry.gated && onboardingLocked
    reset()
    inputRef.current?.blur()
    if (locked) {
      goToOnboardingFromLocked(navigate, entry.label)
    } else if (entry.params) {
      // A sub-tab or report (lib/drill.js): the Topbar back button returns to where the user was.
      navigate(entry.to, { state: backState() })
      // AppLayout only scrolls up when the pathname changes; another tab of this page starts at the top too.
      window.scrollTo({ top: 0 })
    } else {
      navigate(entry.to)
    }
  }

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    const n = results.length
    switch (e.key) {
      case "ArrowDown":
        if (!hasQuery) return
        e.preventDefault()
        if (!open) setPanelOpen(true)
        else if (n) setActiveIdx((active + 1) % n)
        return
      case "ArrowUp":
        if (!hasQuery) return
        e.preventDefault()
        if (!open) setPanelOpen(true)
        else if (n) setActiveIdx((active - 1 + n) % n)
        return
      case "Enter":
        if (open && active >= 0) {
          e.preventDefault()
          openHit(results[active])
        }
        return
      case "Escape":
        e.preventDefault()
        if (query) reset()
        else e.currentTarget.blur()
        return
      case "Tab":
        setPanelOpen(false)
        return
      default:
    }
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs md:max-w-sm lg:max-w-md">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="ค้นหาฟังก์ชัน"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="ค้นหาฟังก์ชัน"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIdx(0)
          setPanelOpen(true)
        }}
        onFocus={() => setPanelOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-500 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-line-field dark:bg-field dark:text-gray-100 dark:placeholder:text-gray-400 dark:hover:border-line-field-hover dark:focus:border-indigo-400 dark:focus:bg-field dark:focus:ring-1 dark:focus:ring-indigo-400"
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        strokeWidth={2}
      />
      {query && (
        <button
          type="button"
          aria-label="ล้างคำค้น"
          title="ล้างคำค้น"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            reset()
            inputRef.current?.focus({ preventScroll: true })
          }}
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-200/70 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-white/[.08] dark:hover:text-gray-100"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      )}

      {/* Screen readers don't see the panel change while focus stays in the input. */}
      <span role="status" className="sr-only">
        {open ? (results.length ? `พบ ${results.length} รายการ` : `ไม่พบฟังก์ชันที่ตรงกับ ${trimmed}`) : ""}
      </span>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ ...panelStyle, zIndex: PANEL_Z }}
          // Focus stays in the input while clicking a row or dragging the scrollbar.
          onMouseDown={(e) => e.preventDefault()}
          className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-line-strong dark:bg-raised dark:shadow-2xl dark:shadow-black/60"
        >
          {results.length === 0 ? (
            <div id={listId} role="listbox" aria-label="ผลการค้นหาฟังก์ชัน" className="px-4 py-5 text-center">
              <p className="break-words text-sm font-medium text-gray-800 dark:text-gray-100">
                ไม่พบฟังก์ชันที่ตรงกับ “{trimmed}”
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                ลองคำที่สั้นลง หรือคำที่ใช้เรียกงานนั้น เช่น ลา สลิป กู้ ซื้อข้าว
              </p>
            </div>
          ) : (
            <div
              id={listId}
              role="listbox"
              aria-label="ผลการค้นหาฟังก์ชัน"
              className="min-h-0 flex-1 overflow-auto overscroll-contain p-1"
            >
              {results.map((hit, idx) => {
                const { entry } = hit
                const Icon = entry.icon
                const isActive = idx === active
                const locked = entry.gated && onboardingLocked
                return (
                  <div
                    key={entry.id}
                    id={optId(idx)}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={locked || undefined}
                    onMouseMove={() => { if (!isActive) setActiveIdx(idx) }}
                    onClick={() => openHit(hit)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 ${
                      isActive ? "bg-indigo-50 dark:bg-white/[.06]" : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        locked
                          ? "bg-gray-100 text-gray-400 dark:bg-white/[.05] dark:text-gray-500"
                          : isActive
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                            : "bg-gray-100 text-gray-600 dark:bg-white/[.06] dark:text-gray-300"
                      }`}
                    >
                      <Icon strokeWidth={1.75} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        title={hit.display}
                        className={`block truncate text-sm font-medium leading-5 ${
                          locked ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"
                        }`}
                      >
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
                        {secondaryLine(hit, trimmed, locked)}
                      </span>
                    </span>
                    {locked && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/[.06] dark:text-gray-300">
                        <Lock aria-hidden="true" className="size-3" strokeWidth={2.25} />
                        ล็อก
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
