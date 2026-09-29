import { describe, expect, it } from "vitest";
import { TAROT } from "../src/data/tarot";
import { RUNES } from "../src/data/runes";
import { HEXAGRAMS, hexByCode, TRIGRAMS } from "../src/data/hexagrams";
import { NUMBERS } from "../src/data/numbers";
import { sample, uniformInt } from "../src/lib/random";
import {
  calculateMeihua,
  calculateNumbers,
  coinValue,
  codesFromValues,
  drawCoins,
  drawRunes,
  drawTarot,
  flipLines,
  meihuaNumbers,
  R,
  reduce,
} from "../src/engines/calculate";
import { createReading } from "../src/engines/reading";
import { parseDate, zonedParts } from "../src/lib/dates";
import { inclinationFor, interpret } from "../src/rules/interpret";
import { summarize } from "../src/rules/summary";
import {
  clearHistory,
  defaultPreferences,
  HISTORY_KEY,
  loadHistory,
  loadSession,
  saveHistory,
  saveSession,
} from "../src/lib/storage";
import type { StorageLike } from "../src/lib/storage";
import { exportJSON, readingMarkdown } from "../src/lib/export";
import type { Input, Theme } from "../src/types";
export const fixture: Input = {
  question: "如何安排这周？",
  category: "日常",
  mode: "explore",
  scene: "无预设",
  action: "",
  targetDate: "2026-09-29",
  timezone: "Asia/Shanghai",
  engines: ["tarot", "iching", "meihua", "numerology", "runes"],
  birthday: "1998-06-15",
  reversals: true,
  everydayOnly: false,
};
const instant = "2026-09-29T04:30:00.000Z";
function seeded(seed = 8) {
  let n = seed;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n;
  };
}
const reading = () => createReading(fixture, instant, seeded());
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) || null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
describe("complete local knowledge", () => {
  it("contains 78 unique RWS cards, 24 runes, 64 hexagrams and 9 numbers", () => {
    expect(TAROT).toHaveLength(78);
    expect(TAROT.filter((c) => c.kind === "大阿尔卡纳")).toHaveLength(22);
    expect(RUNES).toHaveLength(24);
    expect(HEXAGRAMS).toHaveLength(64);
    expect(NUMBERS).toHaveLength(9);
    for (const data of [TAROT, RUNES, HEXAGRAMS, NUMBERS]) {
      expect(new Set(data.map((e) => e.id)).size).toBe(data.length);
      for (const e of data)
        for (const key of [
          "name",
          "meaning",
          "themes",
          "keywords",
          "conditions",
          "limits",
          "source",
        ] as const)
          expect(e[key].length).toBeGreaterThan(0);
    }
  });
  it("all cards include upright and reversed meanings", () => {
    for (const c of TAROT) {
      expect(c.reversedMeaning.length).toBeGreaterThan(8);
      expect(c.reversedThemes.length).toBeGreaterThan(0);
    }
  });
  it("rune symbols match Unicode code points", () => {
    expect(RUNES.map((r) => r.symbol.codePointAt(0))).toEqual([
      0x16a0, 0x16a2, 0x16a6, 0x16a8, 0x16b1, 0x16b2, 0x16b7, 0x16b9, 0x16ba,
      0x16be, 0x16c1, 0x16c3, 0x16c7, 0x16c8, 0x16c9, 0x16ca, 0x16cf, 0x16d2,
      0x16d6, 0x16d7, 0x16da, 0x16dc, 0x16de, 0x16df,
    ]);
    expect(RUNES[0].name).toBe("Fehu");
    expect(RUNES[23].name).toBe("Othala");
  });
  it("64 codes form a complete binary space with correct upper/lower", () => {
    expect(new Set(HEXAGRAMS.map((h) => h.code)).size).toBe(64);
    for (const h of HEXAGRAMS) {
      expect(h.code.slice(0, 3)).toBe(
        TRIGRAMS.find((t) => t.name === h.lower)?.code,
      );
      expect(h.code.slice(3)).toBe(
        TRIGRAMS.find((t) => t.name === h.upper)?.code,
      );
      expect(h.lines).toHaveLength(6);
      expect(h.lineMeanings).toHaveLength(6);
      expect(h.original.length).toBeGreaterThan(2);
      expect(h.source).toMatch(/oldid=\d+/);
      h.lines.forEach((l, i) => {
        const prefix = l.slice(0, 2);
        expect(prefix).toContain(h.code[i] === "1" ? "九" : "六");
        expect(l.length).toBeGreaterThan(5);
      });
    }
    expect(hexByCode("100010").name).toBe("屯");
    expect(hexByCode("010100").name).toBe("解");
  });
  it("uses a corrected authoritative text, not the initial upstream typo", () => {
    expect(HEXAGRAMS[0].lines[1]).toContain("見龍在田");
    expect(HEXAGRAMS[51].lines[2]).toContain("列其夤");
    expect(HEXAGRAMS[0].extra[0]).toContain("用九");
    expect(HEXAGRAMS[1].extra[0]).toContain("用六");
  });
});
describe("uniform randomness", () => {
  it("rejects the tail of uint32 instead of applying biased modulo", () => {
    const values = [4294967295, 4294967294, 9];
    expect(uniformInt(10, () => values.shift()!)).toBe(9);
    expect(values).toHaveLength(0);
  });
  it("guards invalid sources and ranges", () => {
    expect(() => uniformInt(0)).toThrow();
    expect(() => uniformInt(2, () => -1)).toThrow();
    expect(() => uniformInt(10, () => 4294967295)).toThrow();
    expect(() => sample([1], 2, seeded())).toThrow();
  });
  it("draws without replacement for repeated deterministic runs", () => {
    for (let i = 1; i < 200; i++) {
      expect(
        new Set(drawTarot(true, seeded(i)).cards.map((c) => c.id)).size,
      ).toBe(3);
      expect(new Set(drawRunes(seeded(i)).runes.map((c) => c.id)).size).toBe(3);
    }
  });
  it("reverse switch off never produces a reverse and each orientation uses its own coin", () => {
    expect(drawTarot(false, seeded()).cards.every((c) => !c.reversed)).toBe(
      true,
    );
    const v = [0, 0, 0, 0, 1, 0];
    expect(
      drawTarot(true, () => v.shift()!).cards.map((c) => c.reversed),
    ).toEqual([false, true, false]);
  });
  it("Web Crypto works without configuration or a key", () => {
    const r = createReading(fixture, instant);
    expect(r.results.every((r) => r.status === "ok")).toBe(true);
    expect(r.readingId).toMatch(/^zb-[a-f0-9]{32}$/);
  });
});
describe("three-coin method", () => {
  it("eight outcomes have frequencies 1/3/3/1", () => {
    const sums: number[] = [];
    for (const a of [2, 3])
      for (const b of [2, 3])
        for (const c of [2, 3]) sums.push(coinValue([a, b, c]));
    expect([6, 7, 8, 9].map((n) => sums.filter((s) => s === n).length)).toEqual(
      [1, 3, 3, 1],
    );
  });
  it("only 6 and 9 change; order is bottom to top", () => {
    expect(codesFromValues([6, 7, 8, 9, 8, 7])).toEqual({
      code: "010101",
      moving: [1, 4],
      changedCode: "110001",
    });
    expect(drawCoins(() => 0).values).toEqual([6, 6, 6, 6, 6, 6]);
    expect(drawCoins(() => 1).values).toEqual([9, 9, 9, 9, 9, 9]);
  });
  it("supports zero or all moving lines", () => {
    expect(codesFromValues([7, 7, 7, 7, 7, 7]).changedCode).toBe("111111");
    expect(drawCoins(() => 0).changedCode).toBe("111111");
  });
  it("single flips match at every position of all 64 hexagrams", () => {
    for (const h of HEXAGRAMS)
      for (let n = 1; n <= 6; n++) {
        const c = flipLines(h.code, [n]);
        expect(hexByCode(c)).toBeTruthy();
        expect([...c].filter((v, i) => v !== h.code[i])).toHaveLength(1);
        expect(c[n - 1]).not.toBe(h.code[n - 1]);
      }
  });
});
describe("calendar and numerology", () => {
  it("required Plum Blossom example is 革之咸, first line changing", () => {
    const r = meihuaNumbers(5, 12, 17, 9);
    expect([r.upper, r.lower, r.moving]).toEqual([2, 3, 1]);
    expect(hexByCode(r.code).name).toBe("革");
    expect(hexByCode(r.changedCode).name).toBe("咸");
    expect(r.body).toBe("兑（金）");
    expect(r.use).toBe("离（火）");
  });
  it("R maps exact multiples to the modulus", () => {
    expect(R(8, 8)).toBe(8);
    expect(R(12, 6)).toBe(6);
  });
  it("timezone crossing is applied before conversion", () => {
    const a = calculateMeihua("2026-09-28T16:30:00Z", "Asia/Shanghai"),
      b = calculateMeihua("2026-09-28T16:30:00Z", "UTC");
    expect(a.local).toContain("2026-09-29");
    expect(b.local).toContain("2026-09-28");
    expect(a.D).toBe(b.D + 1);
    expect(a.H).toBe(1);
    expect(b.H).toBe(9);
  });
  it("new lunar year changes on new year, not lichun", () => {
    expect(calculateMeihua("2024-02-09T12:00:00Z", "UTC").Y).toBe(4);
    expect(calculateMeihua("2024-02-10T12:00:00Z", "UTC").Y).toBe(5);
  });
  it("leap month keeps its month number (2023 leap second month)", () => {
    const a = calculateMeihua("2023-03-22T12:00:00Z", "UTC");
    expect(a.leap).toBe(true);
    expect(a.M).toBe(2);
    expect(a.D).toBe(1);
  });
  it("midnight changes day but both 23h and 0h are zi hour", () => {
    const a = calculateMeihua("2026-09-28T23:30:00Z", "UTC"),
      b = calculateMeihua("2026-09-29T00:30:00Z", "UTC");
    expect(a.H).toBe(1);
    expect(b.H).toBe(1);
    expect(b.D).toBe(a.D + 1);
    expect(calculateMeihua("2026-09-29T01:00:00Z", "UTC").H).toBe(2);
  });
  it("invalid timezone, dates and range fail explicitly", () => {
    for (const date of [
      "2026-02-30",
      "2023-02-29",
      "1900-01-01",
      "2100-01-01",
      "bad",
    ])
      expect(() => parseDate(date)).toThrow();
    expect(() => calculateMeihua(instant, "Mars/City")).toThrow();
    expect(() => zonedParts("invalid", "UTC")).toThrow();
    expect(() => calculateMeihua("2100-01-01T00:00:00Z", "UTC")).toThrow();
  });
  it("reduces master numbers and computes exact personal-day sample", () => {
    expect([11, 22, 33].map(reduce)).toEqual([2, 4, 6]);
    const r = calculateNumbers("1990-01-01", "2026-09-29", instant, "UTC");
    expect([r.life, r.year, r.month, r.day]).toEqual([3, 3, 3, 5]);
  });
  it("rejects future or impossible birthdays", () => {
    expect(() =>
      calculateNumbers("2026-10-01", "2026-10-02", instant, "UTC"),
    ).toThrow();
    expect(() =>
      calculateNumbers("2000-02-30", fixture.targetDate, instant, "UTC"),
    ).toThrow();
  });
  it("missing birthday preserves all other engines", () => {
    const r = createReading({ ...fixture, birthday: "" }, instant, seeded());
    expect(r.results.find((e) => e.engine === "numerology")?.status).toBe(
      "unavailable",
    );
    expect(r.results.filter((e) => e.status === "ok")).toHaveLength(4);
  });
  it("invalid timezone does not suppress random engines", () => {
    const r = createReading(
      { ...fixture, timezone: "Mars/City" },
      instant,
      seeded(),
    );
    expect(r.results.filter((e) => e.status === "ok")).toHaveLength(3);
  });
  it("target date never controls Plum Blossom and time engines do not add noise", () => {
    const a = reading(),
      b = createReading(
        { ...fixture, targetDate: "2026-10-01" },
        instant,
        seeded(19),
      );
    expect(a.results.find((r) => r.engine === "meihua")?.raw).toEqual(
      b.results.find((r) => r.engine === "meihua")?.raw,
    );
    expect(
      createReading(fixture, instant, seeded(19)).results.find(
        (r) => r.engine === "numerology",
      )?.raw,
    ).toEqual(a.results.find((r) => r.engine === "numerology")?.raw);
  });
});
describe("independent interpretation and preferences", () => {
  it("text does not secretly change interpretation", () => {
    const a = reading(),
      b = createReading(
        { ...fixture, question: "建议买入股票去上课不去上课" },
        instant,
        seeded(),
      );
    expect(a.results).toEqual(b.results);
  });
  it("position changes explanation, obstruction is not direct advice", () => {
    const raw = drawTarot(false, () => 0);
    const a = interpret(raw, fixture);
    expect(a.paragraphs[1].text).toContain("不是让你照做");
    expect(a.paragraphs[0].ruleId).not.toBe(a.paragraphs[1].ruleId);
  });
  it("open questions do not produce binary recommendations", () => {
    expect(
      reading().results.every(
        (r) => r.interpretation?.inclination === "无明确倾向",
      ),
    ).toBe(true);
    expect(summarize(reading().results, fixture).inclination).toBeNull();
  });
  it("negation and unsupported action cannot silently inherit a rule", () => {
    const action = {
      ...fixture,
      mode: "action" as const,
      scene: "上课安排" as const,
      everydayOnly: true,
    };
    expect(
      inclinationFor(["推进"], { ...action, action: "去上课" }).inclination,
    ).toBe("倾向行动");
    for (const text of ["翘课", "不去上课", "联系", "不联系", "买入股票"])
      expect(
        inclinationFor(["推进"], { ...action, action: text }).inclination,
      ).toBe("无明确倾向");
  });
  it("full and preference summaries preserve conflicts and frozen originals", () => {
    const r = reading(),
      before = JSON.stringify(r.results),
      copy = structuredClone(r.results);
    copy[0].interpretation!.themes = ["推进"];
    copy[1].interpretation!.themes = ["等待"];
    const s = summarize(copy, fixture);
    expect(s.conflict).toContain("并没有完全一致");
    expect(s.related).toBe(true);
    expect(summarize(copy.slice(0, 1), fixture).scope).toHaveLength(1);
    const pref = defaultPreferences(r);
    pref.liked.push("runes");
    pref.pinned.push("tarot");
    summarize(
      r.results.filter((x) => pref.included.includes(x.engine)),
      fixture,
    );
    expect(JSON.stringify(r.results)).toBe(before);
    expect(Object.isFrozen(r.results[0].raw)).toBe(true);
  });
  it("all paragraph text has knowledge, rule and template provenance", () => {
    for (const r of reading().results)
      for (const p of [
        ...r.interpretation!.paragraphs,
        ...r.interpretation!.reflection,
      ]) {
        expect(p.knowledgeId).toBeTruthy();
        expect(p.ruleId).toMatch(/v1$/);
        expect(p.templateId).toMatch(/v[1-9]\d*$/);
      }
  });
  it("a selected engine interprets identically in isolation", () => {
    const raw = drawRunes(seeded());
    const solo = { ...fixture, engines: ["runes" as const] };
    expect(interpret(raw, solo)).toEqual(interpret(raw, fixture));
  });
  it("ordinary action adaptation exposes disagreement without vote", () => {
    const r = structuredClone(reading());
    r.input.mode = "action";
    r.results[0].interpretation!.inclination = "倾向行动";
    r.results[1].interpretation!.inclination = "倾向暂缓";
    expect(summarize(r.results, r.input).inclination).toBe("无明确倾向");
  });
  it("every theme has a scene reflection without keyword inference", () => {
    for (const theme of [
      "推进",
      "准备",
      "审慎",
      "休整",
      "沟通",
      "边界",
      "变化",
      "等待",
    ] as Theme[]) {
      expect(
        inclinationFor([theme], { ...fixture, scene: "一般选择" }).inclination,
      ).toBe("无明确倾向");
    }
  });
});
describe("local records and redaction", () => {
  it("no birthday in reading, traces, JSON or Markdown", () => {
    const r = reading(),
      s = { reading: r, preferences: defaultPreferences(r), savedAt: instant };
    expect(JSON.stringify(r)).not.toContain(fixture.birthday);
    expect(JSON.stringify(r.input)).not.toContain("birthday");
    expect(exportJSON(s)).not.toContain(fixture.birthday);
    expect(readingMarkdown(r)).not.toContain(fixture.birthday);
    expect(readingMarkdown(r)).toContain("出生中间值已脱敏");
  });
  it("can save, restore, delete and clear without redrawing", () => {
    const store = new MemoryStorage(),
      r = reading(),
      s = { reading: r, preferences: defaultPreferences(r), savedAt: instant };
    expect(loadHistory(store).value).toEqual([]);
    expect(saveHistory(store, [s])).toBeNull();
    expect(loadHistory(store).value[0].reading).toEqual(r);
    expect(saveSession(store, s)).toBeNull();
    expect(loadSession(store).value?.reading.readingId).toBe(r.readingId);
    saveHistory(store, []);
    expect(loadHistory(store).value).toEqual([]);
    saveHistory(store, [s]);
    expect(clearHistory(store)).toBeNull();
    expect(store.getItem(HISTORY_KEY)).toBeNull();
  });
  it("storage failures are reported and do not affect calculation", () => {
    const store: StorageLike = {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
      removeItem() {
        throw Error();
      },
    };
    const r = reading(),
      s = { reading: r, preferences: defaultPreferences(r), savedAt: instant };
    expect(loadHistory(store).error).toBeTruthy();
    expect(loadSession(store).error).toBeTruthy();
    expect(saveHistory(store, [s])).toBeTruthy();
    expect(saveSession(store, s)).toBeTruthy();
    expect(clearHistory(store)).toBeTruthy();
    expect(r.results).toHaveLength(5);
  });
  it("corrupt data is detected and not overwritten on read", () => {
    const store = new MemoryStorage();
    for (const bad of ["{broken", "{}", '[{"reading":{}}]']) {
      store.setItem(HISTORY_KEY, bad);
      expect(loadHistory(store).error).toBeTruthy();
      expect(store.getItem(HISTORY_KEY)).toBe(bad);
    }
  });
});
