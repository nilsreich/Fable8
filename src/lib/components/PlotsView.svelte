<script lang="ts">
  import { app } from "../state.svelte";
  import Icon from "./Icon.svelte";

  let zoomed = $state<string | null>(null);

  function download(url: string, label: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = label.endsWith(".png") ? label : `${label}.png`;
    a.click();
  }
</script>

<div class="plots">
  {#if app.plots.length === 0}
    <div class="empty">
      <Icon name="image" size={40} />
      <p>Noch keine Plots — <code>plt.show()</code> zeigt Grafiken hier an.</p>
    </div>
  {:else}
    <div class="toolbar">
      <button class="icon-button" title="Alle Plots löschen" onclick={() => app.clearPlots()}>
        <Icon name="trash" size={14} />
      </button>
    </div>
    <div class="grid">
      {#each app.plots as plot (plot.id)}
        <figure>
          <button class="thumb" onclick={() => (zoomed = plot.url)} title="Vergrößern">
            <img src={plot.url} alt={plot.label} />
          </button>
          <figcaption>
            <span>{plot.label}</span>
            <button
              class="icon-button"
              title="Als PNG herunterladen"
              onclick={() => download(plot.url, plot.label)}
            >
              <Icon name="download" size={13} />
            </button>
          </figcaption>
        </figure>
      {/each}
    </div>
  {/if}
</div>

{#if zoomed}
  <div
    class="lightbox"
    role="button"
    tabindex="0"
    onclick={() => (zoomed = null)}
    onkeydown={(e) => e.key === "Escape" && (zoomed = null)}
  >
    <img src={zoomed} alt="Plot" />
  </div>
{/if}

<style>
  .plots {
    height: 100%;
    overflow-y: auto;
    position: relative;
  }
  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--fg-muted);
  }
  .empty p {
    margin: 0;
  }
  .toolbar {
    position: sticky;
    top: 0;
    display: flex;
    justify-content: flex-end;
    padding: 4px 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    padding: 0 12px 12px;
  }
  figure {
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--editor-bg);
  }
  .thumb {
    display: block;
    width: 100%;
    padding: 0;
  }
  .thumb img {
    display: block;
    width: 100%;
    height: 160px;
    object-fit: contain;
    background: #ffffff;
  }
  figcaption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--fg-muted);
    border-top: 1px solid var(--border);
  }
  .lightbox {
    position: fixed;
    inset: 0;
    background: #000000cc;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    cursor: zoom-out;
  }
  .lightbox img {
    max-width: 92vw;
    max-height: 92vh;
    background: #ffffff;
    box-shadow: var(--shadow);
  }
</style>
