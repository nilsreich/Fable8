/** Messages between the main thread and the Pyodide worker. */

export interface WorkspaceFile {
  name: string;
  data: Uint8Array;
}

export type ToWorker =
  | {
      type: "init";
      indexURL: string;
      packageBaseUrl: string;
      /** Int32Array[2]: [0] = state flag, [1] = byte length of the reply */
      stdinControl: SharedArrayBuffer;
      /** UTF-8 bytes of the stdin reply */
      stdinData: SharedArrayBuffer;
      /** Uint8Array[1]: set to 2 to deliver SIGINT (KeyboardInterrupt) */
      interruptBuffer: SharedArrayBuffer;
    }
  | { type: "run"; id: number; code: string; filename: string; files: WorkspaceFile[] };

export type FromWorker =
  | { type: "ready"; pythonVersion: string; pyodideVersion: string }
  | { type: "boot-error"; error: string }
  | { type: "stdout"; data: Uint8Array }
  | { type: "stderr"; data: Uint8Array }
  | { type: "stdin-request" }
  | { type: "image"; data: Uint8Array }
  | { type: "packages-loading"; packages: string[] }
  | {
      type: "result";
      id: number;
      ok: boolean;
      error?: string;
      files: WorkspaceFile[];
    };

/** stdin control flag values */
export const STDIN_PENDING = 0;
export const STDIN_READY = 1;
export const STDIN_EOF = 2;

export const STDIN_BUFFER_SIZE = 256 * 1024;
