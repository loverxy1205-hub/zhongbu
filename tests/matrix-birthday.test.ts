import { describe, expect, it } from "vitest";
import {
  MATRIX_DIGITS,
  MATRIX_LAYOUT,
  MATRIX_NUMBERS,
} from "../src/data/numbers";
import {
  calculateNumberMatrix,
  calculateNumbers,
} from "../src/engines/calculate";
import { createReading } from "../src/engines/reading";
import { interpret } from "../src/rules/interpret";
import { buildAiRequest } from "../src/lib/ai";
import {
  BIRTHDAY_MEMORY_KEY,
  birthdayValidationError,
  forgetBirthdayMemory,
  readBirthdayMemory,
  saveBirthdayMemory,
} from "../src/lib/birthdayMemory";
import {
  defaultPreferences,
  loadSession,
  saveSession,
} from "../src/lib/storage";
import type { StorageLike } from "../src/lib/storage";
import { exportJSON, readingMarkdown } from "../src/lib/export";
import { savedSchema } from "../src/lib/schema";
import type { Input, NumberMatrixRaw, SavedReading } from "../src/types";

const instant = "2026-09-29T04:30:00.000Z";
const input: Input = {
  question: "明天的排练怎么安排？",
  mode: "explore",
  scene: "无预设",
  action: "",
  targetDate: "2026-09-29",
  timezone: "Asia/Shanghai",
  engines: ["numerology"],
  birthday: "1998-06-15",
  reversals: true,
  everydayOnly: false,
};
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
const unavailable: StorageLike = {
  getItem() {
    throw Error("storage disabled");
  },
  setItem() {
    throw Error("storage disabled");
  },
  removeItem() {
    throw Error("storage disabled");
  },
};
function saved(): SavedReading {
  const reading = createReading(input, instant, () => 0);
  return {
    reading,
    preferences: defaultPreferences(reading),
    savedAt: instant,
  };
}

describe("birthday-digit matrix", () => {
  it("counts the eight original date digits, ignores zero and preserves repetitions", () => {
    const raw = calculateNumberMatrix(input.birthday, instant, "UTC");
    expect(raw.kind).toBe("numerology-matrix");
    expect(raw.cells.map((cell) => cell.digit)).toEqual(MATRIX_DIGITS);
    expect(raw.cells.map((cell) => cell.count)).toEqual([
      2, 0, 0, 0, 1, 1, 0, 1, 2,
    ]);
    expect(raw.cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(7);
    expect(MATRIX_LAYOUT).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
    expect(
      calculateNumberMatrix("2000-02-02", instant, "UTC").cells.map(
        (cell) => cell.count,
      ),
    ).toEqual([0, 3, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("rejects missing, impossible, out-of-range and future dates without exposing the birthday", () => {
    for (const birthday of [
      "",
      "invalid",
      "2001-02-29",
      "1900-01-01",
      "2100-01-01",
      "2026-09-30",
    ])
      expect(() => calculateNumberMatrix(birthday, instant, "UTC")).toThrow();
    expect(() =>
      calculateNumberMatrix("2026-09-29", "2026-09-28T16:30:00Z", "UTC"),
    ).toThrow();
    expect(() =>
      calculateNumberMatrix(
        "2026-09-29",
        "2026-09-28T16:30:00Z",
        "Asia/Shanghai",
      ),
    ).not.toThrow();
    expect(() =>
      calculateNumberMatrix("2000-01-01", instant, "Mars/City"),
    ).toThrow();
  });
  it("is independent of the target date and does not add work numbers or noise", () => {
    const a = createReading(input, instant, () => 0);
    const b = createReading(
      { ...input, targetDate: "1901-01-01" },
      instant,
      () => 1,
    );
    expect(b.results[0]).toEqual(a.results[0]);
    expect(a.results[0].methodVersion).toBe("生日数字九宫格 v1");
    expect(Object.isFrozen(a.results[0].raw)).toBe(true);
  });
  it("has nine complete original knowledge entries, with non-scoring restrictions", () => {
    expect(MATRIX_NUMBERS).toHaveLength(9);
    expect(new Set(MATRIX_NUMBERS.map((entry) => entry.id)).size).toBe(9);
    for (const entry of MATRIX_NUMBERS) {
      expect(entry.meaning).toBeTruthy();
      expect(entry.conditions).toContain("不添加四工作数");
      expect(entry.limits).toContain("空格不表示缺陷");
      expect(entry.source).toContain("不声称是毕达哥拉斯本人");
    }
  });
  it("uses a deterministic limited set of symbolic themes and preserves each provenance", () => {
    const raw = calculateNumberMatrix(input.birthday, instant, "UTC");
    const result = interpret(raw, input);
    expect(result.paragraphs.map((entry) => entry.knowledgeId)).toEqual([
      "matrix-number-1",
      "matrix-number-9",
    ]);
    expect(
      result.paragraphs.every((entry) => entry.ruleId === "matrix-focus-v1"),
    ).toBe(true);
    expect(result.themes).toEqual(["推进", "变化"]);
    expect(result.inclination).toBe("无明确倾向");
    expect(interpret(raw, { ...input, question: "另一个问题" })).toEqual(
      result,
    );
  });
  it("restores matrix records without a birthday and rejects impossible count structures", () => {
    const record = saved();
    const store = new MemoryStorage();
    expect(saveSession(store, record)).toBeNull();
    expect(loadSession(store).value).toEqual(record);
    const bad = structuredClone(record);
    const raw = bad.reading.results[0].raw as NumberMatrixRaw;
    raw.cells[0].digit = 2;
    expect(savedSchema.safeParse(bad).success).toBe(false);
    raw.cells[0].digit = 1;
    raw.cells[0].count = 8;
    expect(savedSchema.safeParse(bad).success).toBe(false);
    raw.cells[0].count = -1;
    expect(savedSchema.safeParse(bad).success).toBe(false);
  });
  it("keeps old personal-day calculations, explanations, stored records and AI intact", () => {
    const record = structuredClone(saved());
    const legacy = calculateNumbers(
      input.birthday,
      input.targetDate,
      instant,
      input.timezone,
    );
    record.reading.results[0] = {
      engine: "numerology",
      status: "ok",
      methodVersion: "简化个人日 v1",
      raw: legacy,
      interpretation: interpret(legacy, record.reading.input),
    };
    const store = new MemoryStorage();
    saveSession(store, record);
    expect(loadSession(store).value).toEqual(record);
    expect(readingMarkdown(record.reading)).toContain("个人日");
    expect(
      buildAiRequest(record.reading, "numerology").evidence.rawSummary,
    ).toContain(`个人日${legacy.day}`);
  });
  it("does not send birth digits or full matrix counts to AI, or leak the original date to exports", () => {
    const record = saved();
    const request = buildAiRequest(record.reading, "numerology");
    const payload = JSON.stringify(request);
    expect(request.evidence.paragraphs).toHaveLength(2);
    expect(request.evidence.rawSummary).not.toContain("生命数字");
    for (const sensitive of [
      input.birthday,
      "19980615",
      '"cells"',
      '"count"',
      '"birthday"',
      "出现 2 次",
    ])
      expect(payload).not.toContain(sensitive);
    expect(exportJSON(record)).not.toContain(input.birthday);
    expect(readingMarkdown(record.reading)).not.toContain(input.birthday);
    expect(readingMarkdown(record.reading)).toContain(
      "格数仍属于由生日导出的个人数据",
    );
  });
});

describe("explicit birthday memory", () => {
  const today = "2026-09-29";
  it("does not write on read, calculation, record saving or export", () => {
    const store = new MemoryStorage();
    expect(readBirthdayMemory(store, today)).toEqual({
      value: null,
      error: null,
    });
    expect(store.data.size).toBe(0);
    const record = saved();
    saveSession(store, record);
    exportJSON(record);
    expect(store.getItem(BIRTHDAY_MEMORY_KEY)).toBeNull();
  });
  it("saves only through explicit consent API and forgets only that independent key", () => {
    const store = new MemoryStorage();
    store.setItem("unrelated", "untouched");
    expect(saveBirthdayMemory(input.birthday, store, today)).toBeNull();
    expect(JSON.parse(store.getItem(BIRTHDAY_MEMORY_KEY)!)).toEqual({
      version: 1,
      consent: true,
      birthday: input.birthday,
    });
    expect(readBirthdayMemory(store, today)).toEqual({
      value: input.birthday,
      error: null,
    });
    expect(forgetBirthdayMemory(store)).toBeNull();
    expect(readBirthdayMemory(store, today).value).toBeNull();
    expect(store.getItem("unrelated")).toBe("untouched");
  });
  it("does not persist invalid or future birthdays, or overwrite existing consent on failure", () => {
    const store = new MemoryStorage();
    saveBirthdayMemory(input.birthday, store, today);
    const before = store.getItem(BIRTHDAY_MEMORY_KEY);
    for (const value of [
      "",
      "2001-02-29",
      "invalid",
      "2026-09-30",
      "2100-01-01",
    ]) {
      expect(birthdayValidationError(value, today)).toBeTruthy();
      expect(saveBirthdayMemory(value, store, today)).toBeTruthy();
      expect(store.getItem(BIRTHDAY_MEMORY_KEY)).toBe(before);
    }
  });
  it("requires explicit consent, validates stored data and leaves corruption untouched on read", () => {
    const store = new MemoryStorage();
    for (const value of [
      "{broken",
      "null",
      '"1998-06-15"',
      JSON.stringify({ version: 1, birthday: input.birthday }),
      JSON.stringify({ version: 1, consent: false, birthday: input.birthday }),
      JSON.stringify({ version: 1, consent: true, birthday: "2026-09-30" }),
      JSON.stringify({
        version: 1,
        consent: true,
        birthday: input.birthday,
        tracking: true,
      }),
    ]) {
      store.setItem(BIRTHDAY_MEMORY_KEY, value);
      const read = readBirthdayMemory(store, today);
      expect(read.value).toBeNull();
      expect(read.error).toBeTruthy();
      expect(store.getItem(BIRTHDAY_MEMORY_KEY)).toBe(value);
    }
  });
  it("contains read, write and deletion failures without affecting local computation", () => {
    expect(readBirthdayMemory(unavailable, today).error).toBeTruthy();
    expect(saveBirthdayMemory(input.birthday, unavailable, today)).toBeTruthy();
    expect(forgetBirthdayMemory(unavailable)).toBeTruthy();
    expect(saved().reading.results[0].status).toBe("ok");
  });
});
