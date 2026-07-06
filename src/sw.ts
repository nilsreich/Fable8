/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { clientsClaim } from "workbox-core";
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// App shell + pyodide core (wasm, stdlib) — fully available offline.
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Serve navigations from the precached index.html and inject the
 * cross-origin-isolation headers that SharedArrayBuffer requires
 * (the same trick as coi-serviceworker). Static hosts usually cannot
 * send these headers themselves.
 */
const navigationHandler = createHandlerBoundToURL("index.html");
registerRoute(
  new NavigationRoute(async (params) => {
    const response = await navigationHandler(params);
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }),
);

// Python package wheels (numpy, matplotlib, ...) from the pyodide CDN.
// Versioned URLs → cache-first is safe; once fetched they work offline.
registerRoute(
  ({ url }) =>
    url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/pyodide/"),
  new CacheFirst({
    cacheName: "pyodide-packages",
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, purgeOnQuotaError: false }),
    ],
  }),
);
