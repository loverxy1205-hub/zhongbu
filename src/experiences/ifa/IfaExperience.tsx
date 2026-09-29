import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PublicInput } from "../../types";
import { advanceIfa } from "./model";
import type { IfaState, IfaFace } from "./model";
import {
  baseFigures,
  baseForCode,
  IFA_SOURCES,
  ORIENTATION_COPY,
} from "./signatureCatalog";
import { MISSING_IFA_TEXT } from "./interpretationCorpus";
import "./ifa.css";

const PHASE_COPY: Record<
  IfaState["phase"],
  { title: string; hint: string; button: string }
> = {
  intro: {
    title: "八片相连，先认识这条占链",
    hint: "Ifá 属于 Yorùbá 文化。本篇体验 òpèlè 如何形成符号；完整咨询还包括受训解释者、口传诗节与具体情境。",
    button: "认识占链，继续",
  },
  focus: {
    title: "把问题留在心中",
    hint: "不必补充姓名、身份或出生信息。此次只观察符号如何形成，不从图式直接替你决定。",
    button: "提起占链",
  },
  lifted: {
    title: "从中间提起，让两侧垂落",
    hint: "准备好后释放占链。八片朝向已固定，落地动画只让它们显现。",
    button: "释放占链",
  },
  settled: {
    title: "八片已落定，读出两列符号",
    hint: "先看右列，再看左列；每列由上向下。凹面记单划，凸面记双划。",
    button: "显示两列符号",
  },
  complete: {
    title: "一条占链，两列图式",
    hint: "图式可以完整生成，传统文本却不能凭空填满。下面分别展示本次符号、资料状态与本站中性反思。",
    button: "",
  },
};

function Piece({
  face,
  revealed,
  index,
  gradientId,
}: {
  face: IfaFace;
  revealed: boolean;
  index: number;
  gradientId: string;
}) {
  return (
    <g
      className={`if-piece if-piece-${index}`}
      data-testid={`ifa-piece-${index}`}
      data-face={revealed ? (face ? "concave" : "convex") : "hidden"}
      style={{ "--if-order": index % 4 } as CSSProperties}
    >
      <ellipse className="if-piece-shadow" cy="20" rx="25" ry="11" />
      <g className="if-piece-body">
        <path
          d="M0-28C-25-18-31 3-20 21C-11 35 12 35 21 20C30 4 23-18 0-28Z"
          fill={`url(#${gradientId}-shell)`}
          stroke="#674023"
          strokeWidth="2"
        />
        {revealed && face === 1 ? (
          <>
            <path
              className="if-concave"
              d="M0-20C-16-10-22 5-14 18C-7 27 9 26 15 17C21 5 15-10 0-20Z"
              fill={`url(#${gradientId}-hollow)`}
            />
            <path
              d="M-13 9Q0 23 14 9"
              fill="none"
              stroke="#d4a369"
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <path
              d="M0-21Q-8-1 0 26M-10-16Q-19 3-10 19M10-16Q19 3 10 19"
              fill="none"
              stroke={revealed ? "#8b542c" : "#a77a49"}
              strokeWidth="2"
            />
            <path
              d="M1-19Q9 0 2 19"
              stroke="#f4d39a"
              strokeWidth="4"
              fill="none"
              opacity=".6"
            />
          </>
        )}
        <circle cy="-22" r="2" fill="#49311e" />
        <circle cy="27" r="2" fill="#49311e" />
      </g>
    </g>
  );
}

function Chain({ state, dropping }: { state: IfaState; dropping: boolean }) {
  const gradientId = useId().replaceAll(":", "");
  const revealed = state.phase === "settled" || state.phase === "complete";
  return (
    <div
      className={`if-tableau${state.phase === "lifted" ? " if-lifted" : ""}${dropping ? " if-dropping" : ""}`}
    >
      <svg
        viewBox="0 0 520 440"
        role="img"
        aria-label={
          revealed
            ? "八片占链已落定，右列先读；各片朝向见下方文字记录"
            : "八枚果壳形链片由可见链环连成一条，两侧各四枚"
        }
      >
        <defs>
          <linearGradient
            id={`${gradientId}-shell`}
            x1="0"
            x2="1"
            y1="0"
            y2="1"
          >
            <stop stopColor="#f5ddb0" />
            <stop offset=".45" stopColor="#c99455" />
            <stop offset="1" stopColor="#8c5b32" />
          </linearGradient>
          <radialGradient id={`${gradientId}-hollow`}>
            <stop stopColor="#38261b" />
            <stop offset=".78" stopColor="#795332" />
            <stop offset="1" stopColor="#d6a773" />
          </radialGradient>
          <pattern
            id={`${gradientId}-weave`}
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 4h16M4 0v16"
              stroke="#b69158"
              strokeWidth="1"
              opacity=".12"
            />
          </pattern>
        </defs>
        <rect
          x="20"
          y="24"
          width="480"
          height="387"
          rx="46"
          fill={`url(#${gradientId}-weave)`}
        />
        <ellipse
          cx="260"
          cy="240"
          rx="190"
          ry="170"
          fill="none"
          stroke="#c7ab7f"
          strokeDasharray="2 9"
          opacity=".5"
        />
        <text x="38" y="60" className="if-svg-side">
          左侧 · 第二列
        </text>
        <text x="374" y="60" className="if-svg-side">
          右侧 · 第一列
        </text>
        <g className="if-connected-chain">
          <path
            className="if-chain-shadow"
            d="M160 380V100Q160 26 260 26T360 100V380"
          />
          <path
            className="if-chain-link"
            d="M160 380V100Q160 26 260 26T360 100V380"
          />
          <path
            className="if-chain-highlight"
            d="M160 380V100Q160 26 260 26T360 100V380"
          />
          {state.faces.map((face, index) => (
            <g
              key={index}
              transform={`translate(${index < 4 ? 360 : 160} ${112 + (index % 4) * 73})`}
            >
              <Piece
                face={face}
                index={index}
                revealed={revealed}
                gradientId={gradientId}
              />
            </g>
          ))}
          <g
            className="if-end-marker"
            fill="#315c51"
            stroke="#e7c98a"
            strokeWidth="2"
          >
            <circle cx="360" cy="384" r="7" />
            <circle cx="153" cy="384" r="7" />
            <circle cx="168" cy="384" r="7" />
          </g>
        </g>
        <path
          d="M242 417h36m-18 8v-16m-5 5 5-5 5 5"
          stroke="#805f34"
          fill="none"
        />
        <text x="260" y="438" textAnchor="middle" className="if-svg-side">
          操作者的位置 · 不做镜像
        </text>
      </svg>
      <span className="if-sampling-note">
        虚拟抛链 · 八个独立公平二值的数字约定
      </span>
    </div>
  );
}

function Marks({ code }: { code: string }) {
  return (
    <span
      className="if-marks"
      role="img"
      aria-label={code
        .split("")
        .map((bit) => (bit === "1" ? "单划" : "双划"))
        .join("、")}
    >
      {code.split("").map((bit, index) => (
        <span className="if-mark-row" key={index} aria-hidden="true">
          <i />
          {bit === "0" && <i />}
        </span>
      ))}
    </span>
  );
}

export function IfaExperience({
  state,
  onChange,
  input,
  motionPaused,
}: {
  state: IfaState;
  onChange: (next: IfaState) => void;
  input: PublicInput;
  motionPaused: boolean;
}) {
  const [dropping, setDropping] = useState(false);
  const active = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef({ state, onChange });
  useEffect(() => {
    current.current = { state, onChange };
  }, [state, onChange]);
  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setDropping(false);
    const latest = current.current;
    if (latest.state.phase === "lifted")
      latest.onChange(advanceIfa(latest.state, "lifted"));
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
      active.current = false;
      window.clearTimeout(timer.current);
      if (typeof media.removeEventListener === "function")
        media.removeEventListener("change", change);
      else media.removeListener(change);
    };
  }, [finish]);
  useEffect(() => {
    if (motionPaused) finish();
  }, [motionPaused, finish]);

  function act() {
    if (active.current || state.phase === "complete") return;
    if (state.phase !== "lifted") {
      onChange(advanceIfa(state, state.phase));
      return;
    }
    active.current = true;
    if (
      motionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }
    setDropping(true);
    timer.current = window.setTimeout(finish, 1650);
  }

  const copy = PHASE_COPY[state.phase];
  const showFaces = state.phase === "settled" || state.phase === "complete";
  const phases = ["intro", "focus", "lifted", "settled", "complete"];
  return (
    <section
      className={`if-experience${motionPaused ? " if-motion-paused" : ""}`}
      data-testid="ifa-experience"
      data-phase={state.phase}
      onKeyDown={(event) => {
        if (event.key === "Escape" && dropping) {
          event.preventDefault();
          finish();
        }
      }}
    >
      <div className="if-heading">
        <span className="if-eyebrow">IFÁ · ÒPÈLÈ</span>
        <h4>{copy.title}</h4>
        <p>{copy.hint}</p>
      </div>
      <ol className="if-progress" aria-label="占链体验进度">
        {["认识", "聚焦", "抛链", "落定", "图式"].map((label, index) => (
          <li
            key={label}
            aria-current={phases[index] === state.phase ? "step" : undefined}
            className={
              index <= phases.indexOf(state.phase) ? "if-step-done" : ""
            }
          >
            {label}
          </li>
        ))}
      </ol>
      {(state.phase === "focus" || state.phase === "lifted") && (
        <blockquote className="if-question">
          {input.question || "安静片刻，关注此刻的问题。"}
        </blockquote>
      )}
      <Chain state={state} dropping={dropping} />
      {state.phase !== "complete" && (
        <div className="if-controls">
          <button
            type="button"
            onClick={act}
            disabled={dropping}
            aria-busy={dropping}
            className="if-primary"
            data-testid="ifa-next"
          >
            {dropping ? "占链正在落下…" : copy.button}
          </button>
          {dropping && (
            <button type="button" onClick={finish} className="if-skip">
              跳过抛链动画
            </button>
          )}
        </div>
      )}
      <p className="if-live" role="status">
        {dropping
          ? "释放、翻转、落地；等待八枚链片定格。可按 Escape 跳过。"
          : showFaces
            ? "八片朝向已记录，同一记录不会重新抛链。"
            : "用按钮继续，也支持 Tab、Enter 与空格操作。"}
      </p>
      {showFaces && (
        <div className="if-face-record" data-testid="ifa-face-record">
          {[1, 0].map((side) => (
            <div key={side}>
              <strong>{side === 0 ? "右列 · 先读" : "左列 · 后读"}</strong>
              <ol>
                {state.faces.slice(side * 4, side * 4 + 4).map((face, row) => (
                  <li key={row}>
                    第{row + 1}行：{face ? "凹面朝上 · I" : "凸面朝上 · II"}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      {state.phase === "complete" && (
        <div className="if-result" data-testid="ifa-result">
          <div className="if-symbol-grid">
            {[
              ["左列 · 第二列", state.leftCode],
              ["右列 · 第一列", state.rightCode],
            ].map(([label, code]) => (
              <div className="if-symbol-column" key={label}>
                <span>{label}</span>
                <Marks code={code} />
                <strong>{baseForCode(code).name}</strong>
                <small>{code} · 上至下</small>
              </div>
            ))}
          </div>
          <p className="if-signature" data-testid="ifa-signature">
            {state.signatureId}
            <span>
              {state.rightCode === state.leftCode
                ? "同列重复 · 16种之一"
                : "不同列组合 · 240种之一"}
            </span>
          </p>
          <div className="if-corpus">
            <span className="if-eyebrow">传统文本覆盖</span>
            <h5>{MISSING_IFA_TEXT}</h5>
            <p>
              此处只确认图式与基础列名。未核对复合名称时保留签名
              ID，不把两列主题相加，不推断吉凶。
            </p>
          </div>
        </div>
      )}
      <details className="if-details">
        <summary>认识凹凸面与读取方向</summary>
        {ORIENTATION_COPY.map((text) => (
          <p key={text}>{text}</p>
        ))}
        <p>
          公平抽样只是数字体验的约定，并非实物概率测量。页面固定操作者视角，旋转动画不会交换链片位置。
        </p>
      </details>
      {state.phase === "complete" && (
        <details className="if-details">
          <summary>16种基础图式与资料</summary>
          <p>
            每列上至下：I 为单划，II
            为双划。这里的排列不是吉凶或高低排序；基础列名采用核实过的拉丁字母写法，未补造声调或复合别名。
          </p>
          <div className="if-catalog">
            {baseFigures.map((figure) => (
              <div key={figure.id}>
                <strong>{figure.name}</strong>
                <Marks code={figure.code} />
                <small>{figure.code}</small>
              </div>
            ))}
          </div>
          <ul>
            {Object.values(IFA_SOURCES).map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <small>{source.locator}</small>
              </li>
            ))}
          </ul>
          <p>
            16×16
            共256种有序签名，包含16种同列重复与240种不同列组合。256图式齐全不表示传统文本齐全。本版没有收录未经许可的诗节或音频，不接入模型补写。
          </p>
        </details>
      )}
    </section>
  );
}
