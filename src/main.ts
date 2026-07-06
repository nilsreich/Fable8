import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { app } from "./lib/state.svelte";

/**
 * Cross-origin isolation bootstrap: SharedArrayBuffer (synchronous Python
 * input()) needs COOP/COEP headers. In production the service worker injects
 * them, but it controls the page only after the first load — so reload once
 * as soon as it takes control.
 */
async function setupServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
  if (!crossOriginIsolated && !sessionStorage.getItem("coi-reloaded")) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      sessionStorage.setItem("coi-reloaded", "1");
      location.reload();
    });
  }
}

void setupServiceWorker();

mount(App, { target: document.getElementById("app")! });
void app.init();
