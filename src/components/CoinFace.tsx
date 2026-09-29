import { useId } from "react";
import type { CSSProperties } from "react";
import "../coin-face.css";

/** A two-sided display coin. The parent supplies every frozen landing value. */
export function CoinFace({
  value,
  previousValue,
  index,
  rolling,
}: {
  value?: number;
  previousValue?: number;
  index: number;
  rolling: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const settledValue = value === 2 || value === 3 ? value : undefined;
  // Before the first throw these are simply the two decorative sample faces.
  const previewValue = index === 1 ? 2 : 3;
  const face = settledValue ?? previewValue;
  const previous =
    previousValue === 2 || previousValue === 3 ? previousValue : previewValue;
  const style = {
    "--coin-rest-face": face === 3 ? "0deg" : "180deg",
    "--coin-start-face": previous === 3 ? "0deg" : "180deg",
    "--coin-spin-stop": face === 3 ? "1800deg" : "1980deg",
  } as CSSProperties;

  function faceArtwork(front: boolean) {
    const suffix = front ? "front" : "back";
    return (
      <svg
        className="cast-coin-art"
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient
            id={`${id}-${suffix}-brass`}
            cx="32%"
            cy="23%"
            r="83%"
          >
            <stop stopColor={front ? "#f4d990" : "#ddc07a"} />
            <stop offset=".47" stopColor={front ? "#cfa459" : "#bc954f"} />
            <stop offset=".79" stopColor={front ? "#d9b361" : "#cca660"} />
            <stop offset="1" stopColor="#947039" />
          </radialGradient>
          <linearGradient
            id={`${id}-${suffix}-rim`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop stopColor="#ffe6a3" />
            <stop offset=".35" stopColor="#ad7d36" />
            <stop offset=".7" stopColor="#e2c074" />
            <stop offset="1" stopColor="#694c29" />
          </linearGradient>
        </defs>
        <path
          d="M50 3a47 47 0 1 1 0 94 47 47 0 0 1 0-94ZM42 42v16h16V42Z"
          fill={`url(#${id}-${suffix}-brass)`}
          fillRule="evenodd"
          stroke="#745025"
          strokeWidth="1.4"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={`url(#${id}-${suffix}-rim)`}
          strokeWidth="3"
        />
        <circle
          cx="50"
          cy="50"
          r="39.5"
          fill="none"
          stroke="#8a632c"
          strokeWidth="1"
          opacity=".7"
        />
        <circle
          cx="50"
          cy="50"
          r="38.3"
          fill="none"
          stroke="#f7db8a"
          strokeWidth=".65"
          opacity=".6"
        />
        <path
          d="M40 40h20v20H40Z"
          fill="none"
          stroke="#916830"
          strokeWidth="2.1"
        />
        <path
          d="M42 59h17V42"
          fill="none"
          stroke="#ffe8a980"
          strokeWidth="1.2"
        />
        <g
          className="cast-coin-patina"
          fill="none"
          stroke="#71582d"
          opacity=".14"
          strokeWidth=".8"
        >
          <path d="m21 27 6-2m46 4 5 2M18 65l4 4m47 11 8-3M35 17l5-1m-8 66 7 1" />
          <path d="m12 46 2-5m71 12 1 7M47 87h6" />
        </g>
        {front && (
          <g
            className="cast-coin-inscription"
            textAnchor="middle"
            fill="#69471f"
            stroke="#8c6426"
            strokeWidth=".25"
          >
            <text x="50" y="31">
              乾
            </text>
            <text x="50" y="81">
              隆
            </text>
            <text x="75" y="57">
              通
            </text>
            <text x="25" y="57">
              宝
            </text>
          </g>
        )}
        <path
          d="M15 30a43 43 0 0 1 45-21"
          fill="none"
          stroke="#fff4c4"
          strokeWidth="1.25"
          opacity=".5"
        />
      </svg>
    );
  }

  return (
    <span
      className={`cast-coin cast-coin-${index}${rolling ? " is-tossing" : ""}`}
      style={style}
      data-testid={`coin-face-${index}`}
      data-value={rolling ? undefined : settledValue}
      data-side={
        rolling
          ? "tossing"
          : settledValue === undefined
            ? "preview"
            : settledValue === 3
              ? "yang"
              : "yin"
      }
      aria-hidden="true"
    >
      <span className="coin-ground-shadow" />
      <span className="coin-impact-ring" />
      <span className="coin-flight">
        <span className="coin-spinner">
          <span className="coin-bronze-edge" />
          <span className="coin-obverse" data-coin-face="yang">
            {faceArtwork(true)}
          </span>
          <span className="coin-reverse" data-coin-face="yin">
            {faceArtwork(false)}
          </span>
        </span>
      </span>
    </span>
  );
}
