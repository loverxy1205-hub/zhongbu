import type { Input, SavedReading } from "../types";
import { TAROT } from "../data/tarot";
import { createReading, deepFreeze } from "../engines/reading";
import { interpret } from "../rules/interpret";
import { cryptoWord, sample, uniformInt, type RandomSource } from "./random";
import { defaultPreferences } from "./storage";

/** A complete shuffled deck is committed once, before any slot is chosen. */
export function createJourney(
  input: Input,
  askedAt: string,
  rng: RandomSource = cryptoWord,
): SavedReading {
  const reading = createReading(input, askedAt, rng, true);
  const tarotDeck = input.engines.includes("tarot")
    ? deepFreeze(
        sample(TAROT, 78, rng).map((card) => ({
          id: card.id,
          reversed: input.reversals && uniformInt(2, rng) === 1,
        })),
      )
    : undefined;
  return {
    reading,
    preferences: defaultPreferences(reading),
    savedAt: "",
    ...(tarotDeck ? { tarotDeck, tarotPicked: [] } : {}),
    tarotRevealed: [],
    runeRevealed: [],
    coinRounds: 0,
    runeDrawn: 0,
    engineRevealed: [],
  };
}

/** Choosing a slot determines its actual card. No RNG, redraw or peer changes. */
export function pickTarot(saved: SavedReading, slot: number): SavedReading {
  const deck = saved.tarotDeck,
    picked = saved.tarotPicked;
  const result = saved.reading.results.find((r) => r.engine === "tarot");
  if (
    !deck ||
    !picked ||
    result?.status !== "pending" ||
    picked.length >= 3 ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= 78 ||
    picked.includes(slot)
  )
    return saved;
  const nextPicked = [...picked, slot];
  if (nextPicked.length < 3) return { ...saved, tarotPicked: nextPicked };
  const positions = ["现状", "阻力", "提示"] as const;
  const raw = {
    kind: "tarot" as const,
    cards: nextPicked.map((index, order) => ({
      ...deck[index],
      position: positions[order],
    })),
  };
  const complete = {
    ...result,
    status: "ok" as const,
    raw,
    interpretation: interpret(raw, saved.reading.input),
  };
  const reading = deepFreeze({
    ...saved.reading,
    results: saved.reading.results.map((r) =>
      r.engine === "tarot" ? complete : r,
    ),
  });
  return {
    ...saved,
    reading,
    tarotPicked: nextPicked,
    tarotRevealed: [0, 1, 2],
  };
}

export function advanceCoinRound(
  saved: SavedReading,
  index: number,
): SavedReading {
  const raw = saved.reading.results.find((r) => r.engine === "iching")?.raw;
  if (
    raw?.kind !== "iching" ||
    saved.coinRounds === undefined ||
    index !== saved.coinRounds ||
    index < 0 ||
    index > 5
  )
    return saved;
  const coinRounds = index + 1;
  return {
    ...saved,
    coinRounds,
    ...(coinRounds === 6
      ? {
          engineRevealed: [
            ...new Set([...(saved.engineRevealed || []), "iching" as const]),
          ],
        }
      : {}),
  };
}

export function drawRuneStone(
  saved: SavedReading,
  index: number,
): SavedReading {
  const raw = saved.reading.results.find((r) => r.engine === "runes")?.raw;
  if (
    raw?.kind !== "runes" ||
    saved.runeDrawn === undefined ||
    index !== saved.runeDrawn ||
    index < 0 ||
    index > 2
  )
    return saved;
  return { ...saved, runeDrawn: index + 1 };
}
