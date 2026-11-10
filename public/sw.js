// public/sw.js: hand-written service worker (installable app, no offline data).
//
// Security rule: API responses and HTML are NEVER cached. Everything except
// navigations and /assets/* is left alone (no respondWith), so the browser
// handles it exactly as if this worker did not exist.
//
// Deploy: bump VERSION only when this file's caching behaviour changes.
// Kill switch: never delete this file (a 404 fails the update and the old worker
// stays). Replace it with one that calls self.skipWaiting() on install and, on
// activate, deletes every cache and calls self.registration.unregister().

const VERSION = "v1"
const STATIC_CACHE = `amc-static-${VERSION}` // offline page + icons
const ASSET_CACHE = `amc-assets-${VERSION}` // /assets/* (hashed, immutable)
const OFFLINE_URL = "/offline.html"
const MAX_ASSETS = 300 // oldest entries go first; deploys delete old hashes from the bucket

const PRECACHE = [
  OFFLINE_URL,
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/maskable-512.png",
  "/pwa/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      const keep = new Set([STATIC_CACHE, ASSET_CACHE])
      const names = await caches.keys()
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event))
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(handleAsset(event))
  }
})

// Network only, never stored. A 404 from the bucket carrying index.html passes
// through untouched (that is how deep routes work on GCS); only a real network
// error falls back to the offline page.
async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse
    if (preloaded) return preloaded
    return await fetch(event.request)
  } catch {
    const cache = await caches.open(STATIC_CACHE)
    return (await cache.match(OFFLINE_URL)) || Response.error()
  }
}

// Cache-first. Stores only a real asset: the bucket answers a missing file with
// index.html as a 404, an SPA host may do the same as a 200 (a cached copy would
// break that chunk for good), and a 206 partial cannot be stored at all.
async function handleAsset(event) {
  const cache = await caches.open(ASSET_CACHE)
  const hit = await cache.match(event.request)
  if (hit) return hit

  const response = await fetch(event.request)
  const isHtml = (response.headers.get("content-type") || "").includes("text/html")
  if (response.status === 200 && !isHtml) {
    const copy = response.clone()
    event.waitUntil(
      cache
        .put(event.request, copy)
        .then(() => trimAssets(cache))
        .catch(() => {}) // quota errors must not break the page
    )
  }
  return response
}

async function trimAssets(cache) {
  const keys = await cache.keys()
  const excess = keys.length - MAX_ASSETS
  if (excess <= 0) return
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}
