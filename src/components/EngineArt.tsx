import { useId } from "react";
import type { EngineId } from "../types";
import "../engine-themes.css";

const STARS = [
  [15, 27],
  [83, 22],
  [29, 66],
  [76, 74],
  [17, 86],
  [61, 14],
  [89, 53],
];

function Spark({ x, y, size = 3 }: { x: number; y: number; size?: number }) {
  return (
    <path d={`M${x - size} ${y}h${size * 2}M${x} ${y - size}v${size * 2}`} />
  );
}

export function Blossom({
  x,
  y,
  size = 1,
  rotate = 0,
}: {
  x: number;
  y: number;
  size?: number;
  rotate?: number;
}) {
  return (
    <g
      className="plum-blossom"
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size})`}
    >
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-5.2"
          rx="4.5"
          ry="5.5"
          transform={`rotate(${a})`}
        />
      ))}
      <circle className="plum-heart" r="2.5" />
      {[0, 72, 144, 216, 288].map((a) => (
        <path
          className="plum-stamen"
          key={a}
          d="M0 0V-5"
          transform={`rotate(${a})`}
        />
      ))}
    </g>
  );
}

export function Coin({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="coin-face">
        <circle r={r} fill="var(--coin-fill, #dfbd72)" />
        <circle r={r - 3} />
        <path d="M-4-4H4V4H-4Z" fill="var(--coin-hole, #fff4dc)" />
        <path d="M0-12v4M0 8v4M-12 0h4M8 0h4" />
      </g>
    </g>
  );
}

/** Decorative motion stays outside the card face, preserving its orientation. */
export function TarotOrbit() {
  return (
    <svg
      className="tarot-orbit"
      viewBox="0 0 96 128"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth=".7"
    >
      <ellipse cx="48" cy="64" rx="43" ry="56" opacity=".25" />
      <g className="tarot-orbit-stars">
        <circle cx="48" cy="14" r="2" fill="currentColor" />
        <Spark x={48} y={112} size={4} />
        <Spark x={13} y={45} size={2.5} />
      </g>
    </svg>
  );
}

export function EngineAccent({ engine }: { engine: EngineId }) {
  return (
    <svg
      className={`engine-accent engine-accent-${engine}`}
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {engine === "tarot" && (
        <>
          <circle cx="48" cy="48" r="36" strokeDasharray="1 5" />
          <circle cx="48" cy="48" r="29" />
          <path d="M48 12 69 77 14 37h68L27 77Z" opacity=".45" />
          <path
            d="M53 26a22 22 0 1 0 17 32A24 24 0 0 1 53 26Z"
            fill="currentColor"
            fillOpacity=".18"
          />
          <Spark x={62} y={35} size={7} />
          <Spark x={28} y={65} size={3} />
          <Spark x={80} y={15} size={4} />
        </>
      )}
      {engine === "iching" && (
        <>
          <circle cx="48" cy="46" r="36" strokeDasharray="47 7" />
          <path
            d="M7 73 24 46l16 24 12-20 26 25M21 80l25-39 20 30 8-10 16 21"
            opacity=".5"
          />
          <Coin x={38} y={38} r={19} />
          <Coin x={63} y={57} r={19} />
          <path d="M8 31h13c10 0 6-12 0-8M73 23h14c7 0 7 10 0 10H77" />
        </>
      )}
      {engine === "meihua" && (
        <>
          <circle cx="45" cy="45" r="33" opacity=".25" />
          <path
            d="M7 88c20-23 29-28 43-39L78 13M32 64 27 36M49 49l30 6M62 33 53 17"
            strokeWidth="3"
          />
          <path d="M27 44 13 35M70 24l16 2M62 52l5 17" />
          <Blossom x={28} y={34} size={1.05} rotate={15} />
          <Blossom x={53} y={18} size={0.9} />
          <Blossom x={75} y={52} size={1.15} rotate={30} />
          <Blossom x={80} y={15} size={0.85} />
          <Blossom x={45} y={53} size={0.7} rotate={10} />
          <path
            d="M18 65q-8 2-7 9 7 1 7-9M82 77q7-2 7-7-8-2-7 7"
            fill="currentColor"
            opacity=".5"
            stroke="none"
          />
        </>
      )}
      {engine === "numerology" && (
        <>
          <circle cx="48" cy="48" r="26" />
          <circle cx="48" cy="48" r="36" strokeDasharray="2 7" />
          <ellipse
            cx="48"
            cy="48"
            rx="44"
            ry="15"
            transform="rotate(-35 48 48)"
          />
          <path d="m48 17 27 47H21Z M48 79 21 32h54Z" opacity=".5" />
          <circle cx="81" cy="25" r="4" fill="currentColor" />
          <text
            x="48"
            y="59"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="32"
            fontFamily="Georgia, serif"
          >
            9
          </text>
        </>
      )}
      {engine === "runes" && (
        <>
          <path d="M12 77 30 43l13 19 16-36 25 51Z" opacity=".4" />
          <path
            d="M31 11 66 14 78 33 69 83 29 85 18 61 22 30Z"
            fill="currentColor"
            fillOpacity=".08"
          />
          <path d="M44 69V28l18 12-18 10 18 19" strokeWidth="3" />
          <path d="m24 29 10 6-6 12M62 77l-8-8M61 17l3 12" opacity=".55" />
          <Spark x={12} y={22} />
          <Spark x={83} y={40} />
          <Spark x={77} y={10} />
        </>
      )}
    </svg>
  );
}

// Original geometric illustrations: visual motifs are keyed to the frozen card id.
// Rendering never draws a card or changes a reading.
function MajorMotif({ n }: { n: number }) {
  switch (n) {
    case 0:
      return (
        <>
          <circle cx="62" cy="37" r="9" />
          <path d="m28 83 18-29 16 29M16 93l30-10 26 10M46 54V39m0 7 14-8M32 45l6-8 6 8-6 8Z" />
        </>
      );
    case 1:
      return (
        <>
          <path d="M27 50c-15-16 0-24 13-9s28 7 13-9c-13-12-28 22-13 25M48 68v33M28 96h40M68 40V20m-6 6 6-6 6 6" />
          <circle cx="48" cy="69" r="9" />
        </>
      );
    case 2:
      return (
        <>
          <path d="M22 39h11v59H22ZM63 39h11v59H63ZM48 27a17 17 0 1 0 14 24A18 18 0 0 1 48 27ZM39 75h18v25H39Z" />
        </>
      );
    case 3:
      return (
        <>
          <path d="m25 43 4 22h38l4-22-15 10-8-17-9 17ZM48 70v31M48 85c-20 0-24-14-24-14 20 0 24 14 24 14Zm0 10c20 0 24-14 24-14-20 0-24 14-24 14Z" />
          <circle cx="48" cy="28" r="4" />
        </>
      );
    case 4:
      return (
        <>
          <path d="m25 42 5 20h36l5-20-14 9-9-18-9 18ZM29 68h38v26H29ZM18 108l17-13 13 8 17-15 15 20" />
          <path d="M42 77h12M48 71v19" />
        </>
      );
    case 5:
      return (
        <>
          <circle cx="32" cy="44" r="11" />
          <circle cx="64" cy="44" r="11" />
          <path d="m37 53 30 45M59 53 30 98m28-12 7-5m-27 5-7-5M37 26h22M48 18v17" />
        </>
      );
    case 6:
      return (
        <>
          <path d="M48 53C21 20 8 53 48 80c40-27 27-60 0-27ZM21 95l14-13 13 13 13-13 14 13M48 22v9" />
          <circle cx="25" cy="29" r="4" />
          <circle cx="71" cy="29" r="4" />
        </>
      );
    case 7:
      return (
        <>
          <path d="m24 55 8 29h34l7-29ZM36 54V39l12-13 12 13v15M10 49l21 10M86 49 66 59M48 55v29" />
          <circle cx="33" cy="93" r="8" />
          <circle cx="66" cy="93" r="8" />
        </>
      );
    case 8:
      return (
        <>
          <path d="M48 43c-30-29-40 9-15 9 12 0 15-9 15-9s3-9 15-9c25 0 15 38-15 9ZM48 67l-19 13 5 23h28l5-23Z" />
          <circle cx="48" cy="89" r="9" />
          <path d="m29 80 9 2m29-2-9 2" />
        </>
      );
    case 9:
      return (
        <>
          <path d="M38 47h29v38H38ZM35 47l17-13 18 13M52 85v14M29 100h47M25 39v62M45 34a8 8 0 0 1 15 0" />
          <Spark x={52} y={64} size={10} />
        </>
      );
    case 10:
      return (
        <>
          <circle cx="48" cy="65" r="31" />
          <circle cx="48" cy="65" r="22" />
          <circle cx="48" cy="65" r="5" />
          {[0, 45, 90, 135].map((a) => (
            <path key={a} d="M48 34v62" transform={`rotate(${a} 48 65)`} />
          ))}
        </>
      );
    case 11:
      return (
        <>
          <path d="M48 30v70M31 101h34M21 49h54M27 49 16 76h22L27 49Zm42 0L58 76h22L69 49ZM16 76q11 17 22 0M58 76q11 17 22 0" />
          <circle cx="48" cy="30" r="5" />
        </>
      );
    case 12:
      return (
        <>
          <path d="M20 32h56M26 32v74M70 32v74M48 34v26l-13 16h26L48 60M48 76v9M36 100h24" />
          <circle cx="48" cy="93" r="8" />
        </>
      );
    case 13:
      return (
        <>
          <path d="M48 76v29M48 93c-19 0-22-14-22-14 17 0 22 14 22 14ZM48 99c19 0 22-14 22-14-17 0-22 14-22 14Z" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="48"
              cy="48"
              rx="9"
              ry="17"
              transform={`rotate(${a} 48 63)`}
            />
          ))}
          <circle cx="48" cy="63" r="6" />
        </>
      );
    case 14:
      return (
        <>
          <path d="M17 39h26l-4 20H21ZM30 59v13m-9 0h18M54 72h26l-4 20H58ZM67 92v13m-9 0h18M40 54c17 0 6 25 22 25M38 44c24 0 13 22 28 22" />
          <Spark x={63} y={34} size={9} />
        </>
      );
    case 15:
      return (
        <>
          <path d="M31 46 22 26 43 38M65 46l9-20-21 12M31 46l17 26 17-26-17-8ZM48 72v14M31 88c-22-16-26 12-9 12 15 0 14-24 26-14 12-10 11 14 26 14 17 0 13-28-9-12" />
        </>
      );
    case 16:
      return (
        <>
          <path d="M34 99V54h29v45M30 54l4-15 9 8 6-12 6 12 9-8 4 15M43 99V84h12v15M44 62h9v10M59 19 44 38h12L43 60M17 92l9-12m44 7 9 12" />
        </>
      );
    case 17:
      return (
        <>
          <path d="m48 24 6 23 22 6-22 6-6 23-6-23-22-6 22-6ZM21 91q27-13 54 0M15 102q33-13 66 0" />
          <Spark x={19} y={29} />
          <Spark x={78} y={73} />
        </>
      );
    case 18:
      return (
        <>
          <path d="M53 28a24 24 0 1 0 20 37A26 26 0 0 1 53 28ZM19 97l14-15 15 15 15-15 14 15M23 107h50" />
          <Spark x={68} y={34} size={5} />
        </>
      );
    case 19:
      return (
        <>
          <circle cx="48" cy="62" r="21" />
          {Array.from({ length: 12 }, (_, a) => (
            <path key={a} d="M48 28v9" transform={`rotate(${a * 30} 48 62)`} />
          ))}
          <path d="M40 63q8 8 16 0M40 55h1m14 0h1M22 108q26-16 52 0" />
        </>
      );
    case 20:
      return (
        <>
          <path d="M26 45h31l18-12v37L57 58H26ZM26 45q-18 6 0 13M50 58v18h15M20 105l12-18 16 18 16-18 12 18" />
          <Spark x={45} y={28} size={6} />
        </>
      );
    default:
      return (
        <>
          <ellipse cx="48" cy="65" rx="27" ry="40" />
          <ellipse cx="48" cy="65" rx="19" ry="33" />
          <path d="M48 41v44m-12-30 12 10 12-10M38 90l10-12 10 12M19 36l-5-7m63 7 5-7M19 94l-5 7m63-7 5 7" />
          <circle cx="48" cy="41" r="6" />
        </>
      );
  }
}

function SuitMotif({ suit }: { suit: number }) {
  if (suit === 0)
    return (
      <>
        <path d="M47 97V32M42 97h10M47 49c-18 0-20-15-20-15 17 0 20 15 20 15Zm0 21c18 0 20-15 20-15-17 0-20 15-20 15Z" />
        <path d="m42 31 5-9 5 9" />
      </>
    );
  if (suit === 1)
    return (
      <>
        <path d="M23 40h50l-6 26c-3 13-35 13-38 0ZM48 77v22M31 101h34M24 45H14c0 19 13 19 17 19M72 45h10c0 19-13 19-17 19M31 34q17-14 34 0" />
      </>
    );
  if (suit === 2)
    return (
      <>
        <path d="m48 21-9 20 9 44 9-44ZM29 80h38M48 85v19M41 104h14M19 46l9 9m49-9-9 9" />
      </>
    );
  return (
    <>
      <circle cx="48" cy="63" r="32" />
      <circle cx="48" cy="63" r="26" />
      <path d="m48 39 14 43-36-27h44L34 82Z" />
      <path d="M28 105h40" />
    </>
  );
}

const ROMAN = [
  "0",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
];
export function TarotArt({ cardId }: { cardId: string }) {
  const parts = cardId.split("-"),
    major = parts[1] === "major",
    n = Number(parts[2]);
  const id = useId(),
    suit = major ? -1 : Number(parts[1]);
  return (
    <svg
      className={`tarot-art tarot-art-suit-${suit}`}
      data-decoration-id={cardId}
      viewBox="0 0 96 128"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <radialGradient id={id}>
          <stop stopColor="currentColor" stopOpacity=".25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="66" r="42" fill={`url(#${id})`} stroke="none" />
      <path
        d="M12 112V46a36 36 0 0 1 72 0v66M17 114V46a31 31 0 0 1 62 0v68"
        opacity=".35"
      />
      <text
        x="48"
        y="14"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontFamily="Georgia, serif"
        fontSize="9"
      >
        {major
          ? ROMAN[n]
          : n < 10
            ? ROMAN[n + 1]
            : ["P", "Kn", "Q", "K"][n - 10]}
      </text>
      <g className="tarot-constellation" opacity=".55">
        {STARS.map(([x, y], a) => (
          <Spark key={a} x={x} y={y + (n % 3) * 3} size={a % 2 ? 1.8 : 2.5} />
        ))}
      </g>
      <g className="tarot-motif">
        {major ? <MajorMotif n={n} /> : <SuitMotif suit={suit} />}
      </g>
      {!major && (
        <g opacity=".6">
          {Array.from({ length: Math.min(n + 1, 14) }, (_, a) => (
            <circle
              key={a}
              cx={48 + Math.cos((a / (n + 1)) * Math.PI * 2) * 38}
              cy={65 + Math.sin((a / (n + 1)) * Math.PI * 2) * 48}
              r="1"
              fill="currentColor"
            />
          ))}
        </g>
      )}
      <path d="M25 117h46M42 113l6 4-6 4m12-8-6 4 6 4" opacity=".5" />
    </svg>
  );
}

export function EngineLandscape({ engine }: { engine: "iching" | "meihua" }) {
  return (
    <svg
      className={`engine-landscape landscape-${engine}`}
      viewBox="0 0 560 260"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {engine === "iching" ? (
        <>
          <circle
            cx="456"
            cy="55"
            r="30"
            className="landscape-sun"
            stroke="none"
          />
          <path
            d="M0 211 48 159 81 183 152 111 224 188 275 141 352 210 423 166 487 207 560 144v116H0Z"
            className="mountain-far"
            stroke="none"
          />
          <path
            d="M0 234 51 204 87 222 131 193 190 232 254 201 316 231 385 190 430 221 495 184 560 230v30H0Z"
            className="mountain-near"
            stroke="none"
          />
          <path
            d="M12 66h55c31 0 21-32 1-24M420 102h63c37 0 31-36 9-29-13 4-11 17 1 17M27 236q71-16 140 0m168 7q77-18 137-5"
            opacity=".24"
          />
          <g className="landscape-coins">
            <Coin x={242} y={30} r={17} />
            <Coin x={281} y={27} r={18} />
            <Coin x={320} y={35} r={16} />
          </g>
        </>
      ) : (
        <>
          <circle cx="446" cy="61" r="44" className="plum-moon" stroke="none" />
          <g className="plum-branch">
            <path
              d="M570 250c-41-30-44-63-79-89-48-35-63-51-81-99M526 206l-77 8-39-16M485 159l18-41-5-43M439 106l-51-6-45-36M413 70l12-48"
              strokeWidth="5"
            />
            <path
              d="m467 174-34-27-34-5m99-43 31-34m-169 29-15 17m55 41-21 15m33 41-6 30"
              strokeWidth="2.5"
            />
          </g>
          <Blossom x={412} y={65} size={1.7} rotate={10} />
          <Blossom x={445} y={107} size={1.35} rotate={25} />
          <Blossom x={497} y={83} size={1.55} rotate={15} />
          <Blossom x={388} y={101} size={1.4} />
          <Blossom x={404} y={145} size={1.5} rotate={50} />
          <Blossom x={447} y={209} size={1.6} rotate={20} />
          <Blossom x={478} y={164} size={1.25} />
          <Blossom x={348} y={64} size={1.2} rotate={45} />
          {[140, 205, 280, 355, 425].map((x, n) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <g className={`falling-blossom falling-blossom-${n}`}>
                <Blossom x={0} y={0} size={0.55 + (n % 3) * 0.12} />
              </g>
            </g>
          ))}
          <path d="M0 239q136-19 269 0t291 0" opacity=".15" />
        </>
      )}
    </svg>
  );
}

export function NumberOrbit({ number }: { number: number }) {
  return (
    <svg
      className="number-orbit"
      viewBox="0 0 180 180"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="90" cy="90" r="64" strokeDasharray="1 6" />
      <circle cx="90" cy="90" r="50" opacity=".5" />
      <ellipse cx="90" cy="90" rx="84" ry="32" transform="rotate(-36 90 90)" />
      <ellipse
        cx="90"
        cy="90"
        rx="84"
        ry="32"
        transform="rotate(36 90 90)"
        opacity=".4"
      />
      <polygon
        points={Array.from(
          { length: number + 2 },
          (_, a) =>
            `${90 + Math.cos((a * Math.PI * 2) / (number + 2) - Math.PI / 2) * 65},${90 + Math.sin((a * Math.PI * 2) / (number + 2) - Math.PI / 2) * 65}`,
        ).join(" ")}
        opacity=".25"
      />
      <circle cx="149" cy="42" r="4" fill="currentColor" />
      <circle cx="29" cy="133" r="2.5" fill="currentColor" />
    </svg>
  );
}
