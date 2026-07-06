/** Central app state (Svelte 5 runes) + run orchestration. */
import * as db from "./db";
import type { FileRecord } from "./db";
import { PythonRunner, type RunnerStatus } from "./python/runner";
import type { WorkspaceFile } from "./python/protocol";
import { readSharedSnippet, clearShareHash } from "./share";

export type Theme = "light" | "dark";
export type PanelTab = "terminal" | "plots";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const TEXT_EXTENSIONS = new Set([
  "py", "txt", "csv", "tsv", "md", "json", "toml", "ini", "cfg", "html",
  "css", "js", "ts", "svg", "xml", "yml", "yaml", "log",
]);
export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"]);

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}
export const isTextFile = (name: string) => TEXT_EXTENSIONS.has(extensionOf(name));
export const isImageFile = (name: string) => IMAGE_EXTENSIONS.has(extensionOf(name));

export const decodeText = (data: Uint8Array) => decoder.decode(data);
export const encodeText = (text: string) => encoder.encode(text);

export interface Plot {
  id: number;
  url: string;
  label: string;
}

/** Terminal I/O is imperatively bridged; the component fills these in. */
export const terminalBus = {
  write(_data: Uint8Array | string) {},
  focus() {},
};

const WELCOME_FILE = "main.py";
const WELCOME_CODE = `# Willkommen bei PyIDE! 🐍
# Läuft komplett im Browser (Pyodide) — auch offline.

name = input("Wie heißt du? ")
print(f"Hallo, {name}!")

# Dateien schreiben & lesen (Explorer links zeigt sie an):
with open("gruesse.txt", "w") as f:
    f.write(f"Hallo {name}!\\n")

# CSV schreiben und wieder einlesen:
import csv
with open("messwerte.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["x", "y"])
    for x in range(10):
        writer.writerow([x, x * x])

with open("messwerte.csv") as f:
    zeilen = list(csv.reader(f))
print(f"{len(zeilen) - 1} Messwerte gespeichert.")

# Plotten mit matplotlib (wird beim ersten Mal automatisch geladen):
import matplotlib.pyplot as plt
xs = [int(z[0]) for z in zeilen[1:]]
ys = [int(z[1]) for z in zeilen[1:]]
plt.plot(xs, ys, marker="o")
plt.title(f"Quadratzahlen für {name}")
plt.xlabel("x")
plt.ylabel("x²")
plt.show()
`;

class AppState {
  files = $state<FileRecord[]>([]);
  openTabs = $state<string[]>([]);
  activeFile = $state<string | null>(null);

  theme = $state<Theme>("dark");
  beamer = $state(false);
  sidebarVisible = $state(true);
  panelTab = $state<PanelTab>("terminal");
  panelHeight = $state(260);
  sidebarWidth = $state(230);

  runnerStatus = $state<RunnerStatus>("booting");
  statusDetail = $state("");
  pythonVersion = $state("");
  plots = $state<Plot[]>([]);
  toast = $state("");

  runner: PythonRunner;
  private plotCounter = 0;
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.runner = new PythonRunner({
      onStatus: (status, detail) => {
        this.runnerStatus = status;
        if (detail) this.statusDetail = detail;
        this.pythonVersion = this.runner.pythonVersion;
        if (status === "awaiting-input") terminalBus.focus();
      },
      onStdout: (data) => terminalBus.write(data),
      onStderr: (data) => terminalBus.write(data),
      onImage: (png) => this.addPlot(png),
      onPackageMessage: (message) =>
        terminalBus.write(`\x1b[2m${message}\x1b[0m\r\n`),
    });
  }

  async init(
    options: { startRunner?: boolean; runnerBlockedMessage?: string } = {},
  ) {
    const { startRunner = true, runnerBlockedMessage } = options;
    this.theme =
      (await db.getSetting<Theme>("theme")) ??
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    this.beamer = (await db.getSetting<boolean>("beamer")) ?? false;

    this.files = (await db.loadAllFiles()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const shared = readSharedSnippet();
    if (shared) {
      const name = this.uniqueName(shared.name || "geteilt.py");
      await this.createFile(name, encodeText(shared.code));
      clearShareHash();
      this.showToast(`Geteiltes Skript „${name}“ importiert`);
    } else if (this.files.length === 0) {
      await this.createFile(WELCOME_FILE, encodeText(WELCOME_CODE));
    }

    if (!this.activeFile) {
      const last = await db.getSetting<string>("lastFile");
      const candidate =
        (last && this.files.find((f) => f.name === last)?.name) ??
        this.files.find((f) => extensionOf(f.name) === "py")?.name ??
        this.files[0]?.name ??
        null;
      if (candidate) this.openFile(candidate);
    }

    if (!startRunner) {
      this.runnerStatus = "booting";
      this.statusDetail = runnerBlockedMessage ?? "";
      return;
    }
    if (this.runner.supported) {
      this.runner.start();
      const waitReady = setInterval(() => {
        if (this.runnerStatus === "ready") {
          clearInterval(waitReady);
          void this.runner.prefetchPackages();
        }
      }, 500);
    } else {
      this.runnerStatus = "error";
      this.statusDetail =
        runnerBlockedMessage ??
        "SharedArrayBuffer nicht verfügbar (Seite ist nicht cross-origin-isoliert). Bitte Seite neu laden.";
    }
  }

  // ---- files ----------------------------------------------------------

  file(name: string) {
    return this.files.find((f) => f.name === name);
  }

  uniqueName(name: string): string {
    if (!this.file(name)) return name;
    const ext = extensionOf(name);
    const base = ext ? name.slice(0, -(ext.length + 1)) : name;
    for (let i = 1; ; i++) {
      const candidate = ext ? `${base}-${i}.${ext}` : `${base}-${i}`;
      if (!this.file(candidate)) return candidate;
    }
  }

  async createFile(name: string, data: Uint8Array = new Uint8Array()) {
    const record: FileRecord = { name, data, mtime: Date.now() };
    this.files = [...this.files.filter((f) => f.name !== name), record].sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    await db.saveFile($state.snapshot(record) as FileRecord);
    this.openFile(name);
  }

  updateFileContent(name: string, text: string) {
    const record = this.file(name);
    if (!record) return;
    record.data = encodeText(text);
    record.mtime = Date.now();
    this.scheduleSave(name);
  }

  private scheduleSave(name: string) {
    clearTimeout(this.saveTimers.get(name));
    this.saveTimers.set(
      name,
      setTimeout(() => {
        const record = this.file(name);
        if (record) void db.saveFile($state.snapshot(record) as FileRecord);
        this.saveTimers.delete(name);
      }, 400),
    );
  }

  async flushSaves() {
    for (const [name, timer] of this.saveTimers) {
      clearTimeout(timer);
      const record = this.file(name);
      if (record) await db.saveFile($state.snapshot(record) as FileRecord);
    }
    this.saveTimers.clear();
  }

  async removeFile(name: string) {
    this.files = this.files.filter((f) => f.name !== name);
    this.closeTab(name);
    await db.deleteFile(name);
  }

  async rename(oldName: string, newName: string) {
    const record = this.file(oldName);
    if (!record || this.file(newName)) return;
    const renamed: FileRecord = {
      name: newName,
      data: record.data,
      mtime: Date.now(),
    };
    this.files = this.files
      .map((f) => (f.name === oldName ? renamed : f))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.openTabs = this.openTabs.map((t) => (t === oldName ? newName : t));
    if (this.activeFile === oldName) this.activeFile = newName;
    await db.renameFile(oldName, $state.snapshot(renamed) as FileRecord);
  }

  openFile(name: string) {
    if (!this.openTabs.includes(name)) this.openTabs = [...this.openTabs, name];
    this.activeFile = name;
    void db.setSetting("lastFile", name);
  }

  closeTab(name: string) {
    const index = this.openTabs.indexOf(name);
    this.openTabs = this.openTabs.filter((t) => t !== name);
    if (this.activeFile === name) {
      this.activeFile =
        this.openTabs[Math.min(index, this.openTabs.length - 1)] ?? null;
    }
  }

  // ---- running --------------------------------------------------------

  async run() {
    const name = this.activeFile;
    if (!name || this.runnerStatus !== "ready") return;
    const record = this.file(name);
    if (!record || !isTextFile(name)) return;

    await this.flushSaves();
    terminalBus.write(`\r\n\x1b[1;34m▶ ${name}\x1b[0m\r\n`);
    this.panelTab = "terminal";
    terminalBus.focus();

    const workspace: WorkspaceFile[] = this.files.map((f) => ({
      name: f.name,
      data: new Uint8Array($state.snapshot(f).data as Uint8Array),
    }));
    const code = decodeText(record.data);
    const result = await this.runner.run(code, name, workspace);

    if (!result.ok && result.error) {
      terminalBus.write(`\x1b[31m${result.error.replaceAll("\n", "\r\n")}\x1b[0m\r\n`);
    }
    if (!result.aborted) await this.syncWorkspace(result.files);
  }

  /** Applies the post-run filesystem back to IndexedDB and the UI. */
  private async syncWorkspace(returned: WorkspaceFile[]) {
    if (returned.length === 0 && this.files.length === 0) return;
    const returnedNames = new Set(returned.map((f) => f.name));
    const previous = new Map(this.files.map((f) => [f.name, f]));
    const next: FileRecord[] = [];

    for (const file of returned) {
      const old = previous.get(file.name);
      const changed = !old || !bytesEqual(old.data, file.data);
      const record: FileRecord = {
        name: file.name,
        data: file.data,
        mtime: changed ? Date.now() : (old?.mtime ?? Date.now()),
      };
      next.push(record);
      if (changed) {
        await db.saveFile(record);
        if (isImageFile(file.name)) {
          this.addPlot(file.data, file.name);
        }
      }
    }
    for (const name of previous.keys()) {
      if (!returnedNames.has(name)) {
        await db.deleteFile(name);
        this.closeTab(name);
      }
    }
    this.files = next.sort((a, b) => a.name.localeCompare(b.name));
    if (this.activeFile && !this.file(this.activeFile)) {
      this.activeFile = this.openTabs.at(-1) ?? null;
    }
  }

  stop() {
    this.runner.interrupt();
  }

  hardRestart() {
    this.runner.restart();
  }

  // ---- plots ----------------------------------------------------------

  addPlot(png: Uint8Array, label = "") {
    const url = URL.createObjectURL(
      new Blob([png.buffer as ArrayBuffer], { type: "image/png" }),
    );
    this.plots = [
      ...this.plots,
      { id: ++this.plotCounter, url, label: label || `Plot ${this.plotCounter}` },
    ];
    this.panelTab = "plots";
  }

  clearPlots() {
    for (const plot of this.plots) URL.revokeObjectURL(plot.url);
    this.plots = [];
  }

  // ---- misc -----------------------------------------------------------

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    void db.setSetting("theme", this.theme);
  }

  /** Presentation mode: larger fonts for projectors. */
  toggleBeamer() {
    this.beamer = !this.beamer;
    void db.setSetting("beamer", this.beamer);
  }

  showToast(message: string) {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ""), 3500);
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export const app = new AppState();
