import type {
  EngineResult,
  Input,
  PublicInput,
  LegacyRaw,
  Reading,
} from "../types";
import { isExperienceId, createExperience } from "../experiences";
import { ENGINES, ENGINE_IDS, VERSIONS } from "../data/meta";
import { parseDate } from "../lib/dates";
import { cryptoWord, readingId } from "../lib/random";
import type { RandomSource } from "../lib/random";
import {
  calculateMeihua,
  calculateNumberMatrix,
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
  interactiveTarot = false,
): Reading {
  parseDate(input.targetDate);
  if (!input.engines.length) throw Error("请至少选择一套占卜体系");
  const options =
    input.mode === "action"
      ? input.options?.map((option) => option.trim())
      : undefined;
  if (input.mode === "action") {
    if (!options || options.length < 2 || options.length > 10)
      throw Error("请填写至少两个选项，最多可以比较十个选项。");
    if (options.some((option) => !option || option.length > 300))
      throw Error("每个选项都需要填写，且不能超过 300 字。");
    if (new Set(options).size !== options.length)
      throw Error("选项不能完全相同，请写出不同的选择。");
  }
  if (input.question.length > 2000 || input.action.length > 300)
    throw Error("问题或行动内容过长");
  if (!Number.isFinite(new Date(askedAt).getTime()))
    throw Error("问卜时刻无效");
  const {
    birthday: _birthday,
    category: _category,
    options: _options,
    ...rest
  } = input;
  const publicInput: PublicInput = structuredClone({
    ...rest,
    ...(options ? { options, action: "" } : {}),
    engines: [...new Set(input.engines)],
  });
  const id = readingId(rng);
  const results: EngineResult[] = ENGINE_IDS.filter((e) =>
    publicInput.engines.includes(e),
  ).map((engine) => {
    if (engine === "tarot" && interactiveTarot)
      return {
        engine,
        methodVersion: ENGINES[engine].version,
        status: "pending",
      };
    try {
      if (isExperienceId(engine))
        return {
          engine,
          methodVersion: ENGINES[engine].version,
          status: "pending",
          raw: createExperience(engine, rng),
        };
      let raw: LegacyRaw;
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
          raw = calculateNumberMatrix(input.birthday, askedAt, input.timezone);
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
