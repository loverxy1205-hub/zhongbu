import { useCallback, useEffect, useRef, useState } from "react";
import type { IChingRaw } from "../types";
import { CoinFace } from "./CoinFace";
import "../interaction-v2.css";

const LINE_NAMES = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
const VALUE_NAMES = { 6: "老阴 · 动", 7: "少阳", 8: "少阴", 9: "老阳 · 动" };
// 1450ms flight/bounces + the third coin's 170ms stagger + a short settled beat.
const COIN_TOSS_DURATION_MS = 1670;

/** Six user-paced reveals of existing coin rounds, in bottom-to-top order. */
export function CoinRitual({
  raw,
  rounds,
  onRevealRound,
  motionPaused = false,
}: {
  raw: IChingRaw;
  rounds: number;
  onRevealRound: (index: number) => void;
  motionPaused?: boolean;
}) {
  const count = Math.max(0, Math.min(6, rounds));
  const [rolling, setRolling] = useState<number | null>(null);
  const active = useRef<number | null>(null);
  const committed = useRef(new Set<number>());
  const timer = useRef<number | undefined>(undefined);
  const callback = useRef(onRevealRound);
  useEffect(() => {
    callback.current = onRevealRound;
  }, [onRevealRound]);
  const finish = useCallback(() => {
    const round = active.current;
    if (round === null || committed.current.has(round)) return;
    committed.current.add(round);
    active.current = null;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setRolling(null);
    callback.current(round);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (media.matches) finish();
    };
    if (typeof media.addEventListener === "function")
      media.addEventListener("change", change);
    else media.addListener(change);
    return () => {
      window.clearTimeout(timer.current);
      if (typeof media.removeEventListener === "function")
        media.removeEventListener("change", change);
      else media.removeListener(change);
    };
  }, [finish]);
  useEffect(() => {
    if (motionPaused) finish();
  }, [motionPaused, finish]);

  function begin() {
    if (count >= 6 || active.current !== null || committed.current.has(count))
      return;
    active.current = count;
    if (
      motionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }
    setRolling(count);
    timer.current = window.setTimeout(finish, COIN_TOSS_DURATION_MS);
  }

  const latest = count ? count - 1 : null;
  const displayedRound = rolling ?? latest;
  return (
    <div
      className={`coin-ritual${rolling !== null ? " is-rolling" : ""}${motionPaused ? " interaction-motion-paused" : ""}`}
      data-testid="coin-ritual"
      data-rounds={count}
    >
      <div className="coin-ritual-heading">
        <span className="interaction-eyebrow">SIX MOMENTS OF CHANGE</span>
        <h4>
          {count === 6
            ? "六爻成卦"
            : `第 ${count + 1} 次 · ${LINE_NAMES[count]}`}
        </h4>
        <p>一摇一爻，自下而上，慢慢成形。</p>
      </div>
      <div className="coin-ritual-layout">
        <div className="coin-tableau">
          <button
            type="button"
            className="coin-cast-button"
            data-testid="coin-round-trigger"
            aria-label={
              count === 6 ? "六次铜钱已完成" : `摇第 ${count + 1} 次铜钱`
            }
            aria-busy={rolling !== null}
            disabled={rolling !== null || count === 6}
            onClick={begin}
          >
            <span className="coin-toss-scene" aria-hidden="true">
              <svg
                viewBox="0 0 300 245"
                focusable="false"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <ellipse
                  cx="150"
                  cy="189"
                  rx="130"
                  ry="43"
                  className="coin-casting-mat"
                />
                <ellipse cx="150" cy="189" rx="117" ry="34" opacity=".2" />
                <circle
                  cx="151"
                  cy="112"
                  r="78"
                  strokeDasharray="1 6"
                  opacity=".2"
                />
                <path
                  d="M22 66h34c19 0 14-19 3-14M234 83h40c19 0 14-20 1-15"
                  opacity=".3"
                />
                <path d="m128 213 22-8 22 8-22 8Z" opacity=".25" />
              </svg>
              {[0, 1, 2].map((index) => (
                <CoinFace
                  key={`${displayedRound ?? "preview"}-${index}`}
                  index={index}
                  value={
                    displayedRound === null
                      ? undefined
                      : raw.coins[displayedRound][index]
                  }
                  previousValue={
                    latest === null ? undefined : raw.coins[latest][index]
                  }
                  rolling={rolling !== null}
                />
              ))}
            </span>
            <span className="interaction-cta">
              {count === 6
                ? "六次已完成"
                : rolling !== null
                  ? "铜钱正在落定…"
                  : `摇第 ${count + 1} 次铜钱`}
              <span aria-hidden="true">↗</span>
            </span>
          </button>
          <p className="coin-face-legend">
            乾隆通宝 · 阳（3）<span aria-hidden="true"> / </span>无字 · 阴（2）
          </p>
          <div
            className="coin-latest"
            role="status"
            data-testid="coin-round-result"
          >
            {rolling !== null ? (
              <p>听铜钱落下，等这一爻显现。</p>
            ) : latest !== null ? (
              <>
                <div className="coin-values">
                  {raw.coins[latest].map((value, index) => (
                    <span
                      key={index}
                      role="img"
                      data-side={value === 3 ? "yang" : "yin"}
                      aria-label={`第 ${index + 1} 枚，${value === 3 ? "阳面，乾隆通宝" : "阴面，无字"}，${value} 点`}
                    >
                      <small aria-hidden="true">
                        {value === 3 ? "阳" : "阴"}
                      </small>
                      <span aria-hidden="true">{value}</span>
                    </span>
                  ))}
                  <b>= {raw.values[latest]}</b>
                </div>
                <p>
                  {LINE_NAMES[latest]} · {VALUE_NAMES[raw.values[latest]]}
                </p>
              </>
            ) : (
              <p>轻触铜钱，开启第一摇。</p>
            )}
          </div>
          {rolling !== null && (
            <button type="button" className="interaction-skip" onClick={finish}>
              跳过本轮动画
            </button>
          )}
        </div>
        <ol className="coin-building-lines" aria-label="由下而上生成的六爻">
          {[5, 4, 3, 2, 1, 0].map((index) => {
            const shown = index < count;
            const moving = shown && raw.moving.includes(index + 1);
            return (
              <li
                key={index}
                className={`coin-building-line${shown ? " is-shown" : ""}${moving ? " is-moving" : ""}`}
                data-testid={`coin-line-${index}`}
                data-revealed={shown}
                aria-label={
                  shown
                    ? `${LINE_NAMES[index]}，${VALUE_NAMES[raw.values[index]]}，爻值 ${raw.values[index]}`
                    : `${LINE_NAMES[index]}，尚未摇出`
                }
              >
                <span className="coin-line-name">{LINE_NAMES[index]}</span>
                <span
                  className={`coin-line-strokes${shown && raw.code[index] === "0" ? " is-yin" : ""}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                </span>
                <span className="coin-line-value">
                  {shown ? raw.values[index] : "·"}
                  {moving && <small>动</small>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="interaction-progress">
        已完成 {count} / 6 次
        {count < 6 ? " · 六爻齐备后呈现卦象与解读" : " · 本卦与变卦已就绪"}
      </p>
    </div>
  );
}
