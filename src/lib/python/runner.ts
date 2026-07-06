/**
 * Main-thread controller for the Pyodide worker: lifecycle, the
 * SharedArrayBuffer stdin handshake, interrupts and result routing.
 */
import { PYODIDE_CDN_BASE } from "../pyodide-version";
import {
  STDIN_READY,
  STDIN_EOF,
  STDIN_BUFFER_SIZE,
  type FromWorker,
  type ToWorker,
  type WorkspaceFile,
} from "./protocol";

export type RunnerStatus =
  | "booting"
  | "ready"
  | "running"
  | "awaiting-input"
  | "error";

export interface RunResult {
  ok: boolean;
  error?: string;
  files: WorkspaceFile[];
  /** true when the run never produced a filesystem snapshot (hard stop) */
  aborted?: boolean;
}

export interface RunnerEvents {
  onStatus(status: RunnerStatus, detail?: string): void;
  onStdout(data: Uint8Array): void;
  onStderr(data: Uint8Array): void;
  onImage(png: Uint8Array): void;
  onPackageMessage(message: string): void;
}

const encoder = new TextEncoder();

export class PythonRunner {
  private worker: Worker | null = null;
  private stdinControl!: Int32Array<SharedArrayBuffer>;
  private stdinData!: SharedArrayBuffer;
  private interruptBuffer!: Uint8Array<SharedArrayBuffer>;
  private runId = 0;
  private pendingRun: ((result: RunResult) => void) | null = null;
  private killTimer: ReturnType<typeof setTimeout> | null = null;

  status: RunnerStatus = "booting";
  pythonVersion = "";

  constructor(private events: RunnerEvents) {}

  get supported(): boolean {
    return typeof SharedArrayBuffer !== "undefined" && crossOriginIsolated;
  }

  start() {
    this.stdinControl = new Int32Array(
      new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT),
    );
    this.stdinData = new SharedArrayBuffer(STDIN_BUFFER_SIZE);
    this.interruptBuffer = new Uint8Array(new SharedArrayBuffer(1));

    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
      name: "pyodide",
    });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data);
    this.setStatus("booting");
    this.send({
      type: "init",
      indexURL: `${location.origin}/pyodide/`,
      packageBaseUrl: PYODIDE_CDN_BASE,
      stdinControl: this.stdinControl.buffer,
      stdinData: this.stdinData,
      interruptBuffer: this.interruptBuffer.buffer,
    });
  }

  private send(msg: ToWorker, transfer: Transferable[] = []) {
    this.worker?.postMessage(msg, transfer);
  }

  private setStatus(status: RunnerStatus, detail?: string) {
    this.status = status;
    this.events.onStatus(status, detail);
  }

  private handle(msg: FromWorker) {
    switch (msg.type) {
      case "ready":
        this.pythonVersion = msg.pythonVersion;
        this.setStatus("ready");
        break;
      case "boot-error":
        this.setStatus("error", msg.error);
        break;
      case "stdout":
        this.events.onStdout(msg.data);
        break;
      case "stderr":
        this.events.onStderr(msg.data);
        break;
      case "stdin-request":
        this.setStatus("awaiting-input");
        break;
      case "image":
        this.events.onImage(msg.data);
        break;
      case "packages-loading":
        this.events.onPackageMessage(msg.packages.join(" "));
        break;
      case "result": {
        const resolve = this.pendingRun;
        this.pendingRun = null;
        this.setStatus("ready");
        resolve?.({ ok: msg.ok, error: msg.error, files: msg.files });
        break;
      }
    }
  }

  run(code: string, filename: string, files: WorkspaceFile[]): Promise<RunResult> {
    if (this.status !== "ready" || this.pendingRun) {
      return Promise.resolve({
        ok: false,
        error: "Interpreter ist nicht bereit.",
        files: [],
        aborted: true,
      });
    }
    this.interruptBuffer[0] = 0;
    this.setStatus("running");
    return new Promise((resolve) => {
      this.pendingRun = resolve;
      this.send({ type: "run", id: ++this.runId, code, filename, files });
    });
  }

  /** Delivers a line typed in the terminal to the blocked worker. */
  provideStdin(line: string) {
    if (this.status !== "awaiting-input") return;
    const bytes = encoder.encode(line);
    const target = new Uint8Array(this.stdinData);
    const length = Math.min(bytes.length, target.length);
    target.set(bytes.subarray(0, length));
    Atomics.store(this.stdinControl, 1, length);
    Atomics.store(this.stdinControl, 0, STDIN_READY);
    Atomics.notify(this.stdinControl, 0);
    this.setStatus("running");
  }

  /**
   * Ctrl+C: raise KeyboardInterrupt inside Python. If the worker is blocked
   * on input(), unblock it with EOF as well. If it does not come back within
   * a few seconds (e.g. `while True: pass` in C code), hard-restart it.
   */
  interrupt() {
    if (this.status !== "running" && this.status !== "awaiting-input") return;
    this.interruptBuffer[0] = 2; // SIGINT
    if (this.status === "awaiting-input") {
      Atomics.store(this.stdinControl, 0, STDIN_EOF);
      Atomics.notify(this.stdinControl, 0);
      this.setStatus("running");
    }
    this.killTimer ??= setTimeout(() => {
      this.killTimer = null;
      if (this.pendingRun) this.restart("Prozess wurde beendet (Timeout nach Interrupt).");
    }, 4000);
    const clear = () => {
      if (this.killTimer) {
        clearTimeout(this.killTimer);
        this.killTimer = null;
      }
    };
    const prevResolve = this.pendingRun;
    if (prevResolve) {
      this.pendingRun = (result) => {
        clear();
        prevResolve(result);
      };
    }
  }

  /** Hard stop: terminate the worker and boot a fresh interpreter. */
  restart(reason = "Interpreter wird neu gestartet …") {
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
    this.worker?.terminate();
    this.worker = null;
    const resolve = this.pendingRun;
    this.pendingRun = null;
    resolve?.({ ok: false, error: reason, files: [], aborted: true });
    this.start();
  }

  /**
   * Warms the offline cache: fetches the wheels for the most common
   * scientific packages so the service worker stores them. Does not touch
   * the interpreter, so it can run concurrently with user code.
   */
  async prefetchPackages(packages = ["numpy", "matplotlib", "pillow", "micropip"]) {
    try {
      const lock = await (await fetch("/pyodide/pyodide-lock.json")).json();
      const wanted = new Set<string>();
      const addWithDeps = (name: string) => {
        const pkg = lock.packages[name];
        if (!pkg || wanted.has(name)) return;
        wanted.add(name);
        for (const dep of pkg.depends ?? []) addWithDeps(dep);
      };
      for (const p of packages) addWithDeps(p);
      for (const name of wanted) {
        const file = lock.packages[name].file_name;
        await fetch(`${PYODIDE_CDN_BASE}${file}`).then((r) => r.blob());
      }
    } catch {
      // Offline or CDN unreachable — packages stay uncached until next online run.
    }
  }
}
