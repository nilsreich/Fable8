<script lang="ts">
  import { app } from "./lib/state.svelte";
  import TitleBar from "./lib/components/TitleBar.svelte";
  import ActivityBar from "./lib/components/ActivityBar.svelte";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import EditorPane from "./lib/components/EditorPane.svelte";
  import Panel from "./lib/components/Panel.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";

  $effect(() => {
    document.documentElement.dataset.theme = app.theme;
  });

  $effect(() => {
    document.documentElement.dataset.beamer = app.beamer ? "1" : "0";
  });

  let resizingSidebar = $state(false);

  function startSidebarResize(event: PointerEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    resizingSidebar = true;
    const startX = event.clientX;
    const startWidth = app.sidebarWidth;
    const move = (e: PointerEvent) => {
      app.sidebarWidth = Math.min(
        Math.max(startWidth + e.clientX - startX, 140),
        500,
      );
    };
    const up = () => {
      resizingSidebar = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Keep the panel usable when the viewport shrinks (rotation, keyboard):
  // clamp its height so at least ~80px of editor remain visible.
  $effect(() => {
    const clamp = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      const max = Math.max(height - 160, 80);
      if (app.panelHeight > max) app.panelHeight = max;
    };
    window.addEventListener("resize", clamp);
    window.visualViewport?.addEventListener("resize", clamp);
    return () => {
      window.removeEventListener("resize", clamp);
      window.visualViewport?.removeEventListener("resize", clamp);
    };
  });
</script>

<div class="shell">
  <TitleBar />
  <div class="middle">
    <ActivityBar />
    {#if app.sidebarVisible}
      <Sidebar />
      <div
        class="sidebar-resizer"
        class:active={resizingSidebar}
        role="separator"
        aria-orientation="vertical"
        aria-label="Seitenleistenbreite ändern"
        onpointerdown={startSidebarResize}
      ></div>
    {/if}
    <main class="workbench">
      <EditorPane />
      <Panel />
    </main>
  </div>
  <StatusBar />
</div>

{#if app.toast}
  <div class="toast">{app.toast}</div>
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    /* --app-height: VisualViewport-Fallback (iPadOS) bei offener Tastatur */
    height: var(--app-height, 100dvh);
    /* VirtualKeyboard API (Chromium): Tastatur überlagert, wir weichen aus */
    padding-bottom: env(keyboard-inset-height, 0px);
  }
  .middle {
    position: relative; /* Anker für die Overlay-Sidebar auf schmalen Screens */
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .sidebar-resizer {
    width: 4px;
    margin-left: -2px;
    cursor: ew-resize;
    z-index: 10;
    flex-shrink: 0;
    touch-action: none;
  }
  @media (pointer: coarse) {
    .sidebar-resizer {
      width: 16px;
      margin-left: -8px;
    }
  }
  @media (max-width: 700px) {
    /* Sidebar liegt als Overlay über dem Editor — Breite dort fix */
    .sidebar-resizer {
      display: none;
    }
  }
  .sidebar-resizer:hover,
  .sidebar-resizer.active {
    background: var(--accent);
    opacity: 0.5;
  }
  .workbench {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .toast {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--panel-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 16px;
    box-shadow: var(--shadow);
    z-index: 200;
  }
</style>
