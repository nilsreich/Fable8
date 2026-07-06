/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { clientsClaim } from "workbox-core";
import {
  precache,
  matchPrecache,
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
// precache() only fills the cache; routing happens below in priority order.
precache(self.__WB_MANIFEST);

/**
 * Injects the cross-origin-isolation headers that SharedArrayBuffer
 * requires (same trick as coi-serviceworker) — static hosts usually cannot
 * send them. The document needs COOP/COEP, and under require-corp every
 * same-origin subresource (especially the worker script!) must carry the
 * headers as well, otherwise the Pyodide worker is blocked.
 */
function withCoiHeaders(response: Response): Response {
  if (response.status === 0) return response; // opaque
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Navigations: precached index.html + isolation headers.
const navigationHandler = createHandlerBoundToURL("index.html");
registerRoute(
  new NavigationRoute(async (params) =>
    withCoiHeaders(await navigationHandler(params)),
  ),
);

// Same-origin assets: precache first, network fallback — always with headers.
registerRoute(
  ({ sameOrigin }) => sameOrigin,
  async ({ request, url }) => {
    const cached = await matchPrecache(url.href);
    return withCoiHeaders(cached ?? (await fetch(request)));
  },
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
