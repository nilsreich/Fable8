<script lang="ts">
  import { app } from "../state.svelte";
  import Terminal from "./Terminal.svelte";
  import PlotsView from "./PlotsView.svelte";

  let resizing = $state(false);

  function startResize(event: PointerEvent) {
    event.preventDefault();
    resizing = true;
    const startY = event.clientY;
    const startHeight = app.panelHeight;
    const move = (e: PointerEvent) => {
      app.panelHeight = Math.min(
        Math.max(startHeight + (startY - e.clientY), 80),
        window.innerHeight - 200,
      );
    };
    const up = () => {
      resizing = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<section class="panel" style:height="{app.panelHeight}px">
  <div
    class="resizer"
    class:active={resizing}
    role="separator"
    aria-orientation="horizontal"
    aria-label="Panelhöhe ändern"
    onpointerdown={startResize}
  ></div>
  <div class="tabs">
    <button
      class="panel-tab"
      class:active={app.panelTab === "terminal"}
      onclick={() => (app.panelTab = "terminal")}
    >
      Terminal
    </button>
    <button
      class="panel-tab"
      class:active={app.panelTab === "plots"}
      onclick={() => (app.panelTab = "plots")}
    >
      Plots
      {#if app.plots.length > 0}
        <span class="badge">{app.plots.length}</span>
      {/if}
    </button>
  </div>
  <div class="body" class:hidden={app.panelTab !== "terminal"}>
    <Terminal />
  </div>
  {#if app.panelTab === "plots"}
    <div class="body">
      <PlotsView />
    </div>
  {/if}
</section>

<style>
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--panel-bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .resizer {
    position: absolute;
    top: -3px;
    left: 0;
    right: 0;
    height: 6px;
    cursor: ns-resize;
    z-index: 10;
  }
  .resizer:hover,
  .resizer.active {
    background: var(--accent);
    opacity: 0.5;
  }
  .tabs {
    display: flex;
    gap: 4px;
    padding: 0 12px;
    flex-shrink: 0;
    user-select: none;
  }
  .panel-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 4px 5px;
    margin-right: 12px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted);
    border-bottom: 1px solid transparent;
  }
  .panel-tab.active {
    color: var(--fg);
    border-bottom-color: var(--accent);
  }
  .badge {
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 8px;
    padding: 0 6px;
    font-size: 10px;
    line-height: 14px;
  }
  .body {
    flex: 1;
    min-height: 0;
  }
  /* The terminal stays mounted (keeps scrollback) and is only hidden. */
  .body.hidden {
    display: none;
  }
</style>
