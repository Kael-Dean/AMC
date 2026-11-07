// src/pages/admin/PreviewBar.jsx
// The indicator every preview shows, with the way out. Above every overlay (z-stack top is the
// Toaster, 10080), so nothing a preview opens can cover it.
//   placement "strip"  full width across the top (phones, and the full-screen wizard)
//   placement "corner" compact, bottom right from md up: the search box being spotlighted is in the
//                      header, and the install card sits bottom left
// Overlays give it room: index.css `body[data-preview-active] [role="dialog"][aria-labelledby]`.
//
// Esc ends the preview unless something inside it should take that key first: an open dialog,
// a dropdown, or a field being typed in. `escapeAlways` is for the tour, whose whole screen is
// its dialog; focus can leave its card and Esc would otherwise do nothing.
import { useEffect } from "react"
import { Eye, X } from "lucide-react"
import { cx, focusRingCls } from "../../lib/styles"
import { PREVIEW_LABEL } from "./previewSession"

const Z = 10090
const TAKES_ESCAPE = '[role="dialog"], [role="alertdialog"], [role="listbox"], [aria-expanded="true"][aria-haspopup]'
const EDITABLE = "input, textarea, select, [contenteditable='true']"

export const STRIP_HEIGHT_CLS = "h-11"

export default function PreviewBar({ onExit, placement = "corner", escapeAlways = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return
      if (!escapeAlways) {
        if (document.activeElement?.matches?.(EDITABLE)) return
        if ([...document.querySelectorAll(TAKES_ESCAPE)].some((el) => el.getClientRects().length > 0)) return
      }
      onExit()
    }
    // Capture: decide before anything closes, so one Esc can't close a sheet and leave the preview too.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onExit, escapeAlways])

  return (
    <div
      role="status"
      style={{ zIndex: Z }}
      className={cx(
        "fixed flex items-center gap-2 bg-amber-100 pl-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
        "ring-1 ring-amber-300 dark:ring-amber-700",
        placement === "strip"
          ? cx("inset-x-0 top-0 pr-1", STRIP_HEIGHT_CLS)
          : cx(
              "inset-x-0 top-0 pr-1 md:inset-x-auto md:top-auto md:right-3 md:bottom-3 md:rounded-xl md:shadow-lg",
              STRIP_HEIGHT_CLS,
              "md:pointer-fine:h-10",
            ),
      )}
    >
      <Eye aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight md:flex-none">{PREVIEW_LABEL}</span>
      <button
        type="button"
        onClick={onExit}
        data-preview-exit
        className={cx(
          "inline-flex min-h-touch shrink-0 cursor-pointer items-center gap-1 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-150",
          "hover:bg-amber-200 md:pointer-fine:min-h-8 dark:hover:bg-amber-900",
          focusRingCls,
          "focus-visible:ring-offset-amber-100 dark:focus-visible:ring-offset-amber-950",
        )}
      >
        <X aria-hidden="true" strokeWidth={2} className="size-4" />
        ออก
      </button>
    </div>
  )
}
