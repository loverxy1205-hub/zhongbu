import { useCallback, useEffect, useId, useRef } from "react";
import type { EngineId } from "../types";
import { Blossom, Coin } from "./EngineArt";
import "../ritual.css";

const RITUALS: Record<EngineId, { name: string; action: string }> = {
  tarot: { name: "塔罗", action: "星轨流转，牌面将启" },
  iching: { name: "周易", action: "铜钱轻转，阴阳相生" },
  meihua: { name: "梅花易数", action: "一枝花落，观照此刻" },
  numerology: { name: "数字命理", action: "循着数字，听见节律" },
  runes: { name: "卢恩符文", action: "石纹微光，古符低语" },
};

/** Pure decoration: no draws, result values, network calls, or random sources. */
export function EngineMeditation({ engine }: { engine: EngineId }) {
  return (
    <div
      className={`engine-meditation meditation-${engine}`}
      data-testid="engine-meditation"
      data-engine={engine}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 180 150"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {engine === "tarot" && (
          <>
            <ellipse cx="90" cy="75" rx="75" ry="59" opacity=".22" />
            <g className="meditation-star-orbit">
              <path d="M90 9v12m-6-6h12M90 129v12m-6-6h12" />
              <circle cx="19" cy="67" r="2" fill="currentColor" />
              <circle cx="161" cy="86" r="2" fill="currentColor" />
            </g>
            {[0, 1, 2].map((n) => (
              <g key={n} className={`meditation-card meditation-card-${n}`}>
                <rect x="60" y="28" width="60" height="96" rx="7" />
                <rect
                  x="65"
                  y="33"
                  width="50"
                  height="86"
                  rx="4"
                  opacity=".45"
                />
                <path d="M90 43 109 76 90 109 71 76Z" opacity=".5" />
                <path d="M95 58a17 17 0 1 0 10 25 19 19 0 0 1-10-25Z" />
                <path d="M91 68v12m-6-6h12" />
                <circle cx="90" cy="39" r="1.5" fill="currentColor" />
                <circle cx="90" cy="113" r="1.5" fill="currentColor" />
              </g>
            ))}
          </>
        )}
        {engine === "iching" && (
          <>
            <circle cx="90" cy="75" r="57" opacity=".17" />
            <path
              d="M12 128 42 101l24 18 25-30 35 32 19-17 25 24"
              opacity=".3"
            />
            <path
              d="M20 44h31c18 0 13-17 4-14M133 53h23c18 0 10-16 2-10"
              opacity=".45"
            />
            <g className="meditation-coins">
              <Coin x={61} y={60} r={25} />
              <Coin x={119} y={65} r={25} />
              <Coin x={87} y={101} r={25} />
            </g>
          </>
        )}
        {engine === "meihua" && (
          <>
            <circle cx="109" cy="52" r="39" className="meditation-moon" />
            <path
              d="M180 126c-47-17-53-50-72-75L86 16M148 105l-41 8-24-12M121 71l16-30-4-22M109 52 72 49 55 28"
              strokeWidth="2.4"
              opacity=".5"
            />
            <Blossom x={89} y={22} size={0.9} />
            <Blossom x={108} y={51} size={1.1} rotate={20} />
            <Blossom x={134} y={29} size={0.8} rotate={35} />
            <Blossom x={104} y={111} size={0.85} />
            <Blossom x={68} y={47} size={0.8} />
            {[39, 67, 88, 125, 153].map((x, n) => (
              <g key={x} transform={`translate(${x} 0)`}>
                <g className={`meditation-petal meditation-petal-${n}`}>
                  <Blossom x={0} y={0} size={0.5} rotate={n * 23} />
                </g>
              </g>
            ))}
          </>
        )}
        {engine === "numerology" && (
          <>
            <circle cx="90" cy="75" r="53" opacity=".35" />
            <circle cx="90" cy="75" r="65" strokeDasharray="1 7" opacity=".4" />
            <g className="meditation-number-orbit">
              <ellipse
                cx="90"
                cy="75"
                rx="76"
                ry="27"
                transform="rotate(-35 90 75)"
              />
              <ellipse
                cx="90"
                cy="75"
                rx="76"
                ry="27"
                transform="rotate(35 90 75)"
                opacity=".55"
              />
              <path d="m90 28 41 70H49Z M90 122 49 52h82Z" opacity=".35" />
              <circle cx="147" cy="33" r="4" fill="currentColor" />
              <circle cx="42" cy="126" r="2.5" fill="currentColor" />
            </g>
            <path
              d="M90 60v30m-15-15h30m-25-10 20 20m0-20-20 20"
              opacity=".6"
            />
          </>
        )}
        {engine === "runes" && (
          <>
            <g className="meditation-northern-light" opacity=".25">
              <path d="M-10 76Q40 8 95 41t95-5" strokeWidth="15" />
              <path d="M-10 69Q40 1 95 34t95-5" strokeWidth="3" />
            </g>
            {[0, 1, 2].map((n) => (
              <g
                key={n}
                transform={`translate(${28 + n * 49} ${n === 1 ? 27 : 44})`}
              >
                <g className={`meditation-stone meditation-stone-${n}`}>
                  <path d="m3 7 19-7 20 12 2 52-12 15L5 74-5 52Z" />
                  <path
                    d="m6 13 13-4 17 8 1 43-8 12-18-4-8-19Z"
                    opacity=".25"
                  />
                  {n === 0 ? (
                    <path
                      className="meditation-engraving"
                      d="M15 58V22l13 10-13 10m0 0 13 9"
                    />
                  ) : n === 1 ? (
                    <path
                      className="meditation-engraving"
                      d="m9 51 12-29 12 29m-12-29v38"
                    />
                  ) : (
                    <path
                      className="meditation-engraving"
                      d="m12 25 17 31m0-31L12 56"
                    />
                  )}
                </g>
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

export function RitualTransition({
  engines,
  onComplete,
  paused = false,
}: {
  engines: EngineId[];
  onComplete: () => void;
  paused?: boolean;
}) {
  const headingId = useId();
  const captionId = useId();
  const skipRef = useRef<HTMLButtonElement>(null);
  const completed = useRef(false);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(
      finish,
      paused || media.matches ? 80 : 2700,
    );
    const onMotionPreference = () => {
      if (media.matches) finish();
    };
    media.addEventListener("change", onMotionPreference);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", onMotionPreference);
    };
  }, [finish, paused]);

  useEffect(() => {
    const previous = document.activeElement;
    const skip = skipRef.current;
    skip?.focus({ preventScroll: true });
    return () => {
      if (
        document.activeElement === skip &&
        previous instanceof HTMLElement &&
        previous.isConnected
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div
      className={`ritual-transition${paused ? " motion-paused" : ""}`}
      data-testid="ritual-transition"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={captionId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
        } else if (event.key === "Tab") {
          event.preventDefault();
          skipRef.current?.focus();
        }
      }}
    >
      <div className="ritual-window">
        <span className="ritual-eyebrow">众 卜 · 片 刻 观 照</span>
        <h2 id={headingId}>万象，正在展开</h2>
        <p id={captionId}>让心绪落定，听见不同的视角。</p>
        <div className="ritual-ensemble">
          {engines.map((engine) => (
            <div className={`ritual-world ritual-world-${engine}`} key={engine}>
              <EngineMeditation engine={engine} />
              <h3>{RITUALS[engine].name}</h3>
              <p>{RITUALS[engine].action}</p>
            </div>
          ))}
        </div>
        <div className="ritual-progress" aria-hidden="true">
          <span />
        </div>
        <button
          ref={skipRef}
          type="button"
          className="ritual-skip"
          onClick={finish}
        >
          跳过动画
        </button>
      </div>
    </div>
  );
}
