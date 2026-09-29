/** Ifá graphical facts, not an interpretation corpus. See docs/IFA.md. */
export const IFA_ORIENTATION = "ifa-practitioner-right-first-top-down-v1";
export const IFA_CATALOG_VERSION = "ifa-signatures-2026.09.30-1";

export const IFA_SOURCES = {
  bascom: {
    id: "ifa-bascom-1969",
    title: "William Bascom · Ifa Divination (1969), pp. 3–4, 29, 40–42",
    url: "https://iupress.org/9780253206381/ifa-divination/",
    locator: "Table 1；Chapter III p. 29；Chapter IV pp. 40–42, Figure 2",
  },
  table: {
    id: "ifa-tubi-2020-fig2",
    title: "Paul-Kolade Tubi · Anthropology of Ifa (2020), p. 135, Fig. 2",
    url: "https://www.researchgate.net/publication/361164673_ANTHROPOLOGY_OF_IFA_A_STUDY_OF_TRADITIONAL_EPISTEMOLOGY_ETHICS_AND_WISDOM",
    locator: "OWIJOPPA 4(2), pp. 133–140；p. 135, Fig. 2",
  },
  unesco: {
    id: "ifa-unesco-00146",
    title: "UNESCO · Ifa divination system (00146)",
    url: "https://ich.unesco.org/en/RL/ifa-divination-system-00146",
    locator: "文化范围与口传解释体系；不是图式编码来源",
  },
  instrument: {
    id: "ifa-duke-d059",
    title: "Duke University · Nigerian Yoruba divination chains, D059",
    url: "https://sacredart.caaar.duke.edu/artifacts/pair-of-nigerian-yoruba-ifa-divination-chains-opele-1-green-yellow-beads-and-2-metal-chain-links/",
    locator: "D059，占链器形参考；本站未复制馆藏照片",
  },
} as const;

export interface IfaBaseFigure {
  id: string;
  name: string;
  aliases: readonly string[];
  /** Top to bottom: 1 = concave upward / one mark, 0 = convex upward / two marks. */
  code: string;
  sourceIds: readonly string[];
}

// Figure 2 was checked row by row; this display order is not a divinatory ranking.
// ASCII base names avoid inventing unverified tone marks. General terms retain
// their documented orthography: Ifá, Yorùbá, Odù and òpèlè.
const BASIC_ROWS: readonly [string, string, readonly string[]][] = [
  ["Ogbe", "1111", []],
  ["Oyeku", "0000", []],
  ["Iwori", "0110", []],
  ["Odi", "1001", ["Edi"]],
  ["Irosun", "1100", []],
  ["Owonrin", "0011", []],
  ["Obara", "1000", []],
  ["Okanran", "0001", []],
  ["Ogunda", "1110", []],
  ["Osa", "0111", []],
  ["Ika", "0100", []],
  ["Oturupon", "0010", []],
  ["Otura", "1011", []],
  ["Irete", "1101", []],
  ["Ose", "1010", []],
  ["Ofun", "0101", []],
];

export const baseFigures: readonly IfaBaseFigure[] = BASIC_ROWS.map(
  ([name, code, aliases]) => ({
    id: `ifa-base-${code}`,
    name,
    aliases,
    code,
    sourceIds: [IFA_SOURCES.table.id, IFA_SOURCES.bascom.id],
  }),
);

export interface IfaSignature {
  id: string;
  rightCode: string;
  leftCode: string;
  rightBaseId: string;
  leftBaseId: string;
  paired: boolean;
  /** Deliberately no synthesized compound Odù name or unverifiable aliases. */
  name: null;
  aliases: readonly string[];
  orientation: typeof IFA_ORIENTATION;
  sourceIds: readonly string[];
}

export function signatureId(rightCode: string, leftCode: string): string {
  return `ifa-r${rightCode}-l${leftCode}`;
}

export const signatureCatalog: readonly IfaSignature[] = baseFigures.flatMap(
  (right) =>
    baseFigures.map((left) => ({
      id: signatureId(right.code, left.code),
      rightCode: right.code,
      leftCode: left.code,
      rightBaseId: right.id,
      leftBaseId: left.id,
      paired: right.code === left.code,
      name: null,
      aliases: [],
      orientation: IFA_ORIENTATION,
      sourceIds: [IFA_SOURCES.bascom.id, IFA_SOURCES.table.id],
    })),
);

export function baseForCode(code: string): IfaBaseFigure {
  const figure = baseFigures.find((item) => item.code === code);
  if (!figure) throw Error("Ifá 四行图式无效。");
  return figure;
}

export const ORIENTATION_COPY = [
  "以操作者俯视为准：你在画面下方，自由链端朝向你；链的弯折处在上方。",
  "屏幕右侧是第一列，左侧是第二列；各列都从最上方链片向下读。图式不做镜像。",
  "凹面朝上记单划 I（内部 1）；凸面朝上记双划 II（内部 0）。右列末端一枚标记珠、左列两枚，只用于分清两侧。",
  "内部 0–3 是右列上至下，4–7 是左列上至下。数组存放方式是工程约定，不是额外的传统步骤。",
] as const;
