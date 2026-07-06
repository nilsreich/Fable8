<script lang="ts">
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars } from "@codemirror/view";
  import { EditorState, Compartment } from "@codemirror/state";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { indentOnInput, bracketMatching, foldGutter, foldKeymap, indentUnit } from "@codemirror/language";
  import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
  import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
  import { python } from "@codemirror/lang-python";
  import { githubDark, githubLight } from "../editor/github-theme";
  import { app, isTextFile, isImageFile, decodeText } from "../state.svelte";
  import Icon from "./Icon.svelte";

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  const themeCompartment = new Compartment();
  const languageCompartment = new Compartment();
  const states = new Map<string, EditorState>();
  let shownFile: string | null = null;
  let imageUrl = $state<string | null>(null);

  const activeIsText = $derived(!!app.activeFile && isTextFile(app.activeFile));
  const activeIsImage = $derived(!!app.activeFile && isImageFile(app.activeFile));

  function themeExtension() {
    return app.theme === "dark" ? githubDark : githubLight;
  }

  function languageFor(name: string) {
    return name.endsWith(".py") ? [python()] : [];
  }

  function baseExtensions(name: string) {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of("    "),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            void app.run();
            return true;
          },
        },
        {
          key: "Mod-s",
          run: () => {
            void app.flushSaves();
            return true;
          },
        },
        indentWithTab,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
      ]),
      languageCompartment.of(languageFor(name)),
      themeCompartment.of(themeExtension()),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && shownFile) {
          app.updateFileContent(shownFile, update.state.doc.toString());
        }
      }),
    ];
  }

  $effect(() => {
    if (!host) return;
    view ??= new EditorView({ parent: host });
    return () => {
      view?.destroy();
      view = null;
    };
  });

  // Swap documents when the active file changes; keep per-file undo history.
  $effect(() => {
    const name = app.activeFile;
    if (!view) return;
    if (!name || !isTextFile(name)) {
      shownFile = null;
      return;
    }
    if (name === shownFile) return;
    if (shownFile) states.set(shownFile, view.state);
    const record = app.file(name);
    const state =
      states.get(name) ??
      EditorState.create({
        doc: record ? decodeText(record.data) : "",
        extensions: baseExtensions(name),
      });
    // set before setState so the update listener attributes changes correctly
    shownFile = name;
    view.setState(state);
    view.dispatch({
      effects: [
        themeCompartment.reconfigure(themeExtension()),
        languageCompartment.reconfigure(languageFor(name)),
      ],
    });
    view.focus();
  });

  // Theme switch for the visible document.
  $effect(() => {
    const ext = themeExtension();
    view?.dispatch({ effects: themeCompartment.reconfigure(ext) });
  });

  // If Python rewrote the file that is open, refresh the document.
  $effect(() => {
    const name = app.activeFile;
    if (!name || !view || name !== shownFile) return;
    const record = app.file(name);
    if (!record) return;
    void record.mtime;
    const text = decodeText(record.data);
    const current = view.state.doc.toString();
    if (text !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: text },
      });
    }
  });

  // Image preview for image files. `currentUrl` is deliberately
  // non-reactive: reading `imageUrl` here would re-trigger the effect.
  let currentUrl: string | null = null;
  $effect(() => {
    const name = app.activeFile;
    const record = name && isImageFile(name) ? app.file(name) : null;
    void record?.mtime;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    if (record) {
      currentUrl = URL.createObjectURL(
        new Blob([record.data.buffer as ArrayBuffer]),
      );
    }
    imageUrl = currentUrl;
  });

  function closeTab(event: MouseEvent, name: string) {
    event.stopPropagation();
    states.delete(name);
    if (shownFile === name) shownFile = null;
    app.closeTab(name);
  }
</script>

<div class="editor-pane">
  <div class="tabs" role="tablist">
    {#each app.openTabs as tab (tab)}
      <div
        class="tab"
        class:active={app.activeFile === tab}
        role="tab"
        tabindex="0"
        aria-selected={app.activeFile === tab}
        onclick={() => app.openFile(tab)}
        onkeydown={(e) => e.key === "Enter" && app.openFile(tab)}
      >
        <span class="tab-name">{tab}</span>
        <button
          class="tab-close"
          title="Schließen"
          onclick={(e) => closeTab(e, tab)}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
    {/each}
  </div>

  <div class="content">
    <div class="cm-host" bind:this={host} hidden={!activeIsText}></div>
    {#if activeIsImage && imageUrl}
      <div class="preview">
        <img src={imageUrl} alt={app.activeFile} />
      </div>
    {:else if app.activeFile && !activeIsText}
      <div class="binary">Binärdatei — keine Vorschau verfügbar.</div>
    {:else if !app.activeFile}
      <div class="welcome">
        <Icon name="python" size={56} />
        <p>Öffne links eine Datei oder lege eine neue an.</p>
        <p class="hint">Strg+Enter führt das aktive Skript aus.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .editor-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--editor-bg);
  }
  .tabs {
    display: flex;
    background: var(--tab-bg);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
    user-select: none;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 14px;
    height: 35px;
    font-size: 13px;
    color: var(--tab-fg);
    background: var(--tab-bg);
    border-right: 1px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
  }
  .tab.active {
    color: var(--tab-active-fg);
    background: var(--tab-active-bg);
    box-shadow: inset 0 1px 0 var(--accent);
  }
  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    color: transparent;
  }
  .tab:hover .tab-close,
  .tab.active .tab-close {
    color: var(--fg-muted);
  }
  .tab-close:hover {
    background: var(--button-hover);
    color: var(--fg);
  }
  .content {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .cm-host {
    height: 100%;
  }
  .cm-host[hidden] {
    display: none;
  }
  :global(.cm-host .cm-editor) {
    height: 100%;
  }
  .preview {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 16px;
  }
  .preview img {
    max-width: 100%;
    max-height: 100%;
    box-shadow: var(--shadow);
  }
  .binary,
  .welcome {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--fg-muted);
  }
  .welcome :global(svg) {
    opacity: 0.35;
  }
  .welcome p {
    margin: 0;
  }
  .hint {
    font-size: 12px;
    opacity: 0.7;
  }
</style>
