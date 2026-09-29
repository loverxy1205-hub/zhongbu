import type { EngineResult, Input, PublicInput, Raw, Reading } from "../types";
import { ENGINES, ENGINE_IDS, VERSIONS } from "../data/meta";
import { parseDate } from "../lib/dates";
import { cryptoWord, readingId } from "../lib/random";
import type { RandomSource } from "../lib/random";
import {
  calculateMeihua,
  calculateNumbers,
  drawCoins,
  drawRunes,
  drawTarot,
} from "./calculate";
import { interpret } from "../rules/interpret";
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
export function createReading(
  input: Input,
  askedAt = new Date().toISOString(),
  rng: RandomSource = cryptoWord,
): Reading {
  parseDate(input.targetDate);
  if (!input.engines.length) throw Error("请至少选择一套占卜体系");
  if (input.mode === "action" && !input.action.trim())
    throw Error("请明确填写正在考虑的行动");
  if (input.question.length > 2000 || input.action.length > 300)
    throw Error("问题或行动内容过长");
  if (!Number.isFinite(new Date(askedAt).getTime()))
    throw Error("问卜时刻无效");
  const { birthday: _birthday, ...rest } = input;
  const publicInput: PublicInput = structuredClone({
    ...rest,
    engines: [...new Set(input.engines)],
  });
  const id = readingId(rng);
  const results: EngineResult[] = ENGINE_IDS.filter((e) =>
    publicInput.engines.includes(e),
  ).map((engine) => {
    try {
      let raw: Raw;
      switch (engine) {
        case "tarot":
          raw = drawTarot(input.reversals, rng);
          break;
        case "runes":
          raw = drawRunes(rng);
          break;
        case "iching":
          raw = drawCoins(rng);
          break;
        case "meihua":
          raw = calculateMeihua(askedAt, input.timezone);
          break;
        case "numerology":
          raw = calculateNumbers(
            input.birthday,
            input.targetDate,
            askedAt,
            input.timezone,
          );
          break;
      }
      return {
        engine,
        methodVersion: ENGINES[engine].version,
        status: "ok",
        raw,
        interpretation: interpret(raw, publicInput),
      };
    } catch (error) {
      return {
        engine,
        methodVersion: ENGINES[engine].version,
        status: "unavailable",
        error: error instanceof Error ? error.message : "计算不可用",
      };
    }
  });
  return deepFreeze({
    readingId: id,
    askedAt,
    input: publicInput,
    results,
    versions: { ...VERSIONS },
  });
}
