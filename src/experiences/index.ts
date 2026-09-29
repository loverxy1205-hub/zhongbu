import { z } from "zod";
import type {
  EngineId,
  ExperienceId,
  ExperienceState,
  PublicInput,
} from "../types";
import type { RandomSource } from "../lib/random";
import {
  geomancySchema,
  createGeomancy,
  interpretGeomancy,
  canTransitionGeomancy,
} from "./geomancy";
import {
  coffeeSchema,
  createCoffee,
  interpretCoffee,
  canTransitionCoffee,
} from "./coffee";
import { ifaSchema, createIfa, interpretIfa, canTransitionIfa } from "./ifa";
import {
  jiaobeiSchema,
  createJiaobei,
  interpretJiaobei,
  canTransitionJiaobei,
} from "./jiaobei";
import {
  oracleSchema,
  createOracle,
  interpretOracle,
  canTransitionOracle,
} from "./oracle";

export const EXPERIENCE_IDS = [
  "geomancy",
  "coffee",
  "ifa",
  "jiaobei",
  "oracle",
] as const;
export function isExperienceId(id: string): id is ExperienceId {
  return EXPERIENCE_IDS.some((value) => value === id);
}
export function isCoreEngine(
  id: EngineId,
): id is Exclude<EngineId, ExperienceId> {
  return !isExperienceId(id);
}
export function isExperienceRaw(raw: { kind: string }): raw is ExperienceState {
  return isExperienceId(raw.kind);
}
export const experienceSchema = z.union([
  geomancySchema,
  coffeeSchema,
  ifaSchema,
  jiaobeiSchema,
  oracleSchema,
]);
export function createExperience(
  id: ExperienceId,
  rng: RandomSource,
): ExperienceState {
  switch (id) {
    case "geomancy":
      return createGeomancy(rng);
    case "coffee":
      return createCoffee(rng);
    case "ifa":
      return createIfa(rng);
    case "jiaobei":
      return createJiaobei(rng);
    case "oracle":
      return createOracle(rng);
  }
}
export function interpretExperience(raw: ExperienceState, input: PublicInput) {
  switch (raw.kind) {
    case "geomancy":
      return interpretGeomancy(raw, input);
    case "coffee":
      return interpretCoffee(raw, input);
    case "ifa":
      return interpretIfa(raw, input);
    case "jiaobei":
      return interpretJiaobei(raw, input);
    case "oracle":
      return interpretOracle(raw, input);
  }
}
export function canTransitionExperience(
  previous: ExperienceState,
  next: ExperienceState,
): boolean {
  if (previous.kind === "geomancy" && next.kind === "geomancy")
    return canTransitionGeomancy(previous, next);
  if (previous.kind === "coffee" && next.kind === "coffee")
    return canTransitionCoffee(previous, next);
  if (previous.kind === "ifa" && next.kind === "ifa")
    return canTransitionIfa(previous, next);
  if (previous.kind === "jiaobei" && next.kind === "jiaobei")
    return canTransitionJiaobei(previous, next);
  if (previous.kind === "oracle" && next.kind === "oracle")
    return canTransitionOracle(previous, next);
  return false;
}
