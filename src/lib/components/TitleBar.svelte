<script lang="ts">
  import { app, isTextFile, decodeText } from "../state.svelte";
  import { buildShareUrl } from "../share";
  import Icon from "./Icon.svelte";

  const canRun = $derived(
    app.runnerStatus === "ready" &&
      !!app.activeFile &&
      isTextFile(app.activeFile),
  );
  const running = $derived(
    app.runnerStatus === "running" || app.runnerStatus === "awaiting-input",
  );

  async function share() {
    if (!app.activeFile) return;
    const record = app.file(app.activeFile);
    if (!record) return;
    const url = buildShareUrl({
      name: app.activeFile,
      code: decodeText(record.data),
    });
    if (url.length > 12000) {
      app.showToast("Skript ist zu groß zum Teilen per URL");
      return;
    }
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: `PyIDE — ${app.activeFile}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      app.showToast("Share-Link in die Zwischenablage kopiert");
    } catch {
      app.showToast("Link konnte nicht kopiert werden");
    }
  }
</script>

<header class="titlebar">
  <div class="left">
    <span class="logo"><Icon name="python" /></span>
    <span class="app-name">PyIDE</span>
  </div>
  <div class="center">
    {app.activeFile ? `${app.activeFile} — PyIDE` : "PyIDE"}
  </div>
  <div class="right">
    {#if running}
      <button
        class="icon-button stop"
        title="Stopp (Ctrl+C) — KeyboardInterrupt senden"
        onclick={() => app.stop()}
      >
        <Icon name="stop" />
      </button>
    {:else}
      <button
        class="icon-button run"
        title="Ausführen (Strg+Enter)"
        disabled={!canRun}
        onclick={() => app.run()}
      >
        <Icon name="play" />
      </button>
    {/if}
    <button
      class="icon-button"
      title="Interpreter neu starten"
      onclick={() => app.hardRestart()}
    >
      <Icon name="restart" />
    </button>
    <button
      class="icon-button"
      title="Code per URL teilen"
      disabled={!app.activeFile}
      onclick={share}
    >
      <Icon name="share" />
    </button>
    <button
      class="icon-button"
      class:beamer-active={app.beamer}
      title={app.beamer
        ? "Beamer-Modus beenden"
        : "Beamer-Modus (große Schrift für Projektoren)"}
      onclick={() => app.toggleBeamer()}
    >
      <Icon name="beamer" />
    </button>
    <button
      class="icon-button"
      title={app.theme === "dark" ? "Helles Design" : "Dunkles Design"}
      onclick={() => app.toggleTheme()}
    >
      <Icon name={app.theme === "dark" ? "sun" : "moon"} />
    </button>
  </div>
</header>

<style>
  .titlebar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 35px;
    background: var(--titlebar-bg);
    border-bottom: 1px solid var(--border);
    padding: 0 8px;
    user-select: none;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .logo {
    display: inline-flex;
    color: var(--accent);
  }
  .app-name {
    font-weight: 600;
  }
  .center {
    color: var(--fg-muted);
    font-size: 12px;
    max-width: 40vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .right {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
  }
  .run {
    color: var(--success);
  }
  .stop {
    color: var(--error);
  }
  .beamer-active {
    color: var(--accent);
    background: var(--button-hover);
  }
</style>
