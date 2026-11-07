// src/pages/admin/previewSession.js
// ─────────────────────────────────────────────────────────────────────────────
// Starts and stops an onboarding preview, and raises the network wall for as long as it runs.
//
// The wall is the last line of defence: every preview already skips its own saves, so it should
// never fire. It covers what a preview can't see coming, such as a real page behind the tour
// writing something on load, and anything reached through the non-modal install card.
// A blocked call answers 400 with a FastAPI-style `detail`, so the caller shows a normal error.
// It reports through console.warn, which is how the QA run counts attempts.
// ─────────────────────────────────────────────────────────────────────────────
import { getPreview, setPreview } from "../../lib/previewMode"

export const PREVIEW_LABEL = "โหมดตัวอย่าง ไม่บันทึกข้อมูล"
const BLOCKED_MESSAGE = `${PREVIEW_LABEL} ออกจากโหมดตัวอย่างก่อนแล้วลองอีกครั้ง`
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const isRead = (method) => READ_METHODS.has(String(method || "GET").toUpperCase())

let restoreWall = null

function raiseWall() {
  if (restoreWall) return
  const realFetch = window.fetch
  const proto = window.XMLHttpRequest?.prototype
  const realOpen = proto?.open
  const realSend = proto?.send
  const realBeacon = navigator.sendBeacon
  const blockedMethod = new WeakMap()

  window.fetch = (input, init) => {
    const method = init?.method ?? (typeof input === "object" ? input?.method : undefined)
    if (isRead(method)) return realFetch(input, init)
    const url = typeof input === "string" ? input : (input?.url ?? String(input))
    console.warn(`[onboarding preview] blocked ${method} ${url}`)
    return Promise.resolve(
      new Response(JSON.stringify({ detail: BLOCKED_MESSAGE }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    )
  }
  if (proto) {
    proto.open = function open(method, url, ...rest) {
      if (isRead(method)) blockedMethod.delete(this)
      else blockedMethod.set(this, `${method} ${url}`)
      return realOpen.call(this, method, url, ...rest)
    }
    proto.send = function send(...args) {
      const blocked = blockedMethod.get(this)
      if (!blocked) return realSend.apply(this, args)
      console.warn(`[onboarding preview] blocked ${blocked}`)
      // Same outcome as a dropped connection: lib/files.js reports it through its error handler.
      this.dispatchEvent(new Event("error"))
      return undefined
    }
  }
  if (realBeacon) {
    navigator.sendBeacon = (url) => {
      console.warn(`[onboarding preview] blocked beacon ${url}`)
      return false
    }
  }

  restoreWall = () => {
    window.fetch = realFetch
    if (proto) {
      proto.open = realOpen
      proto.send = realSend
    }
    if (realBeacon) navigator.sendBeacon = realBeacon
    restoreWall = null
  }
}

/** `trigger` = the gallery row whose button gets focus back when the preview ends. */
export function startPreview(kind, trigger = kind) {
  raiseWall()
  document.body.dataset.previewActive = "1" // index.css: overlays leave room for the preview bar
  setPreview({ kind, trigger })
}

export function stopPreview() {
  if (!getPreview()) return
  setPreview(null)
  delete document.body.dataset.previewActive
  restoreWall?.()
}
