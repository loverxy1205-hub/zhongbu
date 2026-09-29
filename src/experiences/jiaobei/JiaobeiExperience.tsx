import { useEffect, useRef, useState } from "react";
import type { PublicInput } from "../../types";
import {
  JIAOBEI_SOURCE,
  advanceJiaobei,
  classifyJiaobei,
  type JiaobeiState,
} from "./model";
import "./jiaobei.css";
function Block({
  side,
  index,
  playing,
}: {
  side: "flat" | "convex";
  index: number;
  playing: boolean;
}) {
  return (
    <div
      className={`jb-block jb-block-${index} ${playing ? "jb-flying" : ""}`}
      data-testid={`jiaobei-face-${index}`}
      data-side={side}
      role="img"
      aria-label={`第${index + 1}枚，${side === "flat" ? "平面" : "凸面"}朝上`}
    >
      <svg viewBox="0 0 180 270" aria-hidden="true">
        <defs>
          <linearGradient id={`jb-red-${index}`}>
            <stop stopColor="#e17050" />
            <stop
              offset=".5"
              stopColor={side === "flat" ? "#bf412d" : "#f29367"}
            />
            <stop offset="1" stopColor="#7d241e" />
          </linearGradient>
        </defs>
        <path
          d="M129 20C-8 47-12 215 129 250C68 183 66 87 129 20Z"
          fill={`url(#jb-red-${index})`}
          stroke="#66291f"
          strokeWidth="4"
        />
        <path
          d={
            side === "flat"
              ? "M111 45C11 85 18 193 111 227"
              : "M75 45C12 99 24 181 82 228"
          }
          fill="none"
          stroke={side === "flat" ? "#eda188" : "#ffd4a0"}
          strokeWidth={side === "flat" ? "2" : "9"}
          opacity=".7"
        />
        {side === "convex" && (
          <path
            d="M53 69C26 123 32 177 60 205"
            fill="none"
            stroke="#fff1bf"
            strokeWidth="3"
            opacity=".6"
          />
        )}
      </svg>
      <span>{side === "flat" ? "平面朝上" : "凸面朝上"}</span>
    </div>
  );
}
export function JiaobeiExperience({
  state: s,
  onChange,
  input,
  motionPaused,
}: {
  state: JiaobeiState;
  onChange: (next: JiaobeiState) => void;
  input: PublicInput;
  motionPaused: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const lock = useRef(false),
    latest = useRef({ s, onChange });
  useEffect(() => {
    latest.current = { s, onChange };
  }, [s, onChange]);
  const finish = () => {
    if (!lock.current) return;
    lock.current = false;
    setPlaying(false);
    const p = latest.current;
    p.onChange(advanceJiaobei(p.s));
  };
  useEffect(() => {
    if (!playing) return;
    if (motionPaused) {
      const id = setTimeout(finish, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(finish, 2000);
    return () => clearTimeout(id);
  }, [playing, motionPaused]);
  const total = s.mode === "single" ? 1 : 3;
  const visibleIndex = playing ? s.revealed : Math.max(0, s.revealed - 1);
  const visible = s.draws[visibleIndex];
  return (
    <div className="jb-experience" data-testid="jiaobei-experience">
      <p className="jb-kicker">一件事 · 两枚月牙</p>
      <h4>合杯问事，听见此刻</h4>
      {s.phase === "configure" ? (
        <div className="jb-config">
          <p>
            确认一个要判断的命题，保留自己的原意与否定词。也可以只看文化演示。
          </p>
          <label>
            这次确认的命题
            <input
              data-testid="jiaobei-proposition"
              maxLength={300}
              value={s.proposition}
              placeholder="例如：我正在考虑明天不去参加这次活动"
              onChange={(e) => onChange({ ...s, proposition: e.target.value })}
            />
          </label>
          {!!input.options?.length && (
            <div className="jb-options">
              {input.options.map((o, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => onChange({ ...s, proposition: o })}
                >
                  使用选项 {i + 1}：{o}
                </button>
              ))}
            </div>
          )}
          <fieldset>
            <legend>开始前选择模式</legend>
            {(["single", "triple"] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="jb-mode"
                  checked={s.mode === mode}
                  onChange={() => onChange({ ...s, mode })}
                />
                {mode === "single" ? "单次问事" : "三次全圣确认 · 本站模式"}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="primary-button"
            disabled={!s.proposition.trim()}
            onClick={() => onChange({ ...s, phase: "ready", demo: false })}
          >
            确认命题
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...s, phase: "ready", demo: true })}
          >
            仅看文化演示
          </button>
        </div>
      ) : (
        <>
          <p className="jb-proposition">
            {s.demo
              ? "文化演示 · 不参与问题方向汇总"
              : `本次命题：${s.proposition}`}
          </p>
          <div className={`jb-stage ${playing ? "is-playing" : ""}`}>
            <div className="jb-ground" />
            {s.revealed > 0 || playing ? (
              visible.map((side, i) => (
                <Block key={i} side={side} index={i} playing={playing} />
              ))
            ) : (
              <div className="jb-closed" aria-hidden="true">
                <Block side="convex" index={0} playing={false} />
                <Block side="flat" index={1} playing={false} />
              </div>
            )}
          </div>
          <p role="status">
            {playing
              ? "双杯合拢、上抛、落地……"
              : s.revealed
                ? `已完成 ${s.revealed} / ${total} 次：${classifyJiaobei(s.draws[s.revealed - 1])}`
                : "命题已定，双杯合拢"}
          </p>
          {s.phase === "ready" && !playing && (
            <button
              type="button"
              className="primary-button"
              data-testid="jiaobei-throw"
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                if (motionPaused) finish();
                else setPlaying(true);
              }}
            >
              合杯 · 抛出第 {s.revealed + 1} 次
            </button>
          )}
          {playing && (
            <button type="button" onClick={finish}>
              跳过掷筊动画
            </button>
          )}
          {!!s.revealed && (
            <ol className="jb-records">
              {s.draws.slice(0, s.revealed).map((d, i) => (
                <li key={i}>
                  第 {i + 1} 次 ·{" "}
                  {d.map((f) => (f === "flat" ? "平" : "凸")).join(" / ")} ·{" "}
                  <b>{classifyJiaobei(d)}</b>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <details className="jb-method">
        <summary>器具、面向与本站约定</summary>
        <p>
          按朝上的面判别：一平一凸为圣筊；两平为笑筊；两凸为阴筊。笑筊不是反对。图中红色月牙为本站原创示意。
        </p>
        <p>
          数字模拟采用两枚独立公平二值，不代表真实木筊的概率。三次模式固定做完三次，仅三次均圣达成所选条件，不自动重掷。
        </p>
        <a href={JIAOBEI_SOURCE} target="_blank" rel="noreferrer">
          核对来源：桃园在地化课程 · 长祥宫筊杯
        </a>
      </details>
    </div>
  );
}
