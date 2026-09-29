import { Solar } from "lunar-typescript";
import type {
  CardDraw,
  CoinValue,
  IChingRaw,
  MeihuaRaw,
  NumberRaw,
  NumberMatrixRaw,
  RuneRaw,
  TarotRaw,
} from "../types";
import { TAROT } from "../data/tarot";
import { RUNES } from "../data/runes";
import { TRIGRAMS } from "../data/hexagrams";
import { parseDate, zonedParts } from "../lib/dates";
import { sample, uniformInt } from "../lib/random";
import type { RandomSource } from "../lib/random";
import { MATRIX_DIGITS } from "../data/numbers";
const POSITIONS = ["现状", "阻力", "提示"] as const;
export function drawTarot(reversals: boolean, rng: RandomSource): TarotRaw {
  const cards: CardDraw[] = sample(TAROT, 3, rng).map((c, i) => ({
    id: c.id,
    position: POSITIONS[i],
    reversed: reversals && uniformInt(2, rng) === 1,
  }));
  return { kind: "tarot", cards };
}
export function drawRunes(rng: RandomSource): RuneRaw {
  return {
    kind: "runes",
    runes: sample(RUNES, 3, rng).map((r, i) => ({
      id: r.id,
      position: POSITIONS[i],
    })),
  };
}
export function coinValue(coins: number[]): CoinValue {
  if (coins.length !== 3 || coins.some((v) => v !== 2 && v !== 3))
    throw Error("每轮须有三枚记为 2 或 3 的硬币");
  return coins.reduce((a, b) => a + b, 0) as CoinValue;
}
export function codesFromValues(values: CoinValue[]) {
  if (values.length !== 6 || values.some((v) => ![6, 7, 8, 9].includes(v)))
    throw Error("需要六个有效爻值");
  const code = values.map((v) => v % 2).join("");
  const moving = values.flatMap((v, i) => (v === 6 || v === 9 ? [i + 1] : []));
  return { code, moving, changedCode: flipLines(code, moving) };
}
export function flipLines(code: string, moving: number[]) {
  if (
    !/^[01]{6}$/.test(code) ||
    moving.some((i) => !Number.isInteger(i) || i < 1 || i > 6)
  )
    throw Error("动爻或卦编码无效");
  return [...code]
    .map((v, i) => (moving.includes(i + 1) ? (v === "1" ? "0" : "1") : v))
    .join("");
}
export function drawCoins(rng: RandomSource): IChingRaw {
  const coins = Array.from({ length: 6 }, () =>
    Array.from({ length: 3 }, () => 2 + uniformInt(2, rng)),
  );
  const values = coins.map(coinValue);
  return { kind: "iching", coins, values, ...codesFromValues(values) };
}
export function R(n: number, m: number) {
  return ((((n - 1) % m) + m) % m) + 1;
}
export function meihuaNumbers(Y: number, M: number, D: number, H: number) {
  if (
    [Y, M, D, H].some((n) => !Number.isInteger(n)) ||
    Y < 1 ||
    Y > 12 ||
    M < 1 ||
    M > 12 ||
    D < 1 ||
    D > 30 ||
    H < 1 ||
    H > 12
  )
    throw Error("年月日時序数越界");
  const upper = R(Y + M + D, 8),
    lower = R(Y + M + D + H, 8),
    moving = R(Y + M + D + H, 6);
  const u = TRIGRAMS[upper - 1],
    l = TRIGRAMS[lower - 1];
  const body = moving <= 3 ? u : l,
    use = moving <= 3 ? l : u;
  const generates: Record<string, string> = {
    木: "火",
    火: "土",
    土: "金",
    金: "水",
    水: "木",
  };
  const overcomes: Record<string, string> = {
    木: "土",
    土: "水",
    水: "火",
    火: "金",
    金: "木",
  };
  const relationship =
    body.element === use.element
      ? "体用比和：象征相近力量的配合。"
      : generates[use.element] === body.element
        ? "用生体：象征外部支持，可思考怎样承接。"
        : generates[body.element] === use.element
          ? "体生用：象征向外投入，可思考资源是否充足。"
          : overcomes[use.element] === body.element
            ? "用克体：象征外部约束，可思考自己的承受边界。"
            : "体克用：象征主动管理，可思考控制的分寸。";
  const code = l.code + u.code;
  return {
    Y,
    M,
    D,
    H,
    upper,
    lower,
    moving,
    code,
    changedCode: flipLines(code, [moving]),
    body: `${body.name}（${body.element}）`,
    use: `${use.name}（${use.element}）`,
    relationship,
  };
}
export function calculateMeihua(instant: string, timezone: string): MeihuaRaw {
  const p = zonedParts(instant, timezone);
  const lunar = Solar.fromYmd(p.year, p.month, p.day).getLunar();
  const lunarYear = lunar.getYear(),
    month = lunar.getMonth(),
    day = lunar.getDay();
  // getYear() is the lunar year changing on lunar new year, not 立春.
  const Y = ((((lunarYear - 4) % 12) + 12) % 12) + 1,
    H = (Math.floor((p.hour + 1) / 2) % 12) + 1;
  const result = meihuaNumbers(Y, Math.abs(month), day, H);
  return {
    kind: "meihua",
    ...result,
    lunar: `农历 ${lunarYear} 年${month < 0 ? "闰" : ""}${Math.abs(month)}月${day}日`,
    local: p.display,
    leap: month < 0,
  };
}
export function digitSum(n: number): number {
  return String(n)
    .split("")
    .reduce((s, d) => s + Number(d), 0);
}
export function reduce(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw Error("归一输入必须是正整数");
  while (n > 9) n = digitSum(n);
  return n;
}
export function calculateNumbers(
  birthday: string,
  target: string,
  askedAt: string,
  timezone: string,
): NumberRaw {
  if (!birthday) throw Error("未提供出生日期；其余体系照常展示。");
  const b = parseDate(birthday),
    t = parseDate(target);
  if (birthday > zonedParts(askedAt, timezone).date || birthday > target)
    throw Error("出生日期不能晚于问卜日或目标日期");
  const life = reduce(digitSum(b.year) + digitSum(b.month) + digitSum(b.day));
  const year = reduce(b.month + b.day + digitSum(t.year)),
    month = reduce(year + t.month),
    day = reduce(month + t.day);
  return {
    kind: "numerology",
    life,
    year,
    month,
    day,
    trace: [
      `生命数字 = reduce(出生日期全部数字之和) = ${life}；出生中间值已脱敏`,
      `个人年 = reduce(出生月 + 出生日 + 目标年份数字和) = ${year}；出生中间值已脱敏`,
      `个人月 = reduce(${year} + ${t.month}) = ${month}`,
      `个人日 = reduce(${month} + ${t.day}) = ${day}`,
    ],
  };
}

/** Birthday-digit matrix: a modern site convention, not a historical claim. */
export function calculateNumberMatrix(
  birthday: string,
  askedAt: string,
  timezone: string,
): NumberMatrixRaw {
  if (!birthday) throw Error("未提供出生日期；其余体系照常展示。");
  parseDate(birthday);
  if (birthday > zonedParts(askedAt, timezone).date)
    throw Error("出生日期不能晚于问卜日");
  const cells = MATRIX_DIGITS.map((digit) => ({
    digit,
    count: [...birthday].filter((character) => character === String(digit)).length,
  }));
  return {
    kind: "numerology-matrix",
    cells,
    trace: [
      "生日的公历 YYYY-MM-DD 原始数字逐个入格；忽略 0 和分隔符，保留 1–9 的重复次数。",
      "布局按行依次为 1 / 4 / 7、2 / 5 / 8、3 / 6 / 9；不添加四工作数，不求个人日，不对目标日期加数。",
      "出生中间值已脱敏；不保留生日及原始数字顺序。格数仍属于由生日导出的个人数据。",
    ],
  };
}
