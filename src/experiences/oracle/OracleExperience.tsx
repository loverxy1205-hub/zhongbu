import { useEffect, useRef, useState } from "react";
import type { PublicInput } from "../../types";
import {
  ORACLE_SOURCES,
  ORACLE_CASES,
  HEAT_SITES,
  type OracleState,
} from "./model";
import "./oracle.css";
export function OracleExperience({
  state: s,
  onChange,
  input,
  motionPaused,
}: {
  state: OracleState;
  onChange: (next: OracleState) => void;
  input: PublicInput;
  motionPaused: boolean;
}) {
  const [heating, setHeating] = useState(false),
    [later, setLater] = useState("");
  const lock = useRef(false),
    latest = useRef({ s, onChange });
  useEffect(() => {
    latest.current = { s, onChange };
  }, [s, onChange]);
  const finish = () => {
    if (!lock.current) return;
    lock.current = false;
    setHeating(false);
    const p = latest.current;
    if (p.s.stage === 3) p.onChange({ ...p.s, stage: 4 });
  };
  useEffect(() => {
    if (!heating) return;
    const id = setTimeout(finish, motionPaused ? 0 : 2000);
    return () => clearTimeout(id);
  }, [heating, motionPaused]);
  const labels = [
    "整治甲片",
    "钻凿痕迹",
    "记下所问",
    "选择灼点",
    "观察裂兆",
    "留下记录",
  ];
  return (
    <div
      className={`ob-experience ${heating ? "ob-heating" : ""}`}
      data-testid="oracle-experience"
    >
      <p className="ob-kicker">灼甲观兆 · 历史流程体验</p>
      <h4>让问题成为一份记录</h4>
      <ol className="ob-steps" aria-label="体验进度">
        {labels.map((label, i) => (
          <li key={label} aria-current={s.stage === i ? "step" : undefined}>
            {label}
          </li>
        ))}
      </ol>
      <div className="ob-layout">
        <div className="ob-shell-wrap">
          <svg
            className="ob-shell"
            viewBox="0 0 400 450"
            role="img"
            aria-label={`虚拟甲片；${s.stage >= 4 ? `第${s.site + 1}个灼点产生模拟裂纹` : "尚无裂纹"}`}
          >
            <defs>
              <radialGradient id="ob-bone">
                <stop stopColor="#f5deb2" />
                <stop offset=".7" stopColor="#c39256" />
                <stop offset="1" stopColor="#795136" />
              </radialGradient>
            </defs>
            <path
              d="M179 24L221 26Q255 54 298 58L319 114 300 155 343 211 318 269 326 309 280 360 278 401 228 425 189 414 156 428 119 393 90 397 82 350 55 307 69 259 56 205 87 166 76 110 112 61 154 53Z"
              fill="url(#ob-bone)"
              stroke="#785136"
              strokeWidth="3"
            />
            <g fill="none" stroke="#825d3b" opacity=".27">
              <path d="M202 33L195 126 211 211 199 310 209 416M92 123Q181 171 312 118M68 223Q195 247 326 217M91 332Q195 288 312 325" />
              <path d="M140 66Q112 205 144 395M267 70Q291 242 258 405" />
            </g>
            {s.stage >= 2 &&
              HEAT_SITES.map((p, i) => (
                <g key={i}>
                  <ellipse
                    cx={p.x}
                    cy={p.y}
                    rx="11"
                    ry="7"
                    fill="#70482e"
                    opacity={i === s.site && s.stage >= 3 ? ".8" : ".4"}
                  />
                  <ellipse
                    cx={p.x - 1}
                    cy={p.y - 2}
                    rx="8"
                    ry="4"
                    fill="#d7b27b"
                  />
                </g>
              ))}
            {(heating || s.stage >= 4) && (
              <g
                className="ob-cracks"
                fill="none"
                stroke="#583626"
                strokeWidth="2.1"
                strokeLinecap="round"
              >
                {s.cracks[s.site].map((path, i) => (
                  <path
                    key={i}
                    pathLength="1"
                    d={path
                      .map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`)
                      .join(" ")}
                  />
                ))}
              </g>
            )}
            {heating && (
              <circle
                className="ob-ember"
                cx={HEAT_SITES[s.site].x}
                cy={HEAT_SITES[s.site].y}
                r="12"
                fill="#ea793a"
              />
            )}
          </svg>
          <small>原创虚拟甲片 · 不是真实文物图像</small>
        </div>
        <div className="ob-controls">
          {s.stage === 0 && (
            <>
              <p>
                从一块虚拟甲片开始，了解问题如何被记下、解释，并在事后核对。
              </p>
              <button
                type="button"
                onClick={() => onChange({ ...s, stage: 1 })}
              >
                整治虚拟甲片
              </button>
            </>
          )}
          {s.stage === 1 && (
            <>
              <p>
                历史资料记载先整治甲骨，再制作成排的凹坑与槽。这里用示意图展示，不指导实际加工。
              </p>
              <button
                type="button"
                onClick={() => onChange({ ...s, stage: 2 })}
              >
                显现钻凿痕迹
              </button>
            </>
          )}
          {s.stage === 2 && (
            <>
              <p className="ob-modern-note">
                现代旁注：{input.question || "一次关于当下的观察"}
              </p>
              <p>本次所问使用原样现代文字，不自动翻译成甲骨文。</p>
              <button
                type="button"
                onClick={() => onChange({ ...s, stage: 3 })}
              >
                记下所问之事
              </button>
            </>
          )}
          {s.stage === 3 && (
            <>
              <fieldset disabled={heating}>
                <legend>选择一个模拟灼点</legend>
                <div className="ob-sites">
                  {HEAT_SITES.map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      aria-pressed={s.site === i}
                      onClick={() => onChange({ ...s, site: i })}
                    >
                      灼点 {i + 1}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p>裂纹将从选定位置出现，所用形状参数已经冻结，不判吉凶。</p>
              {heating ? (
                <button type="button" onClick={finish}>
                  跳过模拟加热
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="oracle-heat"
                  onClick={() => {
                    if (lock.current) return;
                    lock.current = true;
                    if (motionPaused) finish();
                    else setHeating(true);
                  }}
                >
                  模拟加热 · 观察裂纹
                </button>
              )}
            </>
          )}
          {s.stage === 4 && (
            <>
              <label>
                你的观察（可留空）
                <textarea
                  maxLength={1000}
                  value={s.observation}
                  onChange={(e) =>
                    onChange({ ...s, observation: e.target.value })
                  }
                  placeholder="形状让你想到什么？这只是你自己的记录。"
                />
              </label>
              <label>
                选择独立历史案例
                <select
                  value={s.caseId}
                  onChange={(e) =>
                    onChange({
                      ...s,
                      caseId: e.target.value as OracleState["caseId"],
                    })
                  }
                >
                  {ORACLE_CASES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                data-testid="oracle-complete"
                onClick={() => onChange({ ...s, stage: 5 })}
              >
                保存观察，翻看历史案例
              </button>
            </>
          )}
          {s.stage === 5 && (
            <>
              <p>
                裂纹与首次观察已定格。历史案例和你的观察分别展示，不把它当成这次问题的答案。
              </p>
              <label>
                实际后来如何？
                <textarea
                  value={later}
                  maxLength={1000}
                  onChange={(e) => setLater(e.target.value)}
                  placeholder="今后主动回来补充实际发生的事"
                />
              </label>
              <button
                type="button"
                disabled={!later.trim() || s.outcomes.length >= 20}
                onClick={() => {
                  onChange({
                    ...s,
                    outcomes: [
                      ...s.outcomes,
                      {
                        text: later.trim(),
                        recordedAt: new Date().toISOString(),
                      },
                    ],
                  });
                  setLater("");
                }}
              >
                追加事后记录
              </button>
              <small>
                最多 20 条；使用“保存本次”留在本机，之后可从历史回来。
              </small>
              {s.outcomes.map((o, i) => (
                <blockquote key={i}>
                  <small>{new Date(o.recordedAt).toLocaleString()}</small>
                  <p>{o.text}</p>
                </blockquote>
              ))}
            </>
          )}
          <p role="status">
            {heating
              ? "模拟灼点发热，裂纹正从此延伸……"
              : `当前：${labels[s.stage]}`}
          </p>
        </div>
      </div>
      <details className="ob-sources">
        <summary>资料与范围</summary>
        <p>
          采用 Smithsonian
          亚洲艺术博物馆的历史流程概述。模拟裂纹不是古法判读表；本体验不参与宜忌汇总，不生成分数、祭献或医疗指令。
        </p>
        <a href={ORACLE_SOURCES[0]} target="_blank" rel="noreferrer">
          历史操作与记录流程
        </a>{" "}
        ·{" "}
        <a href={ORACLE_SOURCES[1]} target="_blank" rel="noreferrer">
          馆藏 S2012.9.445 案例
        </a>
      </details>
    </div>
  );
}
