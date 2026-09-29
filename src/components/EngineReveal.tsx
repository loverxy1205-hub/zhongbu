import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Blossom, Coin } from "./EngineArt";
import "../reveal.css";

type RevealEngine = "iching" | "meihua" | "numerology";

const REVEAL_COPY: Record<
  RevealEngine,
  { action: string; invitation: string; waiting: string; playing: string }
> = {
  iching: {
    action: "转动铜钱",
    invitation: "三枚铜钱，一刻静观",
    waiting: "轻触铜钱，让眼前的卦象展开。",
    playing: "铜钱轻转，卦象即将展开…",
  },
  meihua: {
    action: "轻触梅花",
    invitation: "一枝花开，等你轻触",
    waiting: "让一朵梅花，带你走进此刻。",
    playing: "梅花轻落，眼前的风景将启…",
  },
  numerology: {
    action: "唤醒数字",
    invitation: "循着数字，遇见今日节律",
    waiting: "轻触中央，让数字流转起来。",
    playing: "数字流转，主题即将呈现…",
  },
};

function RevealArtwork({
  engine,
  playing,
}: {
  engine: RevealEngine;
  playing: boolean;
}) {
  return (
    <span className="reveal-artwork" aria-hidden="true">
      <svg
        viewBox="0 0 320 205"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {engine === "iching" && (
          <>
            <circle cx="163" cy="98" r="75" className="reveal-halo" />
            <circle
              cx="163"
              cy="98"
              r="67"
              strokeDasharray="1 7"
              opacity=".3"
            />
            <circle cx="254" cy="42" r="16" className="reveal-sun" />
            <path
              d="m0 169 37-35 24 17 43-54 49 63 34-33 40 36 44-47 49 43v46H0Z"
              className="reveal-mountain-far"
              stroke="none"
            />
            <path
              d="m0 190 39-28 31 16 42-31 34 28 39-14 40 24 46-27 49 25v22H0Z"
              className="reveal-mountain-near"
              stroke="none"
            />
            <path
              d="M16 58h50c25 0 19-25 3-18M231 88h43c24 0 17-24 1-17M77 184q80-16 166-2"
              opacity=".35"
            />
            <g
              className="reveal-coin-shadows"
              fill="currentColor"
              stroke="none"
              opacity=".12"
            >
              <ellipse cx="106" cy="153" rx="32" ry="6" />
              <ellipse cx="165" cy="146" rx="32" ry="6" />
              <ellipse cx="219" cy="166" rx="29" ry="6" />
            </g>
            <g className="reveal-coins">
              <Coin x={102} y={104} r={32} />
              <Coin x={164} y={76} r={34} />
              <Coin x={219} y={116} r={31} />
            </g>
            <path d="M157 184h12m-6-6v12" opacity=".5" />
          </>
        )}
        {engine === "meihua" && (
          <>
            <circle cx="176" cy="93" r="77" className="reveal-plum-moon" />
            <circle cx="176" cy="93" r="86" opacity=".13" />
            <path
              d="M331 190c-53-25-81-66-123-83l-46-52-20-45M252 146l-66 11-38-20M208 107l29-46-5-37M174 69l-53-6-28-28M156 43l20-24"
              className="reveal-plum-branch"
              strokeWidth="4"
            />
            <path
              d="m200 142-20-22-27-5m-19-48-18 17m119-33 23-15M146 22l-16-5"
              className="reveal-plum-branch"
              strokeWidth="1.8"
            />
            <Blossom x={144} y={17} size={1.3} rotate={20} />
            <Blossom x={116} y={63} size={1.2} rotate={15} />
            <Blossom x={234} y={33} size={1.4} rotate={40} />
            <Blossom x={241} y={134} size={1.4} />
            <Blossom x={184} y={156} size={1.1} rotate={25} />
            <g transform="translate(172 76)">
              <g className="reveal-picked-blossom">
                <Blossom x={0} y={0} size={2.15} rotate={12} />
              </g>
            </g>
            {[
              [124, 62],
              [235, 44],
              [156, 121],
              [192, 151],
            ].map(([x, y], index) => (
              <g key={index} transform={`translate(${x} ${y})`}>
                <path
                  className={`reveal-loose-petal reveal-loose-petal-${index}`}
                  d="M0 0c-10-12-15 2-4 10C5 8 7 1 0 0Z"
                />
              </g>
            ))}
            <path d="M26 186q79-14 137 0t131 0" opacity=".19" />
            <path d="M62 70h8m-4-4v8M76 149h6m-3-3v6" opacity=".3" />
          </>
        )}
        {engine === "numerology" && (
          <>
            <circle cx="160" cy="102" r="74" className="reveal-number-halo" />
            <circle cx="160" cy="102" r="61" opacity=".24" />
            <circle
              cx="160"
              cy="102"
              r="84"
              strokeDasharray="1 7"
              opacity=".45"
            />
            <g className="reveal-number-orbits">
              <ellipse
                cx="160"
                cy="102"
                rx="123"
                ry="43"
                transform="rotate(-24 160 102)"
              />
              <ellipse
                cx="160"
                cy="102"
                rx="123"
                ry="43"
                transform="rotate(24 160 102)"
                opacity=".42"
              />
              <circle
                cx="270"
                cy="56"
                r="4.5"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="48"
                cy="143"
                r="3"
                fill="currentColor"
                stroke="none"
              />
              <path d="M217 161v11m-5.5-5.5h11M87 38v8m-4-4h8" />
            </g>
            <path d="m160 32 61 105H99ZM160 172l-61-105h122Z" opacity=".17" />
            <path d="M34 104h8m236 0h8M160 15v8m0 159v8" opacity=".35" />
          </>
        )}
      </svg>
      {engine === "numerology" && (
        <span className="reveal-number-window">
          {playing ? (
            <span className="reveal-digit-strip">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <span key={digit}>{digit}</span>
              ))}
            </span>
          ) : (
            <span className="reveal-dormant-digit">0</span>
          )}
        </span>
      )}
    </span>
  );
}

/** Reveals an already frozen result; this component never calculates or draws. */
export function EngineReveal({
  engine,
  onReveal,
  motionPaused,
}: {
  engine: RevealEngine;
  onReveal: () => void;
  motionPaused: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const completed = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const onRevealRef = useRef(onReveal);
  const hintId = useId();
  const copy = REVEAL_COPY[engine];

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    onRevealRef.current();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (media.matches && started.current) finish();
    };
    media.addEventListener("change", onMotionChange);
    return () => {
      window.clearTimeout(timer.current);
      media.removeEventListener("change", onMotionChange);
    };
  }, [finish]);

  useEffect(() => {
    if (motionPaused && started.current) finish();
  }, [motionPaused, finish]);

  function begin() {
    if (started.current || completed.current) return;
    started.current = true;
    if (
      motionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }
    setPlaying(true);
    timer.current = window.setTimeout(finish, 1100);
  }

  return (
    <div
      className={`engine-reveal reveal-${engine}${playing ? " is-playing" : ""}`}
      data-testid={`engine-reveal-${engine}`}
      data-state={playing ? "playing" : "ready"}
    >
      <button
        type="button"
        className="engine-reveal-trigger"
        data-testid={`reveal-${engine}`}
        aria-label={copy.action}
        aria-describedby={hintId}
        aria-busy={playing}
        disabled={playing}
        onClick={begin}
      >
        <span className="reveal-invitation">{copy.invitation}</span>
        <RevealArtwork engine={engine} playing={playing} />
        <span className="reveal-action">
          {copy.action}
          <span aria-hidden="true">↗</span>
        </span>
      </button>
      <p id={hintId} className="reveal-hint" role="status">
        {playing ? copy.playing : copy.waiting}
      </p>
      {playing && (
        <button type="button" className="engine-reveal-skip" onClick={finish}>
          跳过揭晓动画
        </button>
      )}
    </div>
  );
}
