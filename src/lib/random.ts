export type RandomSource = () => number;
export const cryptoWord: RandomSource = () => {
  if (!globalThis.crypto?.getRandomValues)
    throw Error("此浏览器没有安全随机源，请使用现代浏览器的 HTTPS 页面。");
  return crypto.getRandomValues(new Uint32Array(1))[0];
};
export function uniformInt(
  max: number,
  rng: RandomSource = cryptoWord,
): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32)
    throw Error("随机范围无效");
  const limit = Math.floor(2 ** 32 / max) * max;
  for (let tries = 0; tries < 10000; tries++) {
    const n = rng();
    if (!Number.isInteger(n) || n < 0 || n >= 2 ** 32)
      throw Error("随机源须产生 uint32");
    if (n < limit) return n % max;
  }
  throw Error("随机源无法完成拒绝采样");
}
export function sample<T>(
  items: readonly T[],
  count: number,
  rng: RandomSource,
): T[] {
  if (!Number.isInteger(count) || count < 0 || count > items.length)
    throw Error("抽取数量无效");
  const pool = [...items];
  for (let i = 0; i < count; i++) {
    const j = i + uniformInt(pool.length - i, rng);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
export function readingId(rng: RandomSource): string {
  return `zb-${Array.from({ length: 4 }, () =>
    uniformInt(2 ** 32, rng)
      .toString(16)
      .padStart(8, "0"),
  ).join("")}`;
}
