import { buildAiRequest } from "../src/lib/ai";
import { drawTarot } from "../src/engines/calculate";
import { cryptoWord, readingId } from "../src/lib/random";
import { interpret } from "../src/rules/interpret";
import { TAROT } from "../src/data/tarot";
import { ENGINES, VERSIONS } from "../src/data/meta";
import type { PublicInput, Reading, TarotRaw } from "../src/types";

/** Local only: uses exactly the production draw, interpretation and request builder. */
export function generateFixtures(input: PublicInput, askedAt: string) {
  if (TAROT.length !== 78 || new Set(TAROT.map((card) => card.id)).size !== 78)
    throw Error("Expected the complete, unique 78-card deck.");
  if (input.engines.join() !== "tarot" || !input.reversals)
    throw Error(
      "The evaluation requires tarot with independent reversals enabled.",
    );
  const make = (
    id: string,
    group: "random" | "diagnostic",
    raw: TarotRaw,
    reviewNotes: string,
  ) => {
    const reading: Reading = {
      readingId: readingId(cryptoWord),
      askedAt,
      input,
      versions: VERSIONS,
      results: [
        {
          engine: "tarot",
          methodVersion: ENGINES.tarot.version,
          status: "ok",
          raw,
          interpretation: interpret(raw, input),
        },
      ],
    };
    const request = buildAiRequest(reading, "tarot");
    if (
      request.context.question !== input.question ||
      request.context.scene !== input.scene ||
      request.context.targetDate !== input.targetDate ||
      JSON.stringify(request.context.options) !== JSON.stringify(input.options)
    )
      throw Error(
        "Question, scene, options or target date changed during request construction.",
      );
    return { id, group, raw, reviewNotes, request };
  };
  // Generate every random sample before any diagnostic sample. Never reject or
  // replace a draw based on its cards, interpretation, direction or repetition.
  const random = Array.from({ length: 10 }, (_, index) =>
    make(
      `random-${String(index + 1).padStart(2, "0")}`,
      "random",
      drawTarot(true, cryptoWord),
      "未经筛选的随机牌阵。人工核对建议是否结合三张实际牌位与正逆，不预定方向或肯定答案比例。",
    ),
  );
  const diagnostic = [
    make(
      "diagnostic-rest",
      "diagnostic",
      {
        kind: "tarot",
        cards: [
          { id: "tarot-major-3", position: "现状", reversed: true },
          { id: "tarot-major-7", position: "阻力", reversed: true },
          { id: "tarot-2-3", position: "提示", reversed: false },
        ],
      },
      "人工构造的休整／边界对照：皇后逆位、阻力战车逆位、提示宝剑四正位。检查是否认真权衡休整，不能由牌编造生病、疲惫、学校许可等现实事实。此对照不能混入随机样本统计，也不预定必须答可以。",
    ),
    make(
      "diagnostic-progress",
      "diagnostic",
      {
        kind: "tarot",
        cards: [
          { id: "tarot-major-4", position: "现状", reversed: false },
          { id: "tarot-major-12", position: "阻力", reversed: true },
          { id: "tarot-major-7", position: "提示", reversed: false },
        ],
      },
      "人工构造的推进／结构对照：皇帝正位、阻力倒吊人逆位、提示战车正位。检查是否解释实际结构，不以勤奋或服从本身决定答案，不编造出勤规则或处罚。此对照不能混入随机样本统计，也不预定必须答不可以。",
    ),
  ];
  return [...random, ...diagnostic];
}
