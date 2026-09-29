import type {
  EngineResult,
  Paragraph,
  Preferences,
  Raw,
  EngineId,
  Interpretation,
} from "../types";
import { ENGINES } from "../data/meta";
import { TAROT } from "../data/tarot";
import { RUNES } from "../data/runes";
import { hexByCode, TRIGRAMS } from "../data/hexagrams";
import {
  EngineAccent,
  EngineLandscape,
  NumberOrbit,
  TarotArt,
} from "./EngineArt";
export function HexFigure({
  code,
  moving = [],
  label,
}: {
  code: string;
  moving?: number[];
  label: string;
}) {
  return (
    <figure className="hex-figure">
      <div
        className="hex-lines"
        role="img"
        aria-label={`${label}，从下往上 ${code}，动爻 ${moving.join("、") || "无"}`}
      >
        {[...code]
          .map((v, i) => ({ v, n: i + 1 }))
          .reverse()
          .map(({ v, n }) => (
            <div
              className={`hex-line ${v === "0" ? "yin" : ""} ${moving.includes(n) ? "moving" : ""}`}
              key={n}
            >
              <span />
              <span />
              <small>
                {n}
                {moving.includes(n) ? " · 动" : ""}
              </small>
            </div>
          ))}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
export function RawVisual({ raw }: { raw: Raw }) {
  if (raw.kind === "tarot")
    return (
      <div className="triptych tarot-spread">
        {raw.cards.map((d, i) => {
          const c = TAROT.find((c) => c.id === d.id)!;
          return (
            <div key={d.id} className="symbol-slot">
              <span className="position">
                0{i + 1} / {d.position}
              </span>
              <div className={`tarot-tile ${d.reversed ? "reversed" : ""}`}>
                <div className="arcana-art" aria-hidden="true">
                  <TarotArt cardId={d.id} />
                </div>
                <span className="card-number">{c.english}</span>
              </div>
              <strong>{c.name}</strong>
              <small className="card-orientation">
                {d.reversed ? "逆位" : "正位"}
              </small>
            </div>
          );
        })}
      </div>
    );
  if (raw.kind === "runes")
    return (
      <div className="triptych rune-row">
        {raw.runes.map((d, i) => {
          const r = RUNES.find((r) => r.id === d.id)!;
          return (
            <div key={d.id} className="symbol-slot">
              <span className="position">
                0{i + 1} / {d.position}
              </span>
              <div className={`rune-stone rune-stone-${i}`}>
                <span className="rune-engraving">{r.symbol}</span>
                <span className="stone-cut" aria-hidden="true" />
              </div>
              <strong>{r.name}</strong>
              <small>{r.keywords[0]}</small>
            </div>
          );
        })}
      </div>
    );
  if (raw.kind === "numerology")
    return (
      <div className="number-visual">
        <div className="personal-day">
          <NumberOrbit number={raw.day} />
          <span>个人日</span>
          <strong>{raw.day}</strong>
          <small>目标日期的观察主题</small>
        </div>
        <div className="number-context">
          <div>
            生命数字 <b>{raw.life}</b>
          </div>
          <div>
            个人年 <b>{raw.year}</b>
          </div>
          <div>
            个人月 <b>{raw.month}</b>
          </div>
        </div>
      </div>
    );
  const moving = raw.kind === "iching" ? raw.moving : [raw.moving],
    b = hexByCode(raw.code),
    c = hexByCode(raw.changedCode);
  return (
    <div className={`hex-pair hex-pair-${raw.kind}`}>
      <EngineLandscape engine={raw.kind} />
      <HexFigure code={raw.code} moving={moving} label={`本卦 · ${b.name}`} />
      <span className="hex-arrow">
        →<small>{moving.length ? `${moving.join("、")} 爻动` : "无动爻"}</small>
      </span>
      <HexFigure code={raw.changedCode} label={`变卦 · ${c.name}`} />
      <div className="hex-caption">
        上{b.upper}下{b.lower} → 上{c.upper}下{c.lower} · 图中最下方为初爻
      </div>
    </div>
  );
}
function TraceParagraph({ p }: { p: Paragraph }) {
  return (
    <div className="interpretation-block">
      <h4>{p.label}</h4>
      <p>{p.text}</p>
      <details className="trace">
        <summary>追溯依据</summary>
        <code>
          知识 {p.knowledgeId}
          <br />
          规则 {p.ruleId}
          <br />
          模板 {p.templateId}
        </code>
      </details>
    </div>
  );
}
function Originals({ interpretation }: { interpretation: Interpretation }) {
  if (!interpretation.traditional.length) return null;
  return (
    <details className="result-detail">
      <summary>
        {
          "\u4f20\u7edf\u539f\u6587 \u00b7 \u672c\u5366\u3001\u5168\u90e8\u52a8\u723b\u4e0e\u53d8\u5366"
        }
      </summary>
      <div className="classical">
        {interpretation.traditional.map((p, i) => (
          <TraceParagraph p={p} key={i} />
        ))}
      </div>
    </details>
  );
}
function Process({ raw }: { raw: Raw }) {
  if (raw.kind === "tarot")
    return (
      <p>
        使用 Web Crypto 安全随机整数，经拒绝采样与部分洗牌从 78
        张中无放回抽三张。逆位开关开启时，每张独立随机决定正逆位。翻牌动画只展示已冻结结果。
      </p>
    );
  if (raw.kind === "runes")
    return (
      <p>
        使用 Web Crypto 和拒绝采样，从 24 枚 Elder Futhark
        符文无放回抽三枚，依次对应现状、阻力、提示。没有空白符或逆位。
      </p>
    );
  if (raw.kind === "numerology")
    return (
      <ol>
        {raw.trace.map((t) => (
          <li key={t}>{t}</li>
        ))}
        <li>reduce：重复将十进制各位相加至 1–9，不保留大师数。</li>
      </ol>
    );
  if (raw.kind === "iching")
    return (
      <>
        <p>
          固定一面记 2，另一面记 3。表按生成顺序从下往上；图按上爻在上显示。
        </p>
        <table>
          <thead>
            <tr>
              <th>轮次／爻</th>
              <th>三枚硬币</th>
              <th>爻值</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {raw.coins.map((c, i) => (
              <tr key={i}>
                <td>
                  {i + 1}
                  {i === 0 ? "（初爻）" : i === 5 ? "（上爻）" : ""}
                </td>
                <td>{c.join(" + ")}</td>
                <td>{raw.values[i]}</td>
                <td>
                  {
                    {
                      6: "老阴 · 动",
                      7: "少阳 · 静",
                      8: "少阴 · 静",
                      9: "老阳 · 动",
                    }[raw.values[i]]
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          自下而上编码：{raw.code} → {raw.changedCode}；仅 6 与 9 翻转。
        </p>
      </>
    );
  return (
    <>
      <p>
        {raw.local}
        <br />
        {raw.lunar}
        {raw.leap ? "（闰月按其月序数）" : ""}
      </p>
      <dl className="calculation-grid">
        <dt>地支年序 Y</dt>
        <dd>{raw.Y}</dd>
        <dt>农历月序 M</dt>
        <dd>{raw.M}</dd>
        <dt>农历日数 D</dt>
        <dd>{raw.D}</dd>
        <dt>时支序 H</dt>
        <dd>{raw.H}</dd>
      </dl>
      <p>
        R(n,m) = ((n−1) mod m)+1
        <br />
        上卦 R({raw.Y + raw.M + raw.D},8) = {raw.upper}（
        {TRIGRAMS[raw.upper - 1].name}）<br />
        下卦 R({raw.Y + raw.M + raw.D + raw.H},8) = {raw.lower}（
        {TRIGRAMS[raw.lower - 1].name}）<br />
        动爻 R({raw.Y + raw.M + raw.D + raw.H},6) = {raw.moving}
      </p>
      <p>
        使用冻结问卜时刻，而非目标日期。零点换日；23:00–01:00
        为子时（1）；正月初一换年；不做真太阳时校正。
      </p>
    </>
  );
}
export function ResultCard({
  result,
  prefs,
  onToggle,
  onCopy,
}: {
  result: EngineResult;
  prefs: Preferences;
  onToggle: (key: "pinned" | "liked" | "favorites", id: EngineId) => void;
  onCopy: () => void;
}) {
  const meta = ENGINES[result.engine],
    i = result.interpretation;
  return (
    <article
      className={`result-card engine-${result.engine}`}
      data-testid={`result-${result.engine}`}
    >
      <header className="result-header">
        <div className="engine-emblem" aria-hidden="true">
          <EngineAccent engine={result.engine} />
        </div>
        <div>
          <h3>{meta.name}</h3>
          <p>{result.methodVersion}</p>
        </div>
        {prefs.pinned.includes(result.engine) && (
          <span className="pinned-badge">置顶</span>
        )}
      </header>
      {result.status === "unavailable" ? (
        <div className="unavailable">
          <span>本次不可用</span>
          <p>{result.error}</p>
          <small>保留此项状态，其他体系照常展示。</small>
        </div>
      ) : (
        result.raw &&
        i && (
          <>
            <RawVisual raw={result.raw} />
            <div className="theme-row">
              {i.themes.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <p className="reading-headline">{i.headline}</p>
            <details className="result-detail" open>
              <summary>本站白话 · 解读依据</summary>
              {i.paragraphs.map((p, n) => (
                <TraceParagraph p={p} key={n} />
              ))}
            </details>
            <div className="reflection-box">
              {i.reflection.map((p, n) => (
                <TraceParagraph p={p} key={n} />
              ))}
            </div>
            <Originals interpretation={i} />
            <details className="result-detail">
              <summary>计算或抽取过程</summary>
              <Process raw={result.raw} />
              <p className="muted">方法版本：{result.methodVersion}</p>
            </details>
            <details className="result-detail">
              <summary>来源、适用规则与限制</summary>
              <p>
                {i.inclination}：{i.inclinationReason}
              </p>
              {i.sources.map((s, n) => (
                <p key={n}>
                  {s.startsWith("https:") ? (
                    <a href={s} target="_blank" rel="noreferrer">
                      《周易》原典冻结版本 ↗
                    </a>
                  ) : (
                    s
                  )}
                </p>
              ))}
              <ul>
                {i.limits.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          </>
        )
      )}
      <footer className="card-actions">
        <button
          aria-pressed={prefs.pinned.includes(result.engine)}
          onClick={() => onToggle("pinned", result.engine)}
        >
          {prefs.pinned.includes(result.engine) ? "取消置顶" : "↑ 置顶体系"}
        </button>
        <button
          aria-pressed={prefs.favorites.includes(result.engine)}
          onClick={() => onToggle("favorites", result.engine)}
        >
          {prefs.favorites.includes(result.engine) ? "★ 已收藏" : "☆ 收藏本条"}
        </button>
        <button
          aria-pressed={prefs.liked.includes(result.engine)}
          onClick={() => onToggle("liked", result.engine)}
        >
          {prefs.liked.includes(result.engine) ? "✓ 已认同" : "♡ 我更认同"}
        </button>
        <button onClick={onCopy}>复制本条</button>
      </footer>
    </article>
  );
}
