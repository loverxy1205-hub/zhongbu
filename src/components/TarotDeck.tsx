import { useEffect, useRef } from "react";
import type { CardDraw } from "../types";
import { TAROT } from "../data/tarot";
import { TarotArt, TarotOrbit } from "./EngineArt";
import "../interaction-v2.css";

const POSITIONS = ["现状", "阻力", "提示"] as const;

function DeckBack() {
  return (
    <svg
      viewBox="0 0 52 76"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="44" height="68" rx="5" opacity=".45" />
      <path d="m26 12 17 26-17 26L9 38Z" opacity=".45" />
      <circle cx="26" cy="38" r="13" />
      <path
        d="m26 29 2.5 6.5L35 38l-6.5 2.5L26 47l-2.5-6.5L17 38l6.5-2.5Z"
        fill="currentColor"
        fillOpacity=".25"
      />
      <path d="M26 7v5m0 52v5M8 36v4m36-4v4" />
    </svg>
  );
}

/** Every slot maps directly to the parent's already shuffled, frozen deck. */
export function TarotDeck({
  deck,
  selectedSlots,
  onPick,
  motionPaused = false,
}: {
  deck: readonly Pick<CardDraw, "id" | "reversed">[];
  selectedSlots: readonly number[];
  onPick: (slot: number) => void;
  motionPaused?: boolean;
}) {
  const pending = useRef<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = selectedSlots.slice(0, 3);
  const complete = chosen.length === 3;
  useEffect(() => {
    pending.current = null;
  }, [selectedSlots]);

  function pick(slot: number) {
    if (complete || chosen.includes(slot) || pending.current !== null) return;
    pending.current = slot;
    onPick(slot);
  }

  return (
    <div
      className={`tarot-deck${motionPaused ? " interaction-motion-paused" : ""}`}
      data-testid="tarot-deck"
    >
      <div className="deck-heading">
        <span className="interaction-eyebrow">THE THREE-CARD SPREAD</span>
        <h4>
          {complete
            ? "三张牌，三种视角"
            : `${chosen.length ? "再选一张" : "先选一张"}，看看你的${POSITIONS[chosen.length]}`}
        </h4>
        <p role="status">
          {complete
            ? "你的选择已落定。"
            : `已选择 ${chosen.length} / 3 张 · 从下方 ${deck.length} 张牌中选择`}
        </p>
      </div>
      <div className="deck-chosen-row">
        {POSITIONS.map((position, index) => {
          const slot = chosen[index];
          const draw = slot === undefined ? undefined : deck[slot];
          const card = draw && TAROT.find((entry) => entry.id === draw.id);
          return (
            <div
              className={`deck-chosen ${draw ? "is-chosen" : "is-empty"}`}
              key={position}
              data-testid={`tarot-chosen-${index}`}
              data-revealed={Boolean(draw)}
            >
              <span className="position">
                0{index + 1} / {position}
              </span>
              {draw && card ? (
                <>
                  <div
                    className={`deck-result-face tarot-tile ${draw.reversed ? "reversed" : ""}`}
                  >
                    <TarotOrbit />
                    <div className="arcana-art" aria-hidden="true">
                      <TarotArt cardId={draw.id} />
                    </div>
                    <span className="card-number">{card.english}</span>
                  </div>
                  <strong>{card.name}</strong>
                  <small>{draw.reversed ? "逆位" : "正位"}</small>
                </>
              ) : (
                <>
                  <div className="deck-empty-place" aria-hidden="true">
                    <span>✧</span>
                    <i>{index + 1}</i>
                  </div>
                  <strong>
                    {index === chosen.length ? "等待你的选择" : "留一张给这里"}
                  </strong>
                  <small>尚未选牌</small>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="deck-pool-heading">
        <span>星河牌阵</span>
        <small>{deck.length - chosen.length} 张尚未选择</small>
      </div>
      <div
        className="deck-pool"
        role="group"
        aria-label={`${deck.length} 张塔罗牌，选择三张`}
        data-testid="tarot-deck-pool"
      >
        {deck.map((_, slot) => {
          const order = chosen.indexOf(slot);
          const selected = order !== -1;
          return (
            <button
              key={slot}
              ref={(element) => {
                buttons.current[slot] = element;
              }}
              type="button"
              className={`deck-pick${selected ? " is-picked" : ""}`}
              data-testid={`tarot-pick-${slot}`}
              data-selected={selected}
              disabled={selected || complete}
              aria-label={
                selected
                  ? `第 ${slot + 1} 张牌，已选为${POSITIONS[order]}`
                  : `选择第 ${slot + 1} 张牌，作为${POSITIONS[chosen.length] ?? "已完成的牌阵"}`
              }
              onClick={() => pick(slot)}
              onKeyDown={(event) => {
                const columns = getComputedStyle(
                  event.currentTarget.parentElement!,
                ).gridTemplateColumns.split(" ").length;
                const offset = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -columns,
                  ArrowDown: columns,
                }[event.key];
                if (offset === undefined) return;
                event.preventDefault();
                let next = slot + offset;
                while (
                  next >= 0 &&
                  next < deck.length &&
                  buttons.current[next]?.disabled
                )
                  next += offset;
                buttons.current[next]?.focus({ preventScroll: false });
              }}
            >
              <DeckBack />
              {selected && (
                <span className="deck-picked-mark" aria-hidden="true">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!complete && (
        <p className="deck-scroll-hint">向下轻扫牌阵，找到想停留的那一张。</p>
      )}
    </div>
  );
}
