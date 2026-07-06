# PyIDE — Python Online-IDE als PWA

Eine vollständig im Browser laufende Python-IDE im VS-Code-Stil. Python wird
über [Pyodide](https://pyodide.org) (CPython → WebAssembly) in einem Web Worker
ausgeführt — nach dem ersten Besuch komplett **offline** nutzbar.

![Stack](https://img.shields.io/badge/stack-Bun%20·%20Vite%20·%20Svelte%205%20·%20TypeScript-blue)

## Features

- **Editor**: CodeMirror 6 mit GitHub-Syntax-Highlighting (Primer-Palette),
  Autovervollständigung, Klammer-Matching, Folding, Suche, Multi-Cursor
- **Echtes `input()`**: Das Programm schreibt den Prompt ins Terminal, wartet
  blockierend auf die Eingabe und läuft danach weiter — umgesetzt über
  `SharedArrayBuffer` + `Atomics.wait()` zwischen Worker und Terminal
- **Terminal**: xterm.js mit Local-Echo, Backspace, `Ctrl+C` (KeyboardInterrupt)
- **Dateien**: txt/CSV & Co. lesen und schreiben; der Explorer zeigt alle vom
  Python-Code erzeugten Dateien an. Persistenz über IndexedDB, Upload über die
  File System Access API (mit Fallback), Download einzelner Dateien oder des
  ganzen Arbeitsbereichs als ZIP
- **Bilder/Plots**: `matplotlib` (eigenes Agg-Backend, `plt.show()` sendet PNGs
  ins Plots-Panel) sowie automatische Vorschau aller vom Code geschriebenen
  Bilddateien
- **Teilen per URL**: Aktives Skript wird lz-string-komprimiert im
  `#share=…`-Fragment kodiert — kein Server nötig
- **PWA**: Installierbar, App-Shell + Pyodide-Core werden vorab gecacht;
  Paket-Wheels (numpy, matplotlib, pillow, micropip) werden beim ersten
  Online-Lauf vom CDN geladen und danach offline aus dem Cache bedient
- **Design**: VS-Code-Look (Dark/Light Modern) mit Light- & Dark-Mode
- **Beamer-Modus**: Ein Klick vergrößert Editor-, Terminal- und UI-Schrift
  für Projektoren (Einstellung wird gespeichert)
- **Tablet-tauglich**: Touch-Targets ≥ 40 px, 16-px-Mindestschrift gegen den
  iOS-Auto-Zoom, virtuelle Tastatur über VirtualKeyboard API /
  `interactive-widget=resizes-content` / VisualViewport-Fallback, Overlay-
  Explorer auf schmalen Viewports, Safe-Area-Insets

## Entwicklung

```bash
bun install
bun run dev       # Dev-Server (COOP/COEP-Header gesetzt)
bun run build     # Produktions-Build nach dist/
bun run preview   # Build lokal testen
bun run check     # svelte-check / TypeScript
```

`scripts/copy-pyodide.ts` kopiert den Pyodide-Core aus `node_modules` nach
`public/pyodide/` (läuft automatisch vor dev/build) und generiert
`src/lib/pyodide-version.ts`. Die PWA-Icons entstehen mit
`python3 scripts/gen-icons.py`.

## Deployment

Statischer Host mit **HTTPS** genügt (z. B. GitHub Pages, Netlify, Vercel).
Die für `SharedArrayBuffer` nötigen Header

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

injiziert der Service Worker selbst in alle Same-Origin-Antworten
(coi-serviceworker-Muster); beim allerersten Aufruf lädt die Seite dafür einmal
automatisch neu. Kann der Host die Header direkt setzen, entfällt der Reload.
Wichtig: `SharedArrayBuffer` erfordert zusätzlich einen sicheren Kontext —
die Seite muss über **HTTPS oder `http://localhost`** geöffnet werden, ein
Zugriff über eine LAN-IP (`http://192.168.…`) funktioniert nicht.

## Architektur

```
Main Thread                        Web Worker
┌───────────────────────┐         ┌──────────────────────────┐
│ Svelte 5 UI           │ postMsg │ Pyodide (CPython/WASM)   │
│  CodeMirror 6 Editor  │ ──────► │  run / FS-Sync / Plots   │
│  xterm.js Terminal    │ ◄────── │  stdout/stderr (raw)     │
│  Explorer (IndexedDB) │         │                          │
│                       │ SharedArrayBuffer + Atomics        │
│  input()-Zeile ───────┼────────►│ blockierendes stdin      │
└───────────────────────┘         └──────────────────────────┘
        ▲
        │ Workbox Service Worker: Precache (App + Pyodide-Core),
        │ CacheFirst für CDN-Wheels, COOP/COEP-Injektion
```

- Vor jedem Lauf wird der Workspace (IndexedDB) in das MEMFS des Workers
  geschrieben (`/home/pyodide`), nach dem Lauf zurücksynchronisiert — dadurch
  funktionieren `open()`, `csv`, `os.remove()` usw. wie gewohnt.
- Stop-Button/`Ctrl+C` setzt Pyodides Interrupt-Buffer (SIGINT); hängt der
  Worker trotzdem, wird er nach 4 s hart neu gestartet.
