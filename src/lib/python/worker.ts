/// <reference lib="webworker" />
/**
 * Pyodide runs in this worker so the UI stays responsive and so that
 * Python's input() can block synchronously: the worker parks itself on a
 * SharedArrayBuffer with Atomics.wait() until the main thread delivers the
 * line typed into the terminal.
 */
import type { PyodideInterface } from "pyodide";
import {
  STDIN_PENDING,
  STDIN_EOF,
  type ToWorker,
  type FromWorker,
  type WorkspaceFile,
} from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const HOME = "/home/pyodide";

let pyodide: PyodideInterface;
let stdinControl: Int32Array<SharedArrayBuffer>;
let stdinData: SharedArrayBuffer;
let interruptBuffer: Uint8Array<SharedArrayBuffer>;

const decoder = new TextDecoder();

function post(msg: FromWorker, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

function postStream(type: "stdout" | "stderr", view: Uint8Array) {
  // The view aliases wasm memory — copy before transferring.
  const data = new Uint8Array(view);
  post({ type, data }, [data.buffer]);
}

/** Blocks the worker until the main thread supplies a line (or EOF). */
function readStdinLine(): string | null {
  Atomics.store(stdinControl, 0, STDIN_PENDING);
  post({ type: "stdin-request" });
  Atomics.wait(stdinControl, 0, STDIN_PENDING);
  const flag = Atomics.load(stdinControl, 0);
  if (flag === STDIN_EOF) return null;
  const length = Atomics.load(stdinControl, 1);
  const bytes = new Uint8Array(length);
  bytes.set(new Uint8Array(stdinData, 0, length));
  return decoder.decode(bytes) + "\n";
}

function pyBytesToUint8Array(py: any): Uint8Array {
  if (py instanceof Uint8Array) return new Uint8Array(py);
  const buffer = py.getBuffer("u8");
  try {
    return new Uint8Array(buffer.data);
  } finally {
    buffer.release();
    py.destroy?.();
  }
}

/**
 * Matplotlib backend that renders with Agg and hands finished figures to the
 * IDE instead of trying to open a window.
 */
const MPL_BACKEND_SOURCE = `\
"""IDE matplotlib backend: plt.show() sends PNGs to the plot panel."""
import io

from matplotlib import _pylab_helpers
from matplotlib.backend_bases import FigureManagerBase
from matplotlib.backends.backend_agg import FigureCanvasAgg

FigureCanvas = FigureCanvasAgg
FigureManager = FigureManagerBase


def show(*args, **kwargs):
    import __ide_bridge

    for manager in _pylab_helpers.Gcf.get_all_fig_managers():
        buf = io.BytesIO()
        manager.canvas.figure.savefig(buf, format="png", dpi=110)
        __ide_bridge.show_image(buf.getvalue())
    _pylab_helpers.Gcf.destroy_all()
`;

const BOOTSTRAP = `\
import os
import sys

os.environ["MPLBACKEND"] = "module://ide_mpl_backend"
if "/ide_support" not in sys.path:
    sys.path.insert(0, "/ide_support")


def _ide_make_namespace(filename):
    import builtins

    return {"__name__": "__main__", "__file__": filename, "__builtins__": builtins}
`;

async function boot(init: Extract<ToWorker, { type: "init" }>) {
  stdinControl = new Int32Array(init.stdinControl);
  stdinData = init.stdinData;
  interruptBuffer = new Uint8Array(init.interruptBuffer);

  const { loadPyodide } = await import(
    /* @vite-ignore */ `${init.indexURL}pyodide.mjs`
  );
  pyodide = await loadPyodide({
    indexURL: init.indexURL,
    packageBaseUrl: init.packageBaseUrl,
  });

  pyodide.setStdout({ write: (buf) => (postStream("stdout", buf), buf.length) });
  pyodide.setStderr({ write: (buf) => (postStream("stderr", buf), buf.length) });
  pyodide.setStdin({ stdin: readStdinLine, isatty: true });
  pyodide.setInterruptBuffer(interruptBuffer);

  pyodide.registerJsModule("__ide_bridge", {
    show_image(pngBytes: any) {
      const data = pyBytesToUint8Array(pngBytes);
      post({ type: "image", data }, [data.buffer]);
    },
  });

  pyodide.FS.mkdirTree("/ide_support");
  pyodide.FS.writeFile("/ide_support/ide_mpl_backend.py", MPL_BACKEND_SOURCE);
  pyodide.runPython(BOOTSTRAP);

  const pythonVersion = pyodide.runPython(
    "import sys; f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}'",
  );
  post({ type: "ready", pythonVersion, pyodideVersion: pyodide.version });
}

function clearWorkspace() {
  const FS = pyodide.FS;
  const remove = (dir: string) => {
    for (const name of FS.readdir(dir) as string[]) {
      if (name === "." || name === "..") continue;
      const path = `${dir}/${name}`;
      if (FS.isDir(FS.stat(path, false).mode)) {
        remove(path);
        FS.rmdir(path);
      } else {
        FS.unlink(path);
      }
    }
  };
  remove(HOME);
}

function writeWorkspace(files: WorkspaceFile[]) {
  const FS = pyodide.FS;
  for (const file of files) {
    const path = `${HOME}/${file.name}`;
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (dir !== HOME) FS.mkdirTree(dir);
    FS.writeFile(path, file.data);
  }
}

const MAX_COLLECT_SIZE = 32 * 1024 * 1024;

function collectWorkspace(dir = HOME, prefix = ""): WorkspaceFile[] {
  const FS = pyodide.FS;
  const out: WorkspaceFile[] = [];
  for (const name of FS.readdir(dir) as string[]) {
    if (name === "." || name === "..") continue;
    const path = `${dir}/${name}`;
    const stat = FS.stat(path, false);
    if (FS.isDir(stat.mode)) {
      out.push(...collectWorkspace(path, `${prefix}${name}/`));
    } else if (stat.size <= MAX_COLLECT_SIZE) {
      out.push({ name: `${prefix}${name}`, data: new Uint8Array(FS.readFile(path)) });
    }
  }
  return out;
}

/** Strips pyodide-internal frames from a Python traceback. */
function cleanTraceback(message: string): string {
  const lines = message.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^ {2}File "/.test(line)) {
      skipping = /_pyodide|\/lib\/python.*\/pyodide\//.test(line);
      if (skipping) continue;
    } else if (skipping && /^ {4}/.test(line)) {
      continue;
    } else {
      skipping = false;
    }
    out.push(line);
  }
  return out.join("\n");
}

async function run(msg: Extract<ToWorker, { type: "run" }>) {
  interruptBuffer[0] = 0;
  let ok = true;
  let error: string | undefined;
  let namespace: any;
  try {
    clearWorkspace();
    writeWorkspace(msg.files);
    pyodide.runPython(`import os; os.chdir(${JSON.stringify(HOME)})`);

    await pyodide.loadPackagesFromImports(msg.code, {
      messageCallback: (message: string) =>
        post({ type: "packages-loading", packages: [message] }),
    });

    namespace = pyodide.globals.get("_ide_make_namespace")(msg.filename);
    await pyodide.runPythonAsync(msg.code, {
      globals: namespace,
      filename: msg.filename,
    });
  } catch (err: any) {
    ok = false;
    error = cleanTraceback(String(err?.message ?? err));
  } finally {
    namespace?.destroy?.();
  }

  let files: WorkspaceFile[] = [];
  try {
    files = collectWorkspace();
  } catch {
    // FS in a broken state should not swallow the run result
  }
  post(
    { type: "result", id: msg.id, ok, error, files },
    files.map((f) => f.data.buffer),
  );
}

self.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  try {
    if (msg.type === "init") await boot(msg);
    else if (msg.type === "run") await run(msg);
  } catch (err: any) {
    if (msg.type === "init") {
      post({ type: "boot-error", error: String(err?.message ?? err) });
    } else if (msg.type === "run") {
      post({
        type: "result",
        id: msg.id,
        ok: false,
        error: String(err?.message ?? err),
        files: [],
      });
    }
  }
};
