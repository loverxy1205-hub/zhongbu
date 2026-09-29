import type { EngineId, SavedReading } from "../types";

/** Missing fields belong to older, already-visible results. */
export function isEngineRevealed(
  saved: SavedReading,
  engine: EngineId,
): boolean {
  const result = saved.reading.results.find((value) => value.engine === engine);
  if (!result || result.status !== "ok") return true;
  if (engine === "tarot" || engine === "runes") {
    const revealed =
      engine === "tarot" ? saved.tarotRevealed : saved.runeRevealed;
    return (
      revealed === undefined ||
      [0, 1, 2].every((index) => revealed.includes(index))
    );
  }
  return (
    saved.engineRevealed === undefined || saved.engineRevealed.includes(engine)
  );
}

/** Only presentation progress changes; no engine, interpretation or RNG calls. */
export function advanceReveal(
  saved: SavedReading,
  engine: EngineId,
  index?: number,
): SavedReading {
  if (isEngineRevealed(saved, engine)) return saved;
  if (engine === "tarot" || engine === "runes") {
    if (
      index === undefined ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 2
    )
      return saved;
    const key = engine === "tarot" ? "tarotRevealed" : "runeRevealed";
    const previous = saved[key];
    if (!previous || previous.includes(index)) return saved;
    return { ...saved, [key]: [...previous, index] };
  }
  if (!saved.engineRevealed) return saved;
  return { ...saved, engineRevealed: [...saved.engineRevealed, engine] };
}
