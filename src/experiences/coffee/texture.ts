export type CoffeeSeeds = [number, number, number, number];
export type CoffeeSwirl = { angle: number; travel: number };
export type CoffeePoint = { u: number; v: number };
export type CoffeePatch = { points: CoffeePoint[]; tone: number };
export type CoffeeTexture = { id: string; version: 1; patches: CoffeePatch[] };

// Indexed integer mixing expands already-frozen seeds. No RNG, frame clock,
// symbol names, templates or user question take part in this geometry.
function field(seeds: CoffeeSeeds, index: number): number {
  let value = (seeds[index & 3] ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, Math.round(n)));
export const coffeeTextureId = (seeds: CoffeeSeeds, swirl: CoffeeSwirl) =>
  `cf1-${seeds.map((s) => s.toString(16).padStart(8, "0")).join("")}-${swirl.angle}-${swirl.travel}`;

/** Canonical coordinates: u is angle from the handle; v is centre-to-rim. */
export function buildCoffeeTexture(
  seeds: CoffeeSeeds,
  swirl: CoffeeSwirl,
): CoffeeTexture {
  const patches: CoffeePatch[] = [];
  const turn = swirl.angle / 1440,
    spread = Math.min(1, swirl.travel / 720);
  const blob = (
    u: number,
    v: number,
    ru: number,
    rv: number,
    key: number,
    count = 16,
  ) => {
    const points = Array.from({ length: count }, (_, j) => {
      const a = (j / count) * Math.PI * 2;
      const uneven = 0.58 + field(seeds, key + j) * 0.65;
      return {
        u: clamp(u + Math.cos(a) * ru * uneven, -200, 1200),
        v: clamp(v + Math.sin(a) * rv * uneven, 15, 990),
      };
    });
    patches.push({ points, tone: key % 4 });
  };
  for (let basin = 0; basin < 8; basin++) {
    const cu = field(seeds, basin * 47) * 1000;
    const cv = 180 + field(seeds, basin * 47 + 1) * 570;
    for (let j = 0; j < 5; j++) {
      const key = 200 + basin * 173 + j * 19;
      blob(
        cu + (field(seeds, key) - 0.5) * (85 + spread * 50),
        cv + (field(seeds, key + 1) - 0.5) * 180,
        24 + field(seeds, key + 2) * 63,
        22 + field(seeds, key + 3) * 80,
        key + 5,
      );
    }
  }
  for (let i = 0; i < 14; i++) {
    const key = 2000 + i * 41,
      u = field(seeds, key) * 1000;
    const start = 650 + field(seeds, key + 1) * 300,
      end = 95 + field(seeds, key + 2) * 340;
    const width = 3 + field(seeds, key + 3) * (12 + spread * 12);
    const side = Array.from({ length: 10 }, (_, j) => {
      const t = j / 9;
      return {
        u: clamp(
          u +
            Math.sin(t * 4 + i) * 16 +
            turn * 68 * t +
            t * (field(seeds, key + 4) - 0.5) * 90,
          -200,
          1200,
        ),
        v: clamp(start + (end - start) * t, 15, 990),
      };
    });
    patches.push({
      points: [
        ...side,
        ...side
          .slice()
          .reverse()
          .map((p, j) => ({
            u: clamp(p.u + width * (0.2 + j / 10), -200, 1200),
            v: p.v,
          })),
      ],
      tone: i % 4,
    });
  }
  for (let i = 0; i < 44; i++) {
    const key = 4000 + i * 17,
      basin = i % 8;
    blob(
      field(seeds, basin * 47) * 1000 + (field(seeds, key) - 0.5) * 200,
      180 +
        field(seeds, basin * 47 + 1) * 570 +
        (field(seeds, key + 1) - 0.5) * 200,
      2 + field(seeds, key + 2) * 8,
      3 + field(seeds, key + 3) * 10,
      key + 5,
      8,
    );
  }
  return { id: coffeeTextureId(seeds, swirl), version: 1, patches };
}
