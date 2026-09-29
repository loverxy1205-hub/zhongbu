import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RuneRaw } from "../types";
import { RuneReveal } from "./RuneReveal";
import "../interaction-v2.css";

function BagStone() {
  return (
    <svg viewBox="0 0 88 104" aria-hidden="true" focusable="false">
      <path
        d="m26 8 34 3 19 24-3 43-20 19-33-4L9 68l3-35Z"
        fill="#567465"
        stroke="#a3bd9f"
        strokeWidth="1.3"
      />
      <path
        d="m26 8 7 23-17 27 7 35M33 31l34 7 9 40M33 31l10 40 13 26"
        fill="none"
        stroke="#d0d6b8"
        strokeWidth=".8"
        opacity=".27"
      />
    </svg>
  );
}

/** The bag yields the existing three stones; rune faces stay sealed until all arrive. */
export function RuneBag({
  draws,
  drawnCount,
  revealed,
  onDraw,
  onReveal,
  motionPaused = false,
}: {
  draws: RuneRaw["runes"];
  drawnCount: number;
  revealed: readonly number[];
  onDraw: (index: number) => void;
  onReveal: (index: number) => void;
  motionPaused?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const count = Math.max(0, Math.min(3, drawnCount));
  const [drawing, setDrawing] = useState<number | null>(null);
  const active = useRef<number | null>(null);
  const committed = useRef(new Set<number>());
  const timer = useRef<number | undefined>(undefined);
  const callback = useRef(onDraw);
  useEffect(() => {
    callback.current = onDraw;
  }, [onDraw]);
  const finish = useCallback(() => {
    const index = active.current;
    if (index === null || committed.current.has(index)) return;
    committed.current.add(index);
    active.current = null;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setDrawing(null);
    callback.current(index);
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
    if (count >= 3 || active.current !== null || committed.current.has(count))
      return;
    active.current = count;
    if (
      motionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }
    setDrawing(count);
    timer.current = window.setTimeout(finish, 850);
  }

  return (
    <div
      className={`rune-bag${drawing !== null ? " is-drawing" : ""}${count === 3 ? " is-emptied" : ""}${motionPaused ? " interaction-motion-paused" : ""}`}
      data-testid="rune-bag"
      data-drawn-count={count}
    >
      <div className="rune-bag-heading">
        <span className="interaction-eyebrow">STONES FROM THE NORTH</span>
        <h4>{count === 3 ? "三枚符石，等你开启" : "探入布袋，取一枚符石"}</h4>
        <p role="status">
          {count === 3
            ? "逐一撬开石壳，看看其中的符文。"
            : `已取出 ${count} / 3 枚 · 取齐后再一起撬开`}
        </p>
      </div>
      {count < 3 && (
        <>
          <button
            type="button"
            className="rune-bag-trigger"
            data-testid="rune-bag-draw"
            aria-label={`从布袋取出第 ${count + 1} 枚符石`}
            aria-busy={drawing !== null}
            disabled={drawing !== null}
            onClick={begin}
          >
            <span className="rune-bag-scene" aria-hidden="true">
              <svg viewBox="0 0 320 235" fill="none" focusable="false">
                <defs>
                  <linearGradient
                    id={`${id}-cloth`}
                    x1=".1"
                    y1="0"
                    x2=".9"
                    y2="1"
                  >
                    <stop stopColor="#647f69" />
                    <stop offset=".48" stopColor="#365345" />
                    <stop offset="1" stopColor="#203b32" />
                  </linearGradient>
                  <pattern
                    id={`${id}-weave`}
                    width="5"
                    height="5"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M0 0h5M0 0v5"
                      stroke="#b7c1a1"
                      strokeWidth=".4"
                      opacity=".2"
                    />
                  </pattern>
                </defs>
                <ellipse
                  cx="160"
                  cy="216"
                  rx="87"
                  ry="11"
                  fill="#071d17"
                  opacity=".55"
                />
                <circle
                  cx="160"
                  cy="119"
                  r="95"
                  stroke="#adbf9640"
                  strokeDasharray="1 8"
                />
                <g className="rune-cloth-bag">
                  <path
                    d="m122 48 11 29c-20 16-45 56-47 86-4 34 23 49 74 49s78-15 74-49c-2-30-27-70-47-86l11-29c-29-9-47 10-76 0Z"
                    fill={`url(#${id}-cloth)`}
                    stroke="#b0bd9380"
                    strokeWidth="1.4"
                  />
                  <path
                    d="m122 48 11 29c-20 16-45 56-47 86-4 34 23 49 74 49s78-15 74-49c-2-30-27-70-47-86l11-29c-29-9-47 10-76 0Z"
                    fill={`url(#${id}-weave)`}
                  />
                  <path
                    d="m138 83-22 86m64-84 26 97m-43-94 4 106m-44-39-3 43"
                    stroke="#d0c8a0"
                    strokeWidth="2"
                    opacity=".14"
                  />
                  <path
                    d="M133 76q27 9 54 0m-52 7q25 9 50 0"
                    stroke="#d8be86"
                    strokeWidth="3"
                  />
                  <path
                    d="M135 80c-28-18-43 3-20 12 14 5 27-13 27-13m43 2c20-25 41-4 19 8-12 6-25-9-25-9m-36 3-30 35m66-35 25 44"
                    stroke="#ccb582"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="m160 113-24 33h14l-19 24h23v17h12v-17h23l-19-24h14Z"
                    stroke="#d1cda1"
                    strokeWidth="1.1"
                    opacity=".55"
                  />
                  <path
                    d="M114 194q46 18 92 0"
                    stroke="#acb293"
                    strokeDasharray="2 4"
                    opacity=".35"
                  />
                </g>
                <path
                  d="M45 97v10m-5-5h10m216 11v8m-4-4h8M231 43v8m-4-4h8"
                  stroke="#acc89d"
                  opacity=".45"
                />
              </svg>
              {drawing !== null && (
                <span className="rune-emerging-stone">
                  <BagStone />
                </span>
              )}
            </span>
            <span className="interaction-cta">
              {drawing !== null
                ? "一枚符石正在来到掌心…"
                : `取出第 ${count + 1} 枚符石`}
              <span aria-hidden="true">↗</span>
            </span>
          </button>
          {drawing !== null && (
            <button type="button" className="interaction-skip" onClick={finish}>
              跳过取石动画
            </button>
          )}
        </>
      )}
      <div
        className={`triptych rune-bag-stones${count === 3 ? " rune-row" : ""}`}
      >
        {draws.map((draw, index) =>
          count === 3 ? (
            <RuneReveal
              key={index}
              draw={draw}
              index={index}
              revealed={revealed.includes(index)}
              onReveal={onReveal}
              motionPaused={motionPaused}
            />
          ) : (
            <div
              className={`rune-waiting-stone${index < count ? " is-drawn" : ""}`}
              key={index}
              data-testid={`rune-drawn-${index}`}
              data-drawn={index < count}
            >
              <span className="position">
                0{index + 1} / {draw.position}
              </span>
              <div className="rune-stone-place" aria-hidden="true">
                {index < count ? <BagStone /> : <span>✧</span>}
              </div>
              <strong>{index < count ? "已来到掌心" : "还在布袋中"}</strong>
              <small>
                {index < count ? "等三枚齐聚再撬开" : "静候你的选择"}
              </small>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
