// src/lib/pwa.js
// ─────────────────────────────────────────────────────────────────────────────
// Installable app plumbing (no Context, project rule).
//
//   registerSW()              production only, never in the demo build
//   isStandalone()            running as the installed app
//   isIOSLike()               iPhone / iPad, including iPadOS reporting as a Mac
//   isMobileStandalone()      installed app on a phone/tablet, where popups and print are unreliable
//   useInstallOption()        "prompt" | "ios" | null, for the Sidebar menu item
//   promptInstall()           shows the captured browser prompt
//
// `beforeinstallprompt` can fire before React mounts, so it is captured when this
// module is imported (src/main.jsx imports it).
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"

let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault() // no browser mini-infobar: the menu item is the only entry point
    deferredPrompt = e
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    notify()
  })
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || window.navigator.standalone === true
}

export function isIOSLike() {
  const { userAgent, platform, maxTouchPoints } = window.navigator
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  return /Mac/.test(platform || userAgent) && maxTouchPoints > 1
}

export function isMobileStandalone() {
  return isStandalone() && (isIOSLike() || /Android/i.test(window.navigator.userAgent))
}

export function registerSW() {
  if (!import.meta.env.PROD || import.meta.env.VITE_DEMO === "1") return
  if (!("serviceWorker" in navigator)) return
  const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {})
  if (document.readyState === "complete") register()
  else window.addEventListener("load", register, { once: true })
}

function getInstallOption() {
  if (isStandalone()) return null
  if (deferredPrompt) return "prompt"
  return isIOSLike() ? "ios" : null
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useInstallOption() {
  return useSyncExternalStore(subscribe, getInstallOption)
}

/** Shows the captured prompt. The event is single-use; the browser fires a new one when it can offer again. */
export async function promptInstall() {
  const event = deferredPrompt
  if (!event) return
  deferredPrompt = null
  notify()
  await event.prompt()
}
