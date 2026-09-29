import type {
  EngineResult,
  Paragraph,
  Preferences,
  Raw,
  EngineId,
} from "../types";
import { ENGINES } from "../data/meta";
import { TAROT } from "../data/tarot";
import { RUNES } from "../data/runes";
import { hexByCode } from "../data/hexagrams";
import {
  EngineAccent,
  EngineLandscape,
  NumberOrbit,
  TarotArt,
  TarotOrbit,
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
                <TarotOrbit />
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
function ReadingParagraph({ p }: { p: Paragraph }) {
  return (
    <div className="interpretation-block">
      <h4>{p.label}</h4>
      <p>{p.text}</p>
    </div>
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
            <section className="result-reading" aria-label="本站白话">
              <h4 className="reading-section-title">本站白话</h4>
              {i.paragraphs.map((p, n) => (
                <ReadingParagraph p={p} key={n} />
              ))}
            </section>
            <div className="reflection-box">
              {i.reflection.map((p, n) => (
                <ReadingParagraph p={p} key={n} />
              ))}
            </div>
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
