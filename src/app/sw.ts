/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate, type RuntimeCaching } from "serwist";

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: Array<{ url: string; revision?: string | null }> };

const privateCachePrefix = "vicgym-";
const expiration = (maxEntries: number, maxAgeSeconds: number) => new ExpirationPlugin({ maxEntries, maxAgeSeconds, maxAgeFrom: "last-used" });

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  ...(["POST", "PUT", "PATCH", "DELETE"] as const).map((method): RuntimeCaching => ({
    method,
    matcher: ({ sameOrigin }) => sameOrigin,
    handler: new NetworkOnly(),
  })),
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/media/"),
    handler: new CacheFirst({ cacheName: `${privateCachePrefix}workout-media-v1`, plugins: [expiration(80, 90 * 24 * 60 * 60)] }),
  },
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && (url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|ico|svg|png)$/.test(url.pathname)),
    handler: new StaleWhileRevalidate({ cacheName: `${privateCachePrefix}static-v1`, plugins: [expiration(100, 30 * 24 * 60 * 60)] }),
  },
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({ cacheName: `${privateCachePrefix}pages-v1`, networkTimeoutSeconds: 4, plugins: [expiration(40, 7 * 24 * 60 * 60)] }),
  },
  {
    matcher: ({ sameOrigin, request, url }) => sameOrigin && request.method === "GET" && url.pathname.startsWith("/_next/") && request.headers.get("RSC") === "1",
    handler: new NetworkFirst({ cacheName: `${privateCachePrefix}rsc-v1`, networkTimeoutSeconds: 4, plugins: [expiration(60, 7 * 24 * 60 * 60)] }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: { entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }] },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "VICGYM_CLEAR_PRIVATE_CACHES") event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(privateCachePrefix)) await caches.delete(name);
  })());
  if (event.data?.type === "VICGYM_PREPARE_WORKOUT") event.waitUntil((async () => {
    const urls: string[] = Array.isArray(event.data.urls) ? event.data.urls.filter((url: unknown): url is string => typeof url === "string" && url.startsWith("/")) : [];
    const pageCache = await caches.open(`${privateCachePrefix}pages-v1`); const mediaCache = await caches.open(`${privateCachePrefix}workout-media-v1`);
    await Promise.all(urls.map(async (url) => { try { const request = new Request(url, { credentials: "same-origin" }); const response = await fetch(request); if (response.ok) await (url.startsWith("/media/") ? mediaCache : pageCache).put(request, response); } catch { /* Preparation is best-effort; runtime caching can fill later. */ } }));
  })());
});

self.addEventListener("sync", (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil(promise: Promise<unknown>): void };
  if (syncEvent.tag !== "vicgym-outbox") return;
  syncEvent.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: "VICGYM_SYNC_REQUESTED" });
  })());
});

serwist.addEventListeners();
