import { useEffect, useId, useRef } from "react";
import type { PointerEvent } from "react";
import type { PublicInput } from "../../types";
import { COFFEE_SOURCES, COFFEE_SYMBOLS, coffeeSymbolName } from "./dictionary";
import {
  advanceCoffee,
  beginCoffeeAnnotation,
  coffeeRegion,
  completeCoffee,
  reobserveCoffee,
  saveCoffeeAnnotation,
  turnCoffee,
  type CoffeeBox,
  type CoffeeState,
} from "./state";
import type { CoffeePoint } from "./texture";
import "./coffee.css";

const STEPS = [
  "饮后留渣",
  "轻转杯子",
  "覆上杯碟",
  "翻杯",
  "沉降",
  "揭杯",
  "观察",
];
const STAGE_INDEX = {
  residue: 0,
  turn: 1,
  covered: 2,
  inverted: 3,
  settling: 4,
  settled: 5,
  observe: 6,
  complete: 6,
};
const LABELS = {
  residue: "一杯饮尽，留下纹理的起点",
  turn: "慢慢转动，找到你的节奏",
  covered: "杯碟覆好，渣纹参数已锁定",
  inverted: "将杯口朝下，静候沉降",
  settling: "咖啡渣正在沉降",
  settled: "杯已静置，可以揭开看看",
  observe: "先观察，再记录你的联想",
  complete: "这一杯，留下你的观察",
};
const cap = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(n)));

function projected(
  point: CoffeePoint,
  mode: "top" | "unfold",
  angle: number,
): [number, number] {
  if (mode === "unfold")
    return [40 + (point.u + (angle / 360) * 1000) * 0.52, 360 - point.v * 0.32];
  const a = (point.u / 1000) * Math.PI * 2 + (angle / 180) * Math.PI;
  return [
    300 + Math.cos(a) * point.v * 0.154,
    200 + Math.sin(a) * point.v * 0.154,
  ];
}
function outline(box: CoffeeBox): CoffeePoint[] {
  return [
    ...Array.from({ length: 9 }, (_, i) => ({
      u: box.u + (box.width * i) / 8,
      v: box.v,
    })),
    ...Array.from({ length: 9 }, (_, i) => ({
      u: box.u + (box.width * (8 - i)) / 8,
      v: box.v + box.height,
    })),
  ];
}
function CupView({
  state,
  reveal,
  onStart,
  onMove,
  onEnd,
}: {
  state: CoffeeState;
  reveal: boolean;
  onStart?: (e: PointerEvent<SVGSVGElement>) => void;
  onMove?: (e: PointerEvent<SVGSVGElement>) => void;
  onEnd?: (e: PointerEvent<SVGSVGElement>) => void;
}) {
  const clipId = useId();
  const mode = reveal ? state.view.mode : "top";
  const angle = reveal
    ? (mode === "top" ? state.swirl.angle : 0) + state.view.rotation
    : state.swirl.angle;
  const shifts = mode === "unfold" ? [-1000, 0, 1000] : [0];
  const pointsText = (points: CoffeePoint[], shift = 0) =>
    points
      .map((p) =>
        projected({ u: p.u + shift, v: p.v }, mode, angle)
          .map((v) => v.toFixed(2))
          .join(","),
      )
      .join(" ");
  const annotations =
    state.stage === "complete"
      ? (state.observations[state.activeVersion - 1]?.annotations ?? [])
      : state.working;
  return (
    <svg
      className={`cf-cup-view${state.draft ? " cf-drawing" : ""}${state.stage === "turn" ? " cf-turnable" : ""}`}
      viewBox={mode === "top" ? "0 -70 600 540" : "0 0 600 400"}
      role="img"
      aria-label={
        reveal
          ? `同一冻结杯纹的${mode === "top" ? "杯内俯视" : "展开观察图"}，杯柄方向有标记；标注请用下方按钮与坐标控件。`
          : "饮后留渣的咖啡杯，杯柄是方向标记。"
      }
      data-testid="coffee-pattern"
      data-texture-id={reveal ? state.texture?.id : undefined}
      onPointerDown={onStart}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    >
      <defs>
        <clipPath id={clipId}>
          {mode === "top" ? (
            <circle cx="300" cy="200" r="154" />
          ) : (
            <rect x="40" y="40" width="520" height="320" rx="3" />
          )}
        </clipPath>
      </defs>
      {mode === "top" ? (
        <>
          <ellipse
            cx="300"
            cy="215"
            rx="190"
            ry="177"
            fill="#553024"
            opacity=".07"
          />
          <g transform={`rotate(${angle} 300 200)`}>
            <path
              d="M467 155c89-19 89 109 0 90v-23c58 16 58-60 0-44Z"
              fill="#ead0a6"
              stroke="#806243"
              strokeWidth="2"
            />
            <text x="532" y="204" className="cf-handle-label">
              杯柄
            </text>
          </g>
          <circle
            cx="300"
            cy="200"
            r="171"
            fill="#f7e9d0"
            stroke="#9a7650"
            strokeWidth="2"
          />
          <circle
            cx="300"
            cy="200"
            r="162"
            fill="none"
            stroke="#b99466"
            strokeWidth="2"
          />
          <circle cx="300" cy="200" r="154" fill="#efdab8" />
        </>
      ) : (
        <>
          <rect
            x="34"
            y="34"
            width="532"
            height="332"
            rx="6"
            fill="#f8e8cb"
            stroke="#ae8354"
          />
          <text x="40" y="24" className="cf-axis-label">
            杯口
          </text>
          <text x="40" y="386" className="cf-axis-label">
            杯底
          </text>
          <text x="560" y="24" className="cf-axis-label" textAnchor="end">
            左、右边缘相接
          </text>
        </>
      )}
      <g clipPath={`url(#${clipId})`}>
        <g
          transform={`translate(300 200) scale(${reveal ? state.view.zoom : 1}) translate(-300 -200)`}
        >
          {reveal && state.texture ? (
            state.texture.patches.flatMap((patch, i) =>
              shifts.map((shift) => (
                <polygon
                  key={`${i}-${shift}`}
                  points={pointsText(patch.points, shift)}
                  fill={
                    ["#4d2a1b", "#70462a", "#956e42", "#382319"][patch.tone]
                  }
                  opacity={[0.86, 0.72, 0.58, 0.92][patch.tone]}
                />
              )),
            )
          ) : (
            <>
              <circle cx="300" cy="200" r="148" fill="#70452c" />
              <ellipse cx="289" cy="251" rx="112" ry="65" fill="#4b2a1c" />
              <path
                d="M193 179c9-71 148-95 211-34-87-39-143-14-211 34Z"
                fill="#a67648"
                opacity=".65"
              />
              <path
                d="M198 293c77 20 132 30 188-24-43 78-135 51-188 24Z"
                fill="#2e1c13"
                opacity=".6"
              />
            </>
          )}
          {reveal &&
            annotations.flatMap((a) =>
              shifts.map((shift) => (
                <polygon
                  className="cf-saved-outline"
                  key={`${a.id}-${shift}`}
                  points={pointsText(outline(a.box), shift)}
                />
              )),
            )}
          {reveal && state.draft && (
            <polygon
              className="cf-draft-outline"
              points={pointsText(outline(state.draft.box))}
            />
          )}
        </g>
      </g>
      {reveal && mode === "unfold" && (
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          <g
            className="cf-handle-seam"
            transform={`translate(300 200) scale(${state.view.zoom}) translate(-300 -200)`}
          >
            <line
              x1={40 + ((state.view.rotation / 360 + 1) % 1) * 520}
              x2={40 + ((state.view.rotation / 360 + 1) % 1) * 520}
              y1="40"
              y2="360"
            />
            <text x={47 + ((state.view.rotation / 360 + 1) % 1) * 520} y="57">
              杯柄起点
            </text>
          </g>
        </g>
      )}
      {reveal && mode === "top" && (
        <>
          <circle cx="300" cy="200" r="49" className="cf-region-guide" />
          <circle cx="300" cy="200" r="126" className="cf-region-guide" />
        </>
      )}
    </svg>
  );
}

function CoveredCup({ stage }: { stage: CoffeeState["stage"] }) {
  return (
    <svg
      viewBox="0 0 600 400"
      className={`cf-covered-cup cf-cup-${stage}`}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="300"
        cy="334"
        rx="152"
        ry="18"
        fill="#634428"
        opacity=".12"
      />
      <ellipse
        cx="300"
        cy="309"
        rx="175"
        ry="23"
        fill="#e9ce9e"
        stroke="#8e673f"
        strokeWidth="2"
      />
      <g className="cf-ceramic-cup">
        <path
          d="M395 178c111-52 130 100 23 93l-8-24c69 4 63-71-11-43Z"
          fill="#ecdbc0"
          stroke="#866a4e"
          strokeWidth="3"
        />
        <path
          d="M179 151h242l-22 134q-99 43-198 0Z"
          fill="#f9edda"
          stroke="#866a4e"
          strokeWidth="3"
        />
        <path
          d="M211 185q92 31 178 0m-170 32q80 29 162 0"
          fill="none"
          stroke="#7f9d98"
          strokeWidth="10"
        />
        <path d="M245 250h110" stroke="#b9955d" strokeWidth="3" />
        <ellipse
          cx="300"
          cy="151"
          rx="122"
          ry="20"
          fill="#efdbb9"
          stroke="#866a4e"
          strokeWidth="3"
        />
      </g>
      {stage === "covered" && (
        <ellipse
          cx="300"
          cy="144"
          rx="153"
          ry="25"
          fill="#d4b77f"
          stroke="#866a4e"
          strokeWidth="3"
        />
      )}
      {stage === "settling" && (
        <g className="cf-settling-dots" fill="#795032">
          <circle cx="265" cy="301" r="3" />
          <circle cx="302" cy="306" r="4" />
          <circle cx="337" cy="302" r="2.5" />
        </g>
      )}
    </svg>
  );
}

export function CoffeeExperience({
  state,
  onChange,
  input,
  motionPaused,
}: {
  state: CoffeeState;
  onChange: (next: CoffeeState) => void;
  input: PublicInput;
  motionPaused: boolean;
}) {
  const latest = useRef({ state, onChange });
  const gesture = useRef<{
    angle?: number;
    start?: { u: number; v: number };
    pointerId: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasDraft = Boolean(state.draft);
  useEffect(() => {
    latest.current = { state, onChange };
  }, [state, onChange]);
  function emit(next: CoffeeState) {
    if (next === latest.current.state) return;
    latest.current.state = next;
    latest.current.onChange(next);
  }
  function finishSettling() {
    const s = latest.current.state;
    if (s.stage === "settling") emit(advanceCoffee(s));
  }
  useEffect(() => {
    if (state.stage !== "settling") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      const s = latest.current.state;
      if (s.stage === "settling") {
        const next = advanceCoffee(s);
        latest.current.state = next;
        latest.current.onChange(next);
      }
    };
    if (motionPaused || media.matches) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, 1300);
    const changed = () => {
      if (media.matches) finish();
    };
    media.addEventListener("change", changed);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", changed);
    };
  }, [state.stage, motionPaused]);
  useEffect(() => {
    if (hasDraft)
      panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [hasDraft]);

  const revealed = state.stage === "observe" || state.stage === "complete";
  const currentObservation = state.observations[state.activeVersion - 1];
  const displayed =
    state.stage === "complete"
      ? (currentObservation?.annotations ?? [])
      : state.working;
  function point(e: PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget,
      p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? p.matrixTransform(matrix.inverse()) : { x: 300, y: 200 };
  }
  function beginGesture(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || (state.stage !== "turn" && !state.draft)) return;
    const p = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current =
      state.stage === "turn"
        ? {
            pointerId: e.pointerId,
            angle: (Math.atan2(p.y - 200, p.x - 300) * 180) / Math.PI,
          }
        : {
            pointerId: e.pointerId,
            start: {
              u: cap((p.x - 40) / 0.52, 0, 950),
              v: cap((360 - p.y) / 0.32, 0, 950),
            },
          };
  }
  function moveGesture(e: PointerEvent<SVGSVGElement>) {
    const g = gesture.current,
      s = latest.current.state;
    if (!g || g.pointerId !== e.pointerId) return;
    const p = point(e);
    if (s.stage === "turn" && g.angle !== undefined) {
      const angle = (Math.atan2(p.y - 200, p.x - 300) * 180) / Math.PI;
      let delta = angle - g.angle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      if (Math.abs(delta) >= 1) {
        emit(turnCoffee(s, delta));
        g.angle = angle;
      }
    } else if (s.draft && g.start) {
      const end = {
        u: cap((p.x - 40) / 0.52, 0, 1000),
        v: cap((360 - p.y) / 0.32, 0, 1000),
      };
      const u = Math.min(g.start.u, end.u),
        v = Math.min(g.start.v, end.v);
      emit({
        ...s,
        draft: {
          ...s.draft,
          box: {
            u,
            v,
            width: cap(Math.abs(end.u - g.start.u), 50, 1000 - u),
            height: cap(Math.abs(end.v - g.start.v), 50, 1000 - v),
          },
        },
      });
    }
  }
  function endGesture(e: PointerEvent<SVGSVGElement>) {
    if (gesture.current?.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function adjustBox(key: keyof CoffeeBox, value: number) {
    const s = latest.current.state;
    if (!s.draft) return;
    const b = { ...s.draft.box, [key]: value };
    b.u = cap(b.u, 0, 1000 - b.width);
    b.v = cap(b.v, 0, 1000 - b.height);
    b.width = cap(b.width, 50, 1000 - b.u);
    b.height = cap(b.height, 50, 1000 - b.v);
    emit({ ...s, draft: { ...s.draft, box: b } });
  }
  return (
    <section
      className={`cf-experience${motionPaused ? " cf-paused" : ""}`}
      data-testid="coffee-experience"
      aria-label="咖啡渣占·翻杯观纹"
    >
      <header className="cf-heading">
        <span>THE CUP / YOUR OBSERVATION</span>
        <h4>{LABELS[state.stage]}</h4>
        <p>
          {revealed
            ? "浓淡、流痕与留白都可以慢慢看。不必一定找到一个形状。"
            : "土耳其咖啡饮后观渣的虚拟体验，图样由程序纹理与已记录的轻转参数形成。"}
        </p>
      </header>
      <ol className="cf-steps" aria-label="翻杯流程">
        {STEPS.map((name, i) => (
          <li
            key={name}
            aria-current={i === STAGE_INDEX[state.stage] ? "step" : undefined}
            className={i < STAGE_INDEX[state.stage] ? "cf-step-done" : ""}
          >
            {name}
          </li>
        ))}
      </ol>
      <div className={`cf-stage cf-stage-${state.stage}`}>
        {["residue", "turn", "observe", "complete"].includes(state.stage) ? (
          <CupView
            state={state}
            reveal={revealed}
            onStart={beginGesture}
            onMove={moveGesture}
            onEnd={endGesture}
          />
        ) : (
          <CoveredCup stage={state.stage} />
        )}
        {state.stage === "turn" && (
          <div className="cf-turn-controls">
            <p>拖动杯子轻转；也可以使用下面的按钮。次数和方向由你选择。</p>
            <div className="cf-button-row">
              <button
                type="button"
                onClick={() => emit(turnCoffee(latest.current.state, -30))}
              >
                向左轻转 30°
              </button>
              <button
                type="button"
                onClick={() => emit(turnCoffee(latest.current.state, 30))}
              >
                向右轻转 30°
              </button>
            </div>
            <p className="cf-fine" role="status">
              净转动 {state.swirl.angle}° · 累计 {state.swirl.travel}°（上限
              2880°）
            </p>
          </div>
        )}
        {revealed && (
          <div className="cf-view-tools">
            <div className="cf-button-row">
              <button
                type="button"
                aria-pressed={state.view.mode === "top"}
                disabled={Boolean(state.draft)}
                onClick={() =>
                  emit({ ...state, view: { ...state.view, mode: "top" } })
                }
              >
                杯内俯视
              </button>
              <button
                type="button"
                aria-pressed={state.view.mode === "unfold"}
                disabled={Boolean(state.draft)}
                onClick={() =>
                  emit({ ...state, view: { ...state.view, mode: "unfold" } })
                }
              >
                展开观察
              </button>
            </div>
            <div className="cf-view-ranges">
              <label>
                观察角度{" "}
                <input
                  type="range"
                  aria-label="杯纹观察角度"
                  min="-180"
                  max="180"
                  step="15"
                  value={state.view.rotation}
                  disabled={Boolean(state.draft)}
                  onChange={(e) =>
                    emit({
                      ...state,
                      view: { ...state.view, rotation: Number(e.target.value) },
                    })
                  }
                />
                <output>{state.view.rotation}°</output>
              </label>
              <label>
                放大{" "}
                <input
                  type="range"
                  aria-label="杯纹放大"
                  min="1"
                  max="2"
                  step=".1"
                  value={state.view.zoom}
                  disabled={Boolean(state.draft)}
                  onChange={(e) =>
                    emit({
                      ...state,
                      view: { ...state.view, zoom: Number(e.target.value) },
                    })
                  }
                />
                <output>{state.view.zoom.toFixed(1)}×</output>
              </label>
            </div>
            <p className="cf-fine">
              视角变化不改变纹样。杯柄是固定参照；杯口、杯壁、杯底仅表示实际图像区域。
            </p>
          </div>
        )}
      </div>
      {!revealed && (
        <div className="cf-actions">
          {state.stage === "residue" && (
            <button
              type="button"
              className="cf-primary"
              onClick={() => emit(advanceCoffee(state))}
            >
              开始轻转杯子
            </button>
          )}
          {state.stage === "turn" && (
            <button
              type="button"
              className="cf-primary"
              onClick={() => emit(advanceCoffee(latest.current.state))}
            >
              覆上杯碟 · 固定杯纹
            </button>
          )}
          {state.stage === "covered" && (
            <button
              type="button"
              className="cf-primary"
              onClick={() => emit(advanceCoffee(state))}
            >
              翻杯，杯口朝下
            </button>
          )}
          {state.stage === "inverted" && (
            <button
              type="button"
              className="cf-primary"
              onClick={() => emit(advanceCoffee(state))}
            >
              让杯渣沉降
            </button>
          )}
          {state.stage === "settling" && (
            <button type="button" onClick={finishSettling}>
              跳过沉降等待
            </button>
          )}
          {state.stage === "settled" && (
            <button
              type="button"
              className="cf-primary"
              onClick={() => emit(advanceCoffee(state))}
            >
              揭杯，开始观察
            </button>
          )}
          <p className="cf-fine">
            转动、覆碟、翻杯和等待时长是本站交互编排。跳过等待只结束动画。
          </p>
        </div>
      )}
      {state.stage === "observe" && (
        <div className="cf-observer">
          {!state.draft && (
            <div className="cf-button-row">
              <button
                type="button"
                className="cf-primary"
                disabled={state.working.length >= 8}
                onClick={() => emit(beginCoffeeAnnotation(state))}
              >
                框选一片区域，记录我的联想
              </button>
              {!state.working.length && (
                <button
                  type="button"
                  onClick={() => emit(completeCoffee(state, true))}
                >
                  没有看见清楚形状
                </button>
              )}
            </div>
          )}
          {state.draft && (
            <div className="cf-annotation-form" ref={panelRef}>
              <h5>这片区域让你想到什么？</h5>
              <p>
                在展开图拖动框选，或用四个坐标控件调整。此时锁定观察角度和缩放，保证框选坐标一致。
              </p>
              <div className="cf-box-controls">
                {(["u", "v", "width", "height"] as const).map((key) => (
                  <label key={key}>
                    {
                      {
                        u: "起始周向",
                        v: "离杯底高度",
                        width: "区域宽度",
                        height: "区域高度",
                      }[key]
                    }
                    <input
                      type="range"
                      min={key === "u" || key === "v" ? 0 : 50}
                      max={
                        key === "u"
                          ? 1000 - state.draft!.box.width
                          : key === "v"
                            ? 1000 - state.draft!.box.height
                            : key === "width"
                              ? 1000 - state.draft!.box.u
                              : 1000 - state.draft!.box.v
                      }
                      step="10"
                      value={state.draft!.box[key]}
                      onChange={(e) => adjustBox(key, Number(e.target.value))}
                    />
                    <output>{Math.round(state.draft!.box[key] / 10)}%</output>
                  </label>
                ))}
              </div>
              <p className="cf-fine">
                框选中心：{coffeeRegion(state.draft.box)}
              </p>
              <label className="cf-field">
                我的意象选择
                <select
                  value={state.draft.symbol ?? ""}
                  onChange={(e) => {
                    const { symbol: _symbol, ...draft } = state.draft!;
                    emit({
                      ...state,
                      draft: {
                        ...draft,
                        ...(e.target.value ? { symbol: e.target.value } : {}),
                      },
                    });
                  }}
                >
                  <option value="">由我选择，不自动判断</option>
                  {COFFEE_SYMBOLS.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="other">其他联想</option>
                  <option value="uncertain">不确定</option>
                </select>
              </label>
              <label className="cf-field">
                我的观察（可选，最多 160 字）
                <textarea
                  maxLength={160}
                  rows={2}
                  value={state.draft.note}
                  onChange={(e) =>
                    emit({
                      ...state,
                      draft: { ...state.draft!, note: e.target.value },
                    })
                  }
                />
              </label>
              <div className="cf-button-row">
                <button
                  type="button"
                  className="cf-primary"
                  disabled={!state.draft.symbol}
                  onClick={() => emit(saveCoffeeAnnotation(state))}
                >
                  保存这片观察
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { draft: _draft, ...rest } = state;
                    emit(rest);
                  }}
                >
                  取消框选
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {displayed.length > 0 && (
        <ol className="cf-observations">
          {displayed.map((a) => (
            <li key={a.id}>
              <div>
                <strong>
                  {coffeeRegion(a.box)} · {coffeeSymbolName(a.symbol)}
                </strong>
                {a.note && <p>{a.note}</p>}
                <small>由你手工选择；不是系统识别。</small>
              </div>
              {state.stage === "observe" && !state.draft && (
                <button
                  type="button"
                  aria-label={`删除${coffeeSymbolName(a.symbol)}标注`}
                  onClick={() =>
                    emit({
                      ...state,
                      working: state.working
                        .filter((b) => b.id !== a.id)
                        .map((b, i) => ({ ...b, id: i + 1 })),
                    })
                  }
                >
                  删除
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {state.stage === "observe" &&
        state.working.length > 0 &&
        !state.draft && (
          <div className="cf-actions">
            <button
              type="button"
              className="cf-primary"
              onClick={() => emit(completeCoffee(state))}
            >
              完成本版观察，查阅象征提示
            </button>
            <p className="cf-fine">
              最多记录 8 片区域；它们共同构成这一杯观察，不是多份独立预测。
            </p>
          </div>
        )}
      {state.stage === "complete" && (
        <div className="cf-completed">
          <p role="status">
            观察版本 {state.activeVersion} 已保存于本次记录。
            {currentObservation?.outcome === "unclear"
              ? "这一次没有看见清楚形状，也是完整的观察。"
              : "下方提示仅根据你主动选择的联想生成。"}
          </p>
          <div className="cf-button-row">
            <label>
              查看观察版本{" "}
              <select
                aria-label="查看咖啡观察版本"
                value={state.activeVersion}
                onChange={(e) =>
                  emit({ ...state, activeVersion: Number(e.target.value) })
                }
              >
                {state.observations.map((o) => (
                  <option value={o.id} key={o.id}>
                    版本 {o.id} ·{" "}
                    {o.outcome === "unclear"
                      ? "未见清楚形状"
                      : `${o.annotations.length} 条联想`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={state.observations.length >= 8}
              onClick={() => emit(reobserveCoffee(state))}
            >
              用同一杯纹再观察一版
            </button>
          </div>
          <p className="cf-fine">
            最多保留 8 个观察版本。新版本不会重画杯纹，也不会覆盖之前的观察。
          </p>
        </div>
      )}
      <details className="cf-source-note">
        <summary>这项体验的来源与约定</summary>
        <p>
          土耳其咖啡文化中有饮后观渣习俗；饮尽后将杯倒扣在碟上，让残渣形成纹样。这里呈现的是原创视觉模拟，不是精确流体模拟，也没有识别模型或预先抽出的意象。
        </p>
        <p>
          词典中的 20
          条都是「本站象征提示」，没有冒充统一传统判词。杯柄、杯口、杯壁和杯底用来定位，不对应未来时间或吉凶。
          {input.scene !== "无预设"
            ? `本次保留你选择的「${input.scene}」场景。`
            : ""}
        </p>
        <p>
          <a href={COFFEE_SOURCES[0]} target="_blank" rel="noreferrer">
            UNESCO：咖啡文化与习俗存在
          </a>{" "}
          ·{" "}
          <a href={COFFEE_SOURCES[1]} target="_blank" rel="noreferrer">
            GoTürkiye：饮后倒扣观纹流程
          </a>
        </p>
      </details>
    </section>
  );
}
