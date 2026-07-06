<script lang="ts">
  import { app } from "../state.svelte";
  import Icon from "./Icon.svelte";
</script>

<nav class="activitybar">
  <button
    class="item"
    class:active={app.sidebarVisible}
    title="Explorer"
    onclick={() => (app.sidebarVisible = !app.sidebarVisible)}
  >
    <Icon name="files" size={22} />
  </button>
  <button
    class="item"
    class:active={app.panelTab === "terminal"}
    title="Terminal"
    onclick={() => (app.panelTab = "terminal")}
  >
    <Icon name="terminal" size={22} />
  </button>
  <button
    class="item"
    class:active={app.panelTab === "plots"}
    title="Plots"
    onclick={() => (app.panelTab = "plots")}
  >
    <Icon name="image" size={22} />
  </button>
  <div class="spacer"></div>
  <button
    class="item"
    title={app.theme === "dark" ? "Helles Design" : "Dunkles Design"}
    onclick={() => app.toggleTheme()}
  >
    <Icon name={app.theme === "dark" ? "sun" : "moon"} size={20} />
  </button>
</nav>

<style>
  .activitybar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 48px;
    background: var(--activitybar-bg);
    border-right: 1px solid var(--border);
    padding: 4px 0;
    user-select: none;
  }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 44px;
    color: var(--activitybar-fg);
  }
  .item:hover {
    color: var(--activitybar-active);
  }
  .item.active {
    color: var(--activitybar-active);
  }
  .item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--activitybar-active);
  }
  .spacer {
    flex: 1;
  }
</style>
