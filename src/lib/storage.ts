import type { Preferences, Reading, SavedReading } from "../types";
import { savedSchema } from "./schema";
import { deepFreeze } from "../engines/reading";
export const HISTORY_KEY = "zhongbu-history-v1",
  SESSION_KEY = "zhongbu-active-v1";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type StorageResult<T> = { value: T; error: string | null };
export function defaultPreferences(reading: Reading): Preferences {
  return {
    pinned: [],
    liked: [],
    favorites: [],
    included: reading.results.map((r) => r.engine),
  };
}
function isSaved(v: unknown): v is SavedReading {
  return savedSchema.safeParse(v).success;
}
export function loadHistory(
  storage: StorageLike,
): StorageResult<SavedReading[]> {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return { value: [], error: null };
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v) || !v.every(isSaved)) throw Error();
    return {
      value: v.map((e) => ({ ...e, reading: deepFreeze(e.reading) })),
      error: null,
    };
  } catch {
    return {
      value: [],
      error:
        "本机记录无法读取，可能存储受限或记录已损坏。当前计算仍可使用；损坏记录不会被自动覆盖。",
    };
  }
}
export function saveHistory(
  storage: StorageLike,
  items: SavedReading[],
): string | null {
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(items));
    return null;
  } catch {
    return "保存失败：本机存储不可用或空间不足。请导出当前记录。";
  }
}
export function clearHistory(storage: StorageLike): string | null {
  try {
    storage.removeItem(HISTORY_KEY);
    return null;
  } catch {
    return "清空失败：本机存储不可用。";
  }
}
export function loadSession(
  storage: StorageLike,
): StorageResult<SavedReading | null> {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return { value: null, error: null };
    const v: unknown = JSON.parse(raw);
    if (!isSaved(v)) throw Error();
    return { value: { ...v, reading: deepFreeze(v.reading) }, error: null };
  } catch {
    return { value: null, error: "本标签页记录恢复失败；可以重新创建记录。" };
  }
}
export function saveSession(
  storage: StorageLike,
  value: SavedReading,
): string | null {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(value));
    return null;
  } catch {
    return "会话存储不可用，刷新后无法恢复；当前结果仍可使用和导出。";
  }
}
export function getBrowserStorage(
  which: "localStorage" | "sessionStorage",
): StorageLike {
  return window[which];
}
