import type {
  EngineResult,
  Paragraph,
  Preferences,
  Raw,
  EngineId,
  SavedReading,
  ExperienceState,
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
import { EngineReveal } from "./EngineReveal";
import { RuneReveal } from "./RuneReveal";
import { TarotDeck } from "./TarotDeck";
import { CoinRitual } from "./CoinRitual";
import { RuneBag } from "./RuneBag";
import { MatrixArt } from "./MatrixArt";
import { isExperienceRaw } from "../experiences";
import { ExperiencePanel } from "../experiences/ExperiencePanel";
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
type TarotRevealProps = {
  tarotRevealed?: readonly number[];
  onRevealTarot?: (index: number) => void;
};
type RuneRevealProps = {
  runeRevealed?: readonly number[];
  onRevealRune?: (index: number) => void;
  motionPaused?: boolean;
};

function TarotBack() {
  return (
    <svg
      className="tarot-back-art"
      viewBox="0 0 96 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 117V45a38 38 0 0 1 76 0v72ZM16 111V45a32 32 0 0 1 64 0v66Z"
        opacity=".5"
      />
      <path d="m48 24 30 40-30 40-30-40Z" opacity=".4" />
      <circle cx="48" cy="64" r="23" />
      <circle cx="48" cy="64" r="28" strokeDasharray="1 4" opacity=".7" />
      <path
        d="M53 47a18 18 0 1 0 11 27 20 20 0 0 1-11-27Z"
        fill="currentColor"
        fillOpacity=".16"
      />
      <path
        d="m48 54 2.8 7.2L58 64l-7.2 2.8L48 74l-2.8-7.2L38 64l7.2-2.8Z"
        fill="currentColor"
        fillOpacity=".4"
      />
      <path d="M48 11v11m-5-5h10M48 106v11m-5-5h10M23 36v6m-3-3h6m44-3v6m-3-3h6M23 86v6m-3-3h6m44-3v6m-3-3h6" />
      <circle cx="48" cy="31" r="1.5" fill="currentColor" />
      <circle cx="48" cy="97" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function RawVisual({
  raw,
  tarotRevealed,
  onRevealTarot,
  runeRevealed,
  onRevealRune,
  motionPaused,
}: { raw: Raw } & TarotRevealProps & RuneRevealProps) {
  if (isExperienceRaw(raw)) return null;
  if (raw.kind === "tarot")
    return (
      <div className="triptych tarot-spread">
        {raw.cards.map((d, i) => {
          const c = TAROT.find((c) => c.id === d.id)!;
          const revealed =
            tarotRevealed === undefined || tarotRevealed.includes(i);
          return (
            <div
              key={d.id}
              className="symbol-slot"
              data-testid={`tarot-slot-${i}`}
              data-revealed={revealed}
            >
              <span className="position">{d.position}</span>
              <button
                type="button"
                className={`tarot-reveal ${revealed ? "is-revealed" : "is-covered"}`}
                data-testid={`tarot-reveal-${i}`}
                aria-label={
                  revealed
                    ? `${c.name}，${d.reversed ? "逆位" : "正位"}，已翻开`
                    : `翻开第 ${i + 1} 张塔罗牌`
                }
                aria-disabled={revealed || !onRevealTarot}
                tabIndex={revealed ? -1 : 0}
                onClick={() => {
                  if (!revealed) onRevealTarot?.(i);
                }}
              >
                <span className="tarot-flipper" aria-hidden="true">
                  <span className="tarot-tile tarot-card-back">
                    <TarotOrbit />
                    <TarotBack />
                    <span className="tarot-back-seal">众 · 卜</span>
                  </span>
                  {revealed && (
                    <span
                      className={`tarot-tile tarot-card-front ${d.reversed ? "reversed" : ""}`}
                    >
                      <TarotOrbit />
                      <span className="arcana-art">
                        <TarotArt cardId={d.id} />
                      </span>
                      <span className="card-number">{c.english}</span>
                    </span>
                  )}
                </span>
              </button>
              <strong
                className={revealed ? "tarot-card-name" : "tarot-covered-label"}
              >
                {revealed ? c.name : "轻触翻开"}
              </strong>
              {revealed ? (
                <small className="card-orientation">
                  {d.reversed ? "逆位" : "正位"}
                </small>
              ) : (
                <small className="tarot-covered-caption">留一刻给直觉</small>
              )}
            </div>
          );
        })}
      </div>
    );
  if (raw.kind === "runes")
    return (
      <div className="triptych rune-row">
        {raw.runes.map((d, i) => {
          if (runeRevealed !== undefined || onRevealRune)
            return (
              <RuneReveal
                key={d.id}
                draw={d}
                index={i}
                revealed={
                  runeRevealed === undefined || runeRevealed.includes(i)
                }
                onReveal={onRevealRune}
                motionPaused={motionPaused}
              />
            );
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
  if (raw.kind === "numerology-matrix") return <MatrixArt raw={raw} />;
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
  tarotRevealed,
  onRevealTarot,
  runeRevealed,
  onRevealRune,
  engineRevealed = true,
  onRevealEngine,
  motionPaused = false,
  journey,
  onPickSlot,
  onCoinRound,
  onDrawRune,
  onExperienceChange,
}: {
  result: EngineResult;
  prefs: Preferences;
  onToggle: (key: "pinned" | "liked" | "favorites", id: EngineId) => void;
  onCopy: () => void;
  engineRevealed?: boolean;
  onRevealEngine?: () => void;
  journey?: SavedReading;
  onPickSlot?: (slot: number) => void;
  onCoinRound?: (index: number) => void;
  onDrawRune?: (index: number) => void;
  onExperienceChange?: (next: ExperienceState) => void;
} & TarotRevealProps &
  RuneRevealProps) {
  const meta = ENGINES[result.engine],
    i = result.interpretation;
  const tarotRaw = result.raw?.kind === "tarot" ? result.raw : undefined;
  const runeRaw = result.raw?.kind === "runes" ? result.raw : undefined;
  const tarotRevealedCount =
    tarotRaw?.cards.filter(
      (_, index) =>
        tarotRevealed === undefined || tarotRevealed.includes(index),
    ).length ?? 0;
  const runeRevealedCount =
    runeRaw?.runes.filter(
      (_, index) => runeRevealed === undefined || runeRevealed.includes(index),
    ).length ?? 0;
  const coveredEngine =
    !engineRevealed &&
    (result.engine === "iching" ||
      result.engine === "meihua" ||
      result.engine === "numerology")
      ? result.engine
      : undefined;
  const canRead =
    result.status === "ok" &&
    !coveredEngine &&
    (!tarotRaw || tarotRevealedCount === tarotRaw.cards.length) &&
    (!runeRaw ||
      ((journey?.runeDrawn === undefined || journey.runeDrawn === 3) &&
        runeRevealedCount === runeRaw.runes.length));
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
      {result.raw && isExperienceRaw(result.raw) && journey ? (
        <>
          <ExperiencePanel
            state={result.raw}
            interpretation={i}
            input={journey.reading.input}
            onChange={(next) => onExperienceChange?.(next)}
            motionPaused={motionPaused}
          />
          {canRead && i && result.engine !== "geomancy" && (
            <section
              className="result-reading new-experience-reading"
              aria-label="本地解读与观察"
            >
              <p className="reading-headline">{i.headline}</p>
              {i.traditional.map((p, n) => (
                <ReadingParagraph p={p} key={`traditional-${n}`} />
              ))}
              {i.paragraphs.map((p, n) => (
                <ReadingParagraph p={p} key={n} />
              ))}
              {i.reflection.map((p, n) => (
                <ReadingParagraph p={p} key={`reflection-${n}`} />
              ))}
            </section>
          )}
        </>
      ) : result.status === "pending" ? (
        <TarotDeck
          deck={journey?.tarotDeck || []}
          selectedSlots={journey?.tarotPicked || []}
          onPick={(slot) => onPickSlot?.(slot)}
          motionPaused={motionPaused}
        />
      ) : result.status === "unavailable" ? (
        <div className="unavailable">
          <span>本次不可用</span>
          <p>{result.error}</p>
          <small>保留此项状态，其他体系照常展示。</small>
        </div>
      ) : (
        result.raw &&
        i && (
          <>
            {result.raw.kind === "iching" &&
              journey?.coinRounds !== undefined && (
                <CoinRitual
                  raw={result.raw}
                  rounds={journey.coinRounds}
                  onRevealRound={(index) => onCoinRound?.(index)}
                  motionPaused={motionPaused}
                />
              )}
            {runeRaw && journey?.runeDrawn !== undefined ? (
              <RuneBag
                draws={runeRaw.runes}
                drawnCount={journey.runeDrawn}
                revealed={runeRevealed || []}
                onDraw={(index) => onDrawRune?.(index)}
                onReveal={(index) => onRevealRune?.(index)}
                motionPaused={motionPaused}
              />
            ) : coveredEngine &&
              !(
                coveredEngine === "iching" && journey?.coinRounds !== undefined
              ) ? (
              <EngineReveal
                engine={coveredEngine}
                onReveal={() => onRevealEngine?.()}
                motionPaused={motionPaused}
              />
            ) : !coveredEngine ? (
              <RawVisual
                raw={result.raw}
                tarotRevealed={tarotRevealed}
                onRevealTarot={onRevealTarot}
                runeRevealed={runeRevealed}
                onRevealRune={onRevealRune}
                motionPaused={motionPaused}
              />
            ) : null}
            {tarotRaw && (
              <p className="tarot-reveal-progress" role="status">
                {canRead
                  ? "三张牌已展开，读一读它们带来的视角。"
                  : `已翻开 ${tarotRevealedCount} / ${tarotRaw.cards.length} 张 · 翻开全部后呈现解读`}
              </p>
            )}
            {runeRaw && (
              <p className="rune-reveal-progress" role="status">
                {canRead
                  ? "三枚符石已显现，读一读它们带来的视角。"
                  : `已撬开 ${runeRevealedCount} / ${runeRaw.runes.length} 枚 · 全部揭晓后呈现解读`}
              </p>
            )}
            {canRead && (
              <>
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
              </>
            )}
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
        {canRead && (
          <>
            <button
              aria-pressed={prefs.favorites.includes(result.engine)}
              onClick={() => onToggle("favorites", result.engine)}
            >
              {prefs.favorites.includes(result.engine)
                ? "★ 已收藏"
                : "☆ 收藏本条"}
            </button>
            <button
              aria-pressed={prefs.liked.includes(result.engine)}
              onClick={() => onToggle("liked", result.engine)}
            >
              {prefs.liked.includes(result.engine) ? "✓ 已认同" : "♡ 我更认同"}
            </button>
            <button onClick={onCopy}>复制本条</button>
          </>
        )}
      </footer>
    </article>
  );
}
