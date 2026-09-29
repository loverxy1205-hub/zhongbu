import type {
  Inclination,
  Interpretation,
  Knowledge,
  Paragraph,
  PublicInput,
  Raw,
  Theme,
} from "../types";
import { TAROT } from "../data/tarot";
import { RUNES } from "../data/runes";
import { MATRIX_NUMBERS, NUMBERS } from "../data/numbers";
import { hexByCode } from "../data/hexagrams";
import { SOURCES } from "../data/meta";
import { renderEvidence, renderPosition, renderReflection } from "./renderText";
// Exact structured-scene + action opt-in. No keyword extraction or hidden polarity reversal.
export const ADAPTED_ACTIONS: Partial<Record<PublicInput["scene"], string[]>> =
  {
    上课安排: ["去上课"],
    任务推进: ["开始整理任务清单"],
    休息安排: ["安排十分钟休息"],
    沟通联系: ["整理想表达的内容"],
  };
export function inclinationFor(
  themes: Theme[],
  input: PublicInput,
): { inclination: Inclination; inclinationReason: string } {
  if (input.mode === "explore")
    return {
      inclination: "无明确倾向",
      inclinationReason: "开放探索仅归纳主题，不做行动判断。",
    };
  if (input.options?.length)
    return {
      inclination: "无明确倾向",
      inclinationReason:
        "本次是多个选项的比较；这组象征不为选项打分，也不替你投票。结合每个选项的实际条件再作判断。",
    };
  if (
    !input.everydayOnly ||
    !ADAPTED_ACTIONS[input.scene]?.includes(input.action.trim())
  )
    return {
      inclination: "无明确倾向",
      inclinationReason:
        "没有与所确认场景、完整行动和日常范围同时匹配的适配规则；仅供象征反思。",
    };
  const go = themes.includes("推进"),
    pause = themes.includes("等待") || themes.includes("休整");
  const inclination: Inclination =
    go && pause
      ? "有条件行动"
      : go
        ? "倾向行动"
        : pause
          ? "倾向暂缓"
          : themes.some((t) =>
                ["准备", "审慎", "边界", "沟通", "变化"].includes(t),
              )
            ? "有条件行动"
            : "无明确倾向";
  return {
    inclination,
    inclinationReason: `规则 action-exact-v1 只匹配「${input.scene} / ${input.action.trim()}」。依据提示／变化主题「${themes.join("、")}」形成象征倾向；不是现实行动指令，仍需用实际条件判断。`,
  };
}
function requireEntry<T extends Knowledge>(items: T[], id: string): T {
  const e = items.find((e) => e.id === id);
  if (!e) throw Error("知识条目不存在");
  return e;
}
export function interpret(raw: Raw, input: PublicInput): Interpretation {
  const paragraphs: Paragraph[] = [],
    traditional: Paragraph[] = [],
    themes: Theme[] = [],
    entries: Knowledge[] = [];
  let hint: Theme[] = [],
    headline = "",
    extraLimits: string[] = [],
    extraSources: string[] = [];
  if (raw.kind === "tarot" || raw.kind === "runes") {
    const draws = raw.kind === "tarot" ? raw.cards : raw.runes;
    draws.forEach((d) => {
      const entry =
        raw.kind === "tarot"
          ? requireEntry(TAROT, d.id)
          : requireEntry(RUNES, d.id);
      const reversed = "reversed" in d && d.reversed;
      const ts =
        reversed && "reversedThemes" in entry
          ? entry.reversedThemes
          : entry.themes;
      const meaning =
        reversed && "reversedMeaning" in entry
          ? entry.reversedMeaning
          : entry.meaning;
      paragraphs.push(
        renderPosition(
          entry,
          d.position,
          meaning,
          raw.kind === "tarot" ? (reversed ? " · 逆位" : " · 正位") : "",
        ),
      );
      themes.push(...ts);
      entries.push(entry);
      if (d.position === "提示") hint = ts;
    });
    headline = `从${entries[0].name}看见「${themes[0]}」，经由阻力位的检视，以「${hint.join("、")}」作为反思入口。`;
    extraLimits =
      raw.kind === "tarot"
        ? [
            "本站抽取约定：无放回抽三张；开启逆位时每张独立以 50% 概率逆位。阻力位不直接作为行动建议。",
          ]
        : ["无放回抽三枚；没有空白符，没有逆位。"];
  } else if (raw.kind === "numerology-matrix") {
    const focused = [...raw.cells]
      .filter((cell) => cell.count > 0)
      .sort((a, b) => b.count - a.count || a.digit - b.digit)
      .slice(0, 2);
    focused.forEach((cell, index) => {
      const e = MATRIX_NUMBERS[cell.digit - 1];
      entries.push(e);
      themes.push(...e.themes);
      paragraphs.push(
        renderEvidence(
          `${index === 0 ? "主视角" : "补充视角"} · ${e.name}`,
          `${cell.count > 1 ? "这个数字在格中重复出现，本次把它作为优先观察的象征。" : "这个数字出现在格中，本次借它打开一个观察角度。"}${e.meaning}`,
          e.id,
          "matrix-focus-v1",
          "matrix-focus-text-v1",
        ),
      );
    });
    headline = `这张九宫格以「${entries.map((entry) => entry.keywords[0]).join("、")}」为本次观察入口；重复与留白只是图案的不同节奏。`;
    hint = [...themes];
    extraLimits = [
      "先选出现次数较多的至多两个数字作为主题；次数相同按数字升序展示，这只是固定的阅读顺序，不代表高低优劣。",
      "空格不表示能力缺失，重复不表示能力更强。不加入四工作数、连线评分或健康、智商、财富判断。",
      "九宫格只使用生日，与目标日期无关；同一生日不会因为再问一次而变化。原始生日不写入结果，格数仍是生日派生的个人数据。",
    ];
  } else if (raw.kind === "numerology") {
    const values = [raw.life, raw.year, raw.month, raw.day],
      labels = ["生命数字", "个人年", "个人月", "个人日"];
    values.forEach((v, i) => {
      const e = NUMBERS[v - 1];
      entries.push(e);
      paragraphs.push(
        renderEvidence(
          `${labels[i]} · ${e.name}`,
          e.meaning,
          e.id,
          `number-role-${i}-v1`,
          `number-${i}-v1`,
        ),
      );
    });
    themes.push(...NUMBERS[raw.day - 1].themes);
    hint = [...themes];
    headline = `目标日期的个人日为 ${raw.day}，本次聚焦「${NUMBERS[raw.day - 1].keywords[0]}」；其余数字只作背景。`;
    extraLimits = [
      "不同日期可能得到相同数字；不保留 11/22/33。出生日期和中间加数已从轨迹剔除。",
    ];
  } else {
    const base = hexByCode(raw.code),
      changed = hexByCode(raw.changedCode),
      moving = raw.kind === "iching" ? raw.moving : [raw.moving];
    traditional.push(
      renderEvidence(
        `本卦 · ${base.name}`,
        base.original || "此卦原文缺失，未作补写。",
        base.id,
        "classic-frozen-v1",
        "classic-verbatim-v1",
      ),
    );
    moving.forEach((n) =>
      traditional.push(
        renderEvidence(
          `第 ${n} 爻动`,
          base.lines[n - 1] || "此爻原文缺失，未作补写。",
          `${base.id}-line-${n}`,
          "classic-frozen-v1",
          "classic-verbatim-v1",
        ),
      ),
    );
    traditional.push(
      renderEvidence(
        `变卦 · ${changed.name}`,
        changed.original || "此卦原文缺失，未作补写。",
        changed.id,
        "classic-frozen-v1",
        "classic-verbatim-v1",
      ),
    );
    base.extra.forEach((t) =>
      traditional.push(
        renderEvidence(
          "附录 · 本版不另作断法",
          t,
          `${base.id}-extra`,
          "classic-frozen-v1",
          "classic-verbatim-v1",
        ),
      ),
    );
    entries.push(base, changed);
    themes.push(...base.themes, ...(moving.length ? changed.themes : []));
    hint = moving.length ? changed.themes : base.themes;
    paragraphs.push(
      renderEvidence(
        `本卦 · ${base.name} · 本站白话`,
        base.meaning,
        base.id,
        "hex-base-v1",
      ),
    );
    for (const n of moving) {
      paragraphs.push(
        renderEvidence(
          `第 ${n} 爻动 · 本站白话`,
          base.lineMeanings[n - 1] || "本站尚无此爻白话，请参照传统原文。",
          `${base.id}-line-${n}`,
          "all-moving-lines-v1",
        ),
      );
    }
    paragraphs.push(
      renderEvidence(
        `变卦 · ${changed.name} · 本站白话`,
        moving.length
          ? `翻转动爻后得到${changed.name}。${changed.meaning} 此处作为变化视角，不视为未来事实。`
          : "本次无动爻，变卦与本卦相同，不另造变化解释。",
        changed.id,
        "hex-change-v1",
      ),
    );
    headline = moving.length
      ? `${base.name}之${changed.name}：从「${base.keywords[0]}」转向「${changed.keywords[0]}」，并列审视变化中的侧重点。`
      : `${base.name}卦，无动爻：围绕「${base.keywords[0]}」观察当前处境。`;
    if (raw.kind === "meihua") {
      paragraphs.push(
        renderEvidence(
          "五行体用 · 简化版",
          `体为${raw.body}，用为${raw.use}。${raw.relationship} 动爻所在三爻卦为用，另一个为体。`,
          `${base.id}-body-use`,
          "body-use-five-elements-v1",
        ),
      );
      extraSources = [SOURCES.meihua];
      extraLimits = [
        "工程约定：正月初一换年；闰月使用其月序数；零点换日；子时 23:00–次日 01:00；不校正真太阳时。",
        "仅按所选时区的本地公历日转换农历；支持 1901–2099 年。采用冻结问卜时刻，不采用目标日期。",
        "周易与梅花属于相关体系，不是两份独立科学证据；体用未计算旺衰、互卦或外应。",
      ];
    } else
      extraLimits = [
        "每枚公平硬币固定一面记 2，另一面记 3；六轮从下往上。6/9 动，7/8 静。并列展示全部动爻，不实现完整六爻纳甲。",
      ];
  }
  const unique = [...new Set(themes)];
  const reflected = [...new Set(hint.length ? hint : unique)].slice(0, 2);
  return {
    headline,
    themes: unique,
    paragraphs,
    traditional,
    reflection: reflected.map((t) =>
      renderReflection(t, input, entries.at(-1)?.id || raw.kind),
    ),
    ...inclinationFor(hint, input),
    sources: [...new Set([...entries.map((e) => e.source), ...extraSources])],
    limits: [...new Set([...entries.map((e) => e.limits), ...extraLimits])],
  };
}
