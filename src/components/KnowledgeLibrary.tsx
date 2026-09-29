import { useState } from "react";
import type { Knowledge, Hexagram, TarotCard } from "../types";
const isHex = (e: Knowledge): e is Hexagram => "code" in e;
const isTarot = (e: Knowledge): e is TarotCard => "reversedMeaning" in e;
import { TAROT } from "../data/tarot";
import { RUNES } from "../data/runes";
import { HEXAGRAMS } from "../data/hexagrams";
import { MATRIX_NUMBERS } from "../data/numbers";
import { VERSIONS } from "../data/meta";
import { HexFigure } from "./ResultCard";
import { ExperienceLibrary } from "../experiences/ExperienceLibrary";
export function KnowledgeLibrary() {
  const [tab, setTab] = useState("tarot"),
    [query, setQuery] = useState("");
  const all =
    tab === "tarot"
      ? TAROT
      : tab === "hex"
        ? HEXAGRAMS
        : tab === "runes"
          ? RUNES
          : MATRIX_NUMBERS;
  const items = all.filter((e) =>
    `${e.name} ${e.keywords.join(" ")} ${"english" in e ? e.english : ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="library">
      <div className="section-kicker">
        本地知识库 / 版本 {VERSIONS.knowledge}
      </div>
      <h1>每一种解释，都有来处。</h1>
      <p>
        原典、本站白话和场景反思分别呈现。全部知识随网站打包，阅读与计算不需要联网查询。
      </p>
      <div className="library-methods">
        <ExperienceLibrary />
        <details>
          <summary>生日数字九宫格 · 现代算法约定</summary>
          <p>
            取公历生日 YYYY-MM-DD 中的原始数字，忽略 0
            和分隔符，其余数字逐个填入 1–9 格并保留重复。布局按行为
            1／4／7、2／5／8、3／6／9。不加四工作数，也不加目标日期。
          </p>
          <p>
            这是本站采用的毕达哥拉斯式现代数字象征玩法，不声称由毕达哥拉斯本人提出。次数不是能力、人格、健康、智商或财富评分；空格不是缺陷。选取出现较多的至多两个数字作为观察入口，同次数按数字升序只是固定展示顺序。
          </p>
          <p>
            旧记录继续保留当时的简化个人日计算和解释，不转换成九宫格。新九宫格在相同生日下保持相同图案。
          </p>
        </details>
        <details>
          <summary>梅花易数 · 历法与体用约定</summary>
          <p>
            《梅花易數》卷一「年月日時起例」：以农历年地支序、月序、日数得上卦，加时支序得下卦及动爻。八卦序为乾兑离震巽坎艮坤；R(n,m)=((n−1)
            mod m)+1。动爻所在三爻卦为用，其余为体。
          </p>
          <p>
            lunar-typescript 1.8.6 在本地换算；支持 1901–2099
            年。按选定时区，正月初一换年，闰月用月序数，零点换日，子时
            23:00–01:00，不校正真太阳时。简化五行只比较体用生克，不包含旺衰、互卦和外应。
          </p>
          <p>周易和梅花是相关体系，不能当作两份独立科学证据。</p>
        </details>
        <details>
          <summary>隐私、随机抽取与解释边界</summary>
          <p>
            抽取使用 Web Crypto 与拒绝采样。一次提交生成一个
            readingId，原始结果、解读和版本一并冻结。收藏、排序、认同与汇总范围不会改写各家的结果。
          </p>
          <p>
            本地规则不做自由文本语义推断。问题不进入
            URL。历史记录只有主动保存或收藏时写入本机；为刷新恢复，当前结果暂存于本标签页会话存储。原始生日不写入记录、计算轨迹或导出；仅点击「同意保存生日」后另存于当前浏览器，可随时忘记。九宫格次数是生日派生数据，分享记录前请检查。问题里自行填写的信息仍会保留。
          </p>
          <p>
            点击 DeepSeek 建议后，会发送本次问题、选项与该条结果，经 Cloudflare
            代理联网生成并标为
            AI。生日字段、九宫格全部次数与缺位、其他体系与偏好不发送；数字仅发送已冻结的精选象征主题和白话。模型可能出错；这里没有遥测、登录或支付。
          </p>
        </details>
      </div>
      <div className="library-controls">
        <div className="tabs" aria-label="知识分类">
          {[
            ["tarot", "塔罗 78"],
            ["hex", "周易 64"],
            ["runes", "卢恩 24"],
            ["numbers", "数字 9"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label="搜索知识条目"
          placeholder="搜索名称或主题…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="muted">共 {items.length} 条 · 中文释义为本站自行整理</p>
      <div className="knowledge-grid">
        {items.map((e) => (
          <details className="knowledge-entry" key={e.id}>
            <summary>
              <span>
                {"symbol" in e
                  ? String(e.symbol)
                  : "number" in e
                    ? String(e.number).padStart(2, "0")
                    : "✧"}
              </span>
              <b>{e.name}</b>
              <small>{e.keywords.join(" · ")}</small>
            </summary>
            <p>{e.meaning}</p>
            {isTarot(e) && (
              <p>
                <b>逆位：</b>
                {e.reversedMeaning}
              </p>
            )}
            {isHex(e) && (
              <>
                <HexFigure
                  code={e.code}
                  label={`上${e.upper}下${e.lower} · 自下而上 ${e.code}`}
                />
                <h4>传统原文</h4>
                <p className="classical">{e.original}</p>
                {e.lines.map((l, i) => (
                  <div key={i}>
                    <p className="classical">{l}</p>
                    <p className="muted">本站白话：{e.lineMeanings[i]}</p>
                  </div>
                ))}
                {e.extra.map((t) => (
                  <p className="classical" key={t}>
                    {t}
                  </p>
                ))}
              </>
            )}
            <p>
              <b>适用条件：</b>
              {e.conditions}
            </p>
            <p>
              <b>限制：</b>
              {e.limits}
            </p>
            <p className="muted">
              {e.source.startsWith("https:") ? (
                <a href={e.source} target="_blank" rel="noreferrer">
                  原典版本 ↗
                </a>
              ) : (
                e.source
              )}
            </p>
            <code>{e.id}</code>
          </details>
        ))}
      </div>
    </section>
  );
}
