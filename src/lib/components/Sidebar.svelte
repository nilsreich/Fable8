<script lang="ts">
  import { app, isImageFile, extensionOf } from "../state.svelte";
  import { createZip } from "../zip";
  import Icon from "./Icon.svelte";

  let creating = $state(false);
  let newName = $state("");
  let renaming = $state<string | null>(null);
  let renameValue = $state("");

  function openFile(name: string) {
    app.openFile(name);
    // Auf schmalen Screens liegt die Sidebar als Overlay über dem Editor —
    // nach der Auswahl wieder Platz machen.
    if (matchMedia("(max-width: 700px)").matches) {
      app.sidebarVisible = false;
    }
  }

  function fileColor(name: string): string {
    const ext = extensionOf(name);
    if (ext === "py") return "var(--accent)";
    if (ext === "csv" || ext === "tsv") return "var(--success)";
    if (isImageFile(name)) return "var(--warning)";
    return "var(--fg-muted)";
  }

  async function confirmCreate() {
    const name = newName.trim();
    creating = false;
    newName = "";
    if (!name) return;
    await app.createFile(app.uniqueName(name.includes(".") ? name : `${name}.py`));
  }

  async function confirmRename(oldName: string) {
    const name = renameValue.trim();
    renaming = null;
    if (!name || name === oldName || app.file(name)) return;
    await app.rename(oldName, name);
  }

  async function remove(name: string) {
    if (confirm(`„${name}“ wirklich löschen?`)) await app.removeFile(name);
  }

  /** Upload via File System Access API (fallback: <input type=file>). */
  async function upload() {
    try {
      if ("showOpenFilePicker" in window) {
        const handles = await (window as any).showOpenFilePicker({ multiple: true });
        for (const handle of handles) {
          const file: File = await handle.getFile();
          await importFile(file);
        }
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      for (const file of input.files ?? []) await importFile(file);
    };
    input.click();
  }

  async function importFile(file: File) {
    const data = new Uint8Array(await file.arrayBuffer());
    await app.createFile(app.uniqueName(file.name), data);
    app.showToast(`„${file.name}“ importiert`);
  }

  /**
   * <a download> is deliberately used instead of showSaveFilePicker():
   * it works in every browser, needs no permission dialog and saves
   * straight to the download folder.
   */
  function saveBlob(blob: Blob, suggestedName: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    app.showToast(`Download gestartet: ${suggestedName}`);
  }

  function download(name: string) {
    const record = app.file(name);
    if (!record) return;
    saveBlob(new Blob([record.data.buffer as ArrayBuffer]), name);
  }

  function downloadAllAsZip() {
    if (app.files.length === 0) return;
    const zip = createZip(
      app.files.map((f) => ({ name: f.name, data: f.data, mtime: f.mtime })),
    );
    saveBlob(
      new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }),
      "pyide-arbeitsbereich.zip",
    );
  }
</script>

<aside class="sidebar" style:width="{app.sidebarWidth}px">
  <div class="header">
    <span>Explorer</span>
    <span class="actions">
      <button
        class="icon-button"
        title="Neue Datei"
        onclick={() => {
          creating = true;
          newName = "";
        }}
      >
        <Icon name="newFile" size={14} />
      </button>
      <button class="icon-button" title="Datei hochladen" onclick={upload}>
        <Icon name="upload" size={14} />
      </button>
      <button
        class="icon-button"
        title="Alle Dateien als ZIP herunterladen"
        onclick={downloadAllAsZip}
      >
        <Icon name="zip" size={14} />
      </button>
    </span>
  </div>

  <div class="tree">
    <div class="section">Arbeitsbereich</div>
    {#if creating}
      <div class="row">
        <input
          type="text"
          placeholder="dateiname.py"
          bind:value={newName}
          onkeydown={(e) => {
            if (e.key === "Enter") confirmCreate();
            if (e.key === "Escape") creating = false;
          }}
          onblur={confirmCreate}
          use:autofocus
        />
      </div>
    {/if}
    {#each app.files as file (file.name)}
      <div
        class="row file"
        class:active={app.activeFile === file.name}
        role="button"
        tabindex="0"
        onclick={() => openFile(file.name)}
        onkeydown={(e) => e.key === "Enter" && openFile(file.name)}
      >
        {#if renaming === file.name}
          <input
            type="text"
            bind:value={renameValue}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => {
              if (e.key === "Enter") confirmRename(file.name);
              if (e.key === "Escape") renaming = null;
            }}
            onblur={() => confirmRename(file.name)}
            use:autofocus
          />
        {:else}
          <span class="dot" style:background={fileColor(file.name)}></span>
          <span class="name" title={file.name}>{file.name}</span>
          <span class="row-actions">
            <button
              class="icon-button"
              title="Umbenennen"
              onclick={(e) => {
                e.stopPropagation();
                renaming = file.name;
                renameValue = file.name;
              }}
            >
              <Icon name="edit" size={13} />
            </button>
            <button
              class="icon-button"
              title="Herunterladen"
              onclick={(e) => {
                e.stopPropagation();
                download(file.name);
              }}
            >
              <Icon name="download" size={13} />
            </button>
            <button
              class="icon-button"
              title="Löschen"
              onclick={(e) => {
                e.stopPropagation();
                remove(file.name);
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </span>
        {/if}
      </div>
    {/each}
    {#if app.files.length === 0 && !creating}
      <div class="empty">Keine Dateien — lege eine neue an.</div>
    {/if}
  </div>
</aside>

<script module lang="ts">
  function autofocus(node: HTMLInputElement) {
    requestAnimationFrame(() => {
      node.focus();
      node.select();
    });
  }
</script>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    overflow: hidden;
    user-select: none;
  }
  /* Schmale Viewports (Tablet hochkant geteilt, Phone): Overlay statt Split */
  @media (max-width: 700px) {
    .sidebar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 30;
      width: min(300px, calc(100vw - 80px)) !important;
      box-shadow: var(--shadow);
    }
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 4px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .actions {
    display: flex;
  }
  .tree {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 12px;
  }
  .section {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 700;
    color: var(--fg);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px 2px 18px;
    min-height: 24px;
    cursor: pointer;
    touch-action: manipulation;
  }
  @media (pointer: coarse) {
    .row {
      min-height: 42px;
      padding-block: 4px;
    }
  }
  .row input {
    width: 100%;
  }
  .row.file:hover {
    background: var(--sidebar-hover);
  }
  .row.file.active {
    background: var(--sidebar-active);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-actions {
    display: none;
    align-items: center;
  }
  /* Visible on hover and on the selected file (touch devices have no hover) */
  .row:hover .row-actions,
  .row.active .row-actions {
    display: flex;
  }
  .row-actions .icon-button {
    width: 20px;
    height: 20px;
  }
  @media (pointer: coarse) {
    .row-actions .icon-button {
      width: 36px;
      height: 36px;
    }
  }
  .empty {
    padding: 8px 18px;
    color: var(--fg-muted);
  }
</style>
