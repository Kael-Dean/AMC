// src/lib/pwa.js
// ─────────────────────────────────────────────────────────────────────────────
// Installable app plumbing (no Context, project rule).
//
//   registerSW()              production only, never in the demo build
//   isStandalone()            running as the installed app
//   isIOSLike()               iPhone / iPad, including iPadOS reporting as a Mac
//   isMobileStandalone()      installed app on a phone/tablet, where popups and print are unreliable
//   detectInstallPlatform()   which device and browser this is, to preselect the install guide
//   useInstallOption()        "prompt" | "ios" | "guide" | null (null = already the installed app)
//   useAppInstalled()         true after `appinstalled` fired in this page
//   promptInstall()           shows the captured browser prompt
//
// `beforeinstallprompt` can fire before React mounts, so it is captured when this
// module is imported (src/main.jsx imports it).
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"

let deferredPrompt = null
let installedHere = false
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault() // no browser mini-infobar: the guide is the only entry point
    deferredPrompt = e
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    installedHere = true
    notify()
  })
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || window.navigator.standalone === true
}

export function isIOSLike(nav = window.navigator) {
  const { userAgent, platform, maxTouchPoints } = nav
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  return /Mac/.test(platform || userAgent) && maxTouchPoints > 1
}

// Order matters: Messenger's user agent can also carry the Facebook markers.
const IN_APP_BROWSERS = [
  ["LINE", /\bLine\/|\bLIFF\b/i],
  ["Messenger", /Orca-Android|MessengerForiOS|FB_IAB\/MESSENGER|\bMessenger\b/i],
  ["Instagram", /Instagram/i],
  ["Facebook", /FBAN|FBAV|FB_IAB|FBIOS|FB4A/],
]

// Order matters: Edge and Samsung also say Chrome, and all of them say Safari.
function browserFromUA(ua) {
  if (/SamsungBrowser\//.test(ua)) return "samsung"
  if (/Edg(e|A|iOS)?\//.test(ua)) return "edge"
  if (/Firefox\/|FxiOS\//.test(ua)) return "firefox"
  if (/OPR\/|OPiOS\/|Vivaldi\/|YaBrowser\/|UCBrowser\/|MiuiBrowser\/|HuaweiBrowser\//.test(ua)) return "other"
  if (/Chrome\/|CriOS\//.test(ua)) return "chrome"
  if (/Safari\//.test(ua)) return "safari"
  return "other"
}

/**
 * Safari's own version matches iOS from 26 on. Without it (Chrome, in-app browsers) only "OS x_y" is left,
 * and iOS 26 froze that at 18_6, so 18 could be 18 or anything newer: null means unknown.
 */
function iosMajorFromUA(ua) {
  const version = ua.match(/Version\/(\d+)/)
  if (version) return Number(version[1])
  const os = ua.match(/\bOS (\d+)_/)
  return os && Number(os[1]) < 18 ? Number(os[1]) : null
}

/**
 * Pure: reads only the navigator-like object it is given.
 * Returns { platform: "desktop" | "android" | "ios", browser: "chrome" | "edge" | "safari" | "samsung" |
 * "firefox" | "other", inApp: "LINE" | "Facebook" | "Messenger" | "Instagram" | null, iosMajor: number | null }.
 */
export function detectInstallPlatform(nav = window.navigator) {
  const ua = nav.userAgent || ""
  const ios = isIOSLike(nav)
  return {
    platform: ios ? "ios" : /Android/i.test(ua) ? "android" : "desktop",
    browser: browserFromUA(ua),
    inApp: IN_APP_BROWSERS.find(([, re]) => re.test(ua))?.[0] ?? null,
    iosMajor: ios ? iosMajorFromUA(ua) : null,
  }
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

// Not tied to the browser event: Chrome may hold `beforeinstallprompt` back until it sees enough
// engagement, and the guide's manual steps work without it. Only an installed app has no entry point.
function getInstallOption() {
  if (isStandalone()) return null
  if (deferredPrompt) return "prompt"
  return isIOSLike() ? "ios" : "guide"
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useInstallOption() {
  return useSyncExternalStore(subscribe, getInstallOption)
}

export function useAppInstalled() {
  return useSyncExternalStore(subscribe, () => installedHere)
}

/** Shows the captured prompt. The event is single-use; the browser fires a new one when it can offer again. */
export async function promptInstall() {
  const event = deferredPrompt
  if (!event) return
  deferredPrompt = null
  notify()
  await event.prompt()
}
