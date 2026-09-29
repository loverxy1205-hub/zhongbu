import { parseDate, todayLocal } from "./dates";
import type { StorageLike, StorageResult } from "./storage";

/** Separate consent-scoped preference. Never included in Reading or export. */
export const BIRTHDAY_MEMORY_KEY = "zhongbu-birthday-consent-v1";

export function birthdayValidationError(
  birthday: string,
  today = todayLocal(),
): string | null {
  try {
    if (!birthday) return "请先填写出生日期。";
    parseDate(birthday);
    parseDate(today);
    if (birthday > today) return "出生日期不能晚于今天。";
    return null;
  } catch {
    return "请填写有效的出生日期（1901–2099 年）。";
  }
}

function browserStorage(storage?: StorageLike): StorageLike {
  return storage ?? window.localStorage;
}

export function readBirthdayMemory(
  storage?: StorageLike,
  today = todayLocal(),
): StorageResult<string | null> {
  try {
    const saved = browserStorage(storage).getItem(BIRTHDAY_MEMORY_KEY);
    if (!saved) return { value: null, error: null };
    const value: unknown = JSON.parse(saved);
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      value.version !== 1 ||
      !("consent" in value) ||
      value.consent !== true ||
      !("birthday" in value) ||
      typeof value.birthday !== "string" ||
      Object.keys(value).sort().join(",") !== "birthday,consent,version" ||
      birthdayValidationError(value.birthday, today)
    )
      return {
        value: null,
        error: "已保存的生日无法读取，请重新填写或忘记已存生日。",
      };
    return { value: value.birthday, error: null };
  } catch {
    return { value: null, error: "无法读取本机保存的生日；可以继续手动填写。" };
  }
}

/** Call only from the explicit consent button, never on input or submission. */
export function saveBirthdayMemory(
  birthday: string,
  storage?: StorageLike,
  today = todayLocal(),
): string | null {
  const error = birthdayValidationError(birthday, today);
  if (error) return error;
  try {
    browserStorage(storage).setItem(
      BIRTHDAY_MEMORY_KEY,
      JSON.stringify({
        version: 1,
        consent: true,
        birthday,
      }),
    );
    return null;
  } catch {
    return "生日未保存：本机存储不可用。当前计算仍可继续。";
  }
}

export function forgetBirthdayMemory(storage?: StorageLike): string | null {
  try {
    browserStorage(storage).removeItem(BIRTHDAY_MEMORY_KEY);
    return null;
  } catch {
    return "暂时无法删除本机保存的生日，请在浏览器设置中清除此网站的数据。";
  }
}
