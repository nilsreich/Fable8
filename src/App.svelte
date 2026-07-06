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

  let resizingSidebar = $state(false);

  function startSidebarResize(event: PointerEvent) {
    event.preventDefault();
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
    height: 100%;
  }
  .middle {
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
