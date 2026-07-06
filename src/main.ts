import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { app } from "./lib/state.svelte";
import { setupViewport } from "./lib/viewport";

type CoiResult =
  | { state: "ok" }
  | { state: "reloading" }
  | { state: "failed"; message: string };

/**
 * Cross-origin isolation bootstrap: SharedArrayBuffer (synchronous Python
 * input()) needs COOP/COEP headers. The dev/preview servers send them
 * directly; in production the service worker injects them — but it controls
 * the page only from the second load on, so we reload once as soon as it has
 * taken control.
 */
async function ensureCrossOriginIsolation(): Promise<CoiResult> {
  // Register the service worker in any case (precache/offline/updates).
  let swAvailable = false;
  if (!import.meta.env.DEV && "serviceWorker" in navigator) {
    try {
      const { registerSW } = await import("virtual:pwa-register");
      registerSW({ immediate: true });
      swAvailable = true;
    } catch {
      swAvailable = false;
    }
  }

  if (crossOriginIsolated) {
    sessionStorage.removeItem("coi-reloaded");
    return { state: "ok" };
  }

  // SharedArrayBuffer additionally requires a secure context — COOP/COEP
  // headers alone don't help over plain http:// (e.g. a LAN IP).
  if (!isSecureContext) {
    return {
      state: "failed",
      message:
        "Python benötigt eine sichere Verbindung: Bitte die Seite über HTTPS oder http://localhost öffnen (nicht über eine IP-Adresse).",
    };
  }

  if (!swAvailable) {
    return {
      state: "failed",
      message:
        "SharedArrayBuffer nicht verfügbar: Der Server muss die Header Cross-Origin-Opener-Policy/Embedder-Policy senden.",
    };
  }

  // Only try the automatic reload once per tab (guards against loops and
  // against hard refreshes that bypass the service worker).
  if (sessionStorage.getItem("coi-reloaded")) {
    return {
      state: "failed",
      message:
        "Cross-Origin-Isolation konnte nicht aktiviert werden. Bitte die Seite einmal neu laden.",
    };
  }

  try {
    await navigator.serviceWorker.ready;
  } catch {
    return {
      state: "failed",
      message: "Service Worker konnte nicht gestartet werden.",
    };
  }
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        { once: true },
      );
      setTimeout(resolve, 8000);
    });
  }
  // Reload only when the SW actually controls the page — an uncontrolled
  // reload would be served without the injected headers and waste the
  // one automatic attempt.
  if (!navigator.serviceWorker.controller) {
    return {
      state: "failed",
      message:
        "Service Worker hat die Seite noch nicht übernommen. Bitte die Seite neu laden.",
    };
  }
  sessionStorage.setItem("coi-reloaded", "1");
  location.reload();
  return { state: "reloading" };
}

async function bootstrap() {
  setupViewport();
  mount(App, { target: document.getElementById("app")! });
  const coi = await ensureCrossOriginIsolation();
  if (coi.state === "reloading") {
    void app.init({
      startRunner: false,
      runnerBlockedMessage: "Python wird aktiviert, Seite lädt gleich neu …",
    });
    return;
  }
  void app.init({
    runnerBlockedMessage: coi.state === "failed" ? coi.message : undefined,
  });
}

void bootstrap();
