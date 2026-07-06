/** IndexedDB persistence for workspace files and settings. */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface FileRecord {
  name: string;
  data: Uint8Array;
  mtime: number;
}

interface PyIdeDB extends DBSchema {
  files: { key: string; value: FileRecord };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<PyIdeDB>> | null = null;

function db() {
  dbPromise ??= openDB<PyIdeDB>("pyide", 1, {
    upgrade(database) {
      database.createObjectStore("files", { keyPath: "name" });
      database.createObjectStore("kv");
    },
  });
  return dbPromise;
}

export async function loadAllFiles(): Promise<FileRecord[]> {
  return (await db()).getAll("files");
}

export async function saveFile(record: FileRecord): Promise<void> {
  await (await db()).put("files", record);
}

export async function deleteFile(name: string): Promise<void> {
  await (await db()).delete("files", name);
}

export async function renameFile(oldName: string, record: FileRecord): Promise<void> {
  const database = await db();
  const tx = database.transaction("files", "readwrite");
  await tx.store.delete(oldName);
  await tx.store.put(record);
  await tx.done;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("kv", key)) as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put("kv", value, key);
}
