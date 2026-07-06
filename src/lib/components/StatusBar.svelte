<script lang="ts">
  import { app } from "../state.svelte";

  const statusText = $derived.by(() => {
    switch (app.runnerStatus) {
      case "booting":
        return "Python wird geladen …";
      case "ready":
        return "Bereit";
      case "running":
        return "Läuft …";
      case "awaiting-input":
        return "Wartet auf Eingabe";
      case "error":
        return `Fehler: ${app.statusDetail}`;
    }
  });

  let online = $state(navigator.onLine);
  $effect(() => {
    const set = () => (online = navigator.onLine);
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  });
</script>

<footer class="statusbar" class:error={app.runnerStatus === "error"}>
  <div class="left">
    <span class="item">
      <span
        class="dot"
        class:pulse={app.runnerStatus === "booting" ||
          app.runnerStatus === "running"}
      ></span>
      {statusText}
    </span>
    {#if !online}
      <span class="item">⚡ Offline-Modus</span>
    {/if}
  </div>
  <div class="right">
    {#if app.pythonVersion}
      <span class="item">Python {app.pythonVersion} (Pyodide)</span>
    {/if}
    <span class="item">{app.theme === "dark" ? "Dark" : "Light"}</span>
  </div>
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: calc(22px + env(safe-area-inset-bottom, 0px));
    padding: 0 10px env(safe-area-inset-bottom, 0px);
    background: var(--statusbar-bg);
    color: var(--statusbar-fg);
    font-size: 12px;
    user-select: none;
    flex-shrink: 0;
  }
  @media (pointer: coarse) {
    .statusbar {
      height: calc(28px + env(safe-area-inset-bottom, 0px));
    }
  }
  .statusbar.error {
    background: var(--error);
  }
  .left,
  .right {
    display: flex;
    gap: 14px;
    min-width: 0;
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.25;
    }
  }
</style>
