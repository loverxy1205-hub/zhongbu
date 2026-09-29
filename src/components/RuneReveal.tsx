import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RuneRaw } from "../types";
import { RUNES } from "../data/runes";
import "../rune-reveal.css";

const REVEAL_DURATION_MS = 900;

/** The unbroken rock is generic: no result-derived glyph or name is mounted. */
function SealedRock({ id, index }: { id: string; index: number }) {
  return (
    <svg
      className="rune-sealed-art"
      data-testid={`rune-pry-art-${index}`}
      viewBox="0 0 160 190"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#8caaa0" />
          <stop offset=".42" stopColor="#506f65" />
          <stop offset="1" stopColor="#263e39" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#edf6ef" />
          <stop offset=".38" stopColor="#b5c7bd" />
          <stop offset=".6" stopColor="#597368" />
          <stop offset="1" stopColor="#d6e4d8" />
        </linearGradient>
        <radialGradient id={`${id}-light`}>
          <stop stopColor="#d7f7c2" stopOpacity=".8" />
          <stop offset="1" stopColor="#a4ebba" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        className="rune-ground-shadow"
        cx="80"
        cy="164"
        rx="52"
        ry="10"
      />
      <ellipse
        className="rune-core-glow"
        cx="80"
        cy="101"
        rx="52"
        ry="65"
        fill={`url(#${id}-light)`}
      />
      <g className="rune-rock-half rune-rock-left">
        <path
          d="M80 29 57 26 35 41 22 77 26 129 44 156 74 161 82 140 74 120 85 98 77 80 85 57Z"
          fill={`url(#${id}-stone)`}
        />
        <path
          d="m57 26-8 31-19 28-4 44-4-52 13-36Z"
          fill="#b0c7b4"
          opacity=".24"
        />
        <path d="m49 57 28 23-13 31-31 15-3-41Z" fill="#a8c6b4" opacity=".13" />
        <path
          d="m44 156-11-30 31-15 10 9 8 20-8 21Z"
          fill="#142e26"
          opacity=".32"
        />
        <path
          d="m37 57 12 8-10 14m-4 57 15-6 5 13m5-102 7 6"
          fill="none"
          stroke="#d2dcc4"
          strokeWidth="1"
          opacity=".33"
        />
        <path
          d="m80 29 5 28-8 23 8 18-11 22 8 20-8 21"
          fill="none"
          stroke="#122b23"
          strokeWidth="2.6"
        />
      </g>
      <g className="rune-rock-half rune-rock-right">
        <path
          d="m80 29 26 5 21 25 10 41-8 39-20 23-35-1 8-21-8-20 11-22-8-18 8-23Z"
          fill={`url(#${id}-stone)`}
        />
        <path d="m106 34-5 36-16-13-5-28Z" fill="#c1d3be" opacity=".25" />
        <path
          d="m101 70 26-11 10 41-18 19-34-21-8-18Z"
          fill="#29483d"
          opacity=".6"
        />
        <path
          d="m119 119 10 20-20 23-35-1 8-21-8-20 11-22Z"
          fill="#153027"
          opacity=".36"
        />
        <path
          d="m111 50 4 14-8 9m10 51-10 7 3 11m-17-35 12 6"
          fill="none"
          stroke="#abc9b4"
          strokeWidth="1"
          opacity=".35"
        />
        <path
          d="m82 33 5 24-8 23 8 18-11 22 8 20-7 18"
          fill="none"
          stroke="#bfd4ba"
          strokeWidth="1"
          opacity=".46"
        />
      </g>
      <path
        className="rune-crack-light"
        d="m80 32 5 25-8 23 8 18-11 22 8 20-7 18"
        fill="none"
        stroke="#def3b7"
        strokeWidth="2"
      />
      <g
        className="rune-rock-fragments"
        fill="#799483"
        stroke="#afc5ad"
        strokeWidth=".5"
      >
        <path className="rune-chip rune-chip-1" d="m70 75 8 3-4 9-8-5Z" />
        <path className="rune-chip rune-chip-2" d="m89 104 9 5-4 10-7-4Z" />
        <path className="rune-chip rune-chip-3" d="m70 132 5 3-4 8-7-4Z" />
        <path className="rune-chip rune-chip-4" d="m90 52 6 4-3 6-6-3Z" />
      </g>
      <g className="rune-prybar">
        <path
          d="m84 78 9-7 37-59 8 5-39 60-13 7-4 13-6-2Z"
          fill={`url(#${id}-metal)`}
          stroke="#d6e4d5"
          strokeWidth=".6"
        />
        <path
          d="m123 22 10-16 10 6-10 16Z"
          fill="#bd8d52"
          stroke="#e3c092"
          strokeWidth="1"
        />
        <path d="m126 21 9-14m-5 16 9-14" stroke="#6f4e31" strokeWidth="1" />
        <path
          d="m95 69 28-43"
          stroke="#effbea"
          strokeWidth="1.8"
          opacity=".8"
        />
      </g>
    </svg>
  );
}

export function RuneReveal({
  draw,
  index,
  revealed,
  onReveal,
  motionPaused = false,
}: {
  draw: RuneRaw["runes"][number];
  index: number;
  revealed: boolean;
  onReveal?: (index: number) => void;
  motionPaused?: boolean;
}) {
  const artworkId = useId().replace(/:/g, "");
  const [opening, setOpening] = useState(false);
  const started = useRef(false);
  const completed = useRef(revealed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRevealRef = useRef(onReveal);
  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  const finish = useCallback(() => {
    if (!started.current || completed.current) return;
    completed.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setOpening(false);
    onRevealRef.current?.(index);
  }, [index]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (revealed) {
      completed.current = true;
      if (timer.current !== null) clearTimeout(timer.current);
    }
  }, [revealed]);
  useEffect(() => {
    if (motionPaused) finish();
  }, [motionPaused, finish]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (media.matches) finish();
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", changed);
      return () => media.removeEventListener("change", changed);
    }
    media.addListener(changed);
    return () => media.removeListener(changed);
  }, [finish]);

  function begin() {
    if (revealed || started.current || !onReveal) return;
    started.current = true;
    if (
      motionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }
    setOpening(true);
    timer.current = setTimeout(finish, REVEAL_DURATION_MS);
  }

  const rune = revealed
    ? RUNES.find((entry) => entry.id === draw.id)
    : undefined;
  const state = revealed ? "revealed" : opening ? "opening" : "covered";
  return (
    <div
      className="symbol-slot rune-reveal-slot"
      data-testid={`rune-slot-${index}`}
      data-revealed={revealed}
      data-state={state}
    >
      <span className="position">
        0{index + 1} / {draw.position}
      </span>
      <button
        type="button"
        className={`rune-reveal is-${state}${motionPaused ? " rune-motion-paused" : ""}`}
        data-testid={`rune-reveal-${index}`}
        data-state={state}
        aria-label={
          rune
            ? `${rune.name}，已揭晓`
            : opening
              ? `正在撬开第 ${index + 1} 枚卢恩石`
              : `撬开第 ${index + 1} 枚卢恩石`
        }
        aria-disabled={revealed || opening || !onReveal}
        aria-busy={opening}
        tabIndex={revealed ? -1 : 0}
        onClick={begin}
      >
        <SealedRock id={artworkId} index={index} />
        {rune && (
          <span className={`rune-relic rune-relic-${index}`} aria-hidden="true">
            <span className="rune-engraving">{rune.symbol}</span>
            <span className="rune-relic-ring" />
          </span>
        )}
      </button>
      <strong
        className={revealed ? "rune-revealed-name" : "rune-covered-label"}
      >
        {rune ? rune.name : opening ? "石纹正在松动" : "轻触撬开"}
      </strong>
      <small className="rune-reveal-caption">
        {rune
          ? rune.keywords[0]
          : opening
            ? "微光，即将浮现"
            : "让石中微光显现"}
      </small>
      {opening && !revealed && (
        <button type="button" className="rune-reveal-skip" onClick={finish}>
          跳过第 {index + 1} 枚卢恩揭晓动画
        </button>
      )}
    </div>
  );
}
