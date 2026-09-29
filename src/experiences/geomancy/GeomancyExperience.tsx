import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { Interpretation, PublicInput } from "../../types";
import { figureFor } from "./data";
import {
  addSandPoint,
  advanceGeomancy,
  clearSandRow,
  commitAutomaticCounts,
  commitPhysicalCounts,
  commitSandRow,
  HAND_DOT_LIMIT,
  selectGeomancyMode,
  setPhysicalCount,
  type GeomancyState,
  type ShieldId,
  type ShieldPosition,
} from "./state";
import "./geomancy.css";

const steps = [
  "两两配对 · 奇偶归约",
  "四母入位",
  "逐行转置 · 四女",
  "两两合成 · 四侄",
  "两侧汇合 · 证人",
  "证人合成 · 裁判",
  "盾图完成",
];
const modeNames = { hand: "亲手点沙", physical: "实物录入", auto: "自动生成" };
const layout: ShieldId[][] = [
  ["D4", "D3", "D2", "D1", "M4", "M3", "M2", "M1"],
  ["N4", "N3", "N2", "N1"],
  ["W2", "W1"],
  ["J"],
];

function FigureDots({ code, label }: { code: string; label: string }) {
  return (
    <span
      className="gm-figure"
      role="img"
      aria-label={`${label}，自上而下${[...code].map((bit) => (bit === "1" ? "单点" : "双点")).join("、")}`}
    >
      {[...code].map((bit, i) => (
        <span className="gm-figure-row" key={i}>
          <i />
          {bit === "0" && <i />}
        </span>
      ))}
    </span>
  );
}

function derivation(position: ShieldPosition): string {
  if (position.id.startsWith("M"))
    return `取自原始第${position.rows.map((n) => n + 1).join("、")}行，自上向下以奇数为单点、偶数为双点。`;
  if (position.id.startsWith("D"))
    return `依次取M1、M2、M3、M4的第${position.id.slice(1)}行，自上向下排列；即原始第${position.rows.map((n) => n + 1).join("、")}行。这是转置，不是求和。`;
  return `由${position.parents.join("与")}逐行合成：相同为双点（0），不同为单点（1）。`;
}

export function GeomancyExperience({
  state,
  onChange,
  motionPaused,
  interpretation,
}: {
  state: GeomancyState;
  onChange: (next: GeomancyState) => void;
  input: PublicInput;
  motionPaused: boolean;
  /** Frozen by the host at completion; never recomputed by presentation. */
  interpretation?: Interpretation;
}) {
  const [error, setError] = useState("");
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const current = useRef(state);
  const changeRef = useRef(onChange);
  // The synchronous guard uses the latest state even before a parent render.
  useLayoutEffect(() => {
    current.current = state;
    changeRef.current = onChange;
  }, [state, onChange]);
  const send = (update: (previous: GeomancyState) => GeomancyState) => {
    const next = update(current.current);
    if (next !== current.current) {
      current.current = next;
      changeRef.current(next);
    }
  };
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (state.phase !== "reveal" || !state.running || motionPaused || reduced)
      return;
    const expectedStep = state.revealStep;
    const timer = window.setTimeout(
      () => {
        const previous = current.current;
        if (
          previous.phase !== "reveal" ||
          !previous.running ||
          previous.revealStep !== expectedStep
        )
          return;
        const next = advanceGeomancy(previous);
        current.current = next;
        changeRef.current(next);
      },
      expectedStep === 0 ? 1600 : 1100,
    );
    return () => window.clearTimeout(timer);
  }, [state.phase, state.running, state.revealStep, motionPaused, reduced]);

  const rowIndex = state.committedCounts.length;
  const currentDots = state.handRows[Math.min(rowIndex, 15)];
  const paused = motionPaused || reduced || !state.running;
  const available =
    state.phase === "complete" ? 15 : [0, 4, 8, 12, 14, 15][state.revealStep];
  const selected = state.raw?.positions.find(
    (p) => p.id === state.selectedPosition,
  );
  const add = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) send((s) => addSandPoint(s));
    else {
      const bounds = event.currentTarget.getBoundingClientRect();
      send((s) =>
        addSandPoint(
          s,
          (event.clientX - bounds.left) / bounds.width,
          (event.clientY - bounds.top) / bounds.height,
        ),
      );
    }
  };

  return (
    <section
      className={`gm-experience ${paused ? "gm-paused" : ""}`}
      data-testid="geomancy-experience"
      aria-label="地占术沙盘起占"
    >
      <header className="gm-heading">
        <span className="gm-kicker">GEOMANCY · SHIELD CHART</span>
        <h3>沙落成图</h3>
        <p>十六行沙迹，推演一张盾图。</p>
      </header>
      {state.phase === "mode" && (
        <div className="gm-mode-choice">
          <p>选择本次点数的来源。开始后沿用同一种方式，已提交的行不能重画。</p>
          <div className="gm-modes">
            <button
              type="button"
              onClick={() => send((s) => selectGeomancyMode(s, "hand"))}
            >
              <span aria-hidden="true">∴</span>
              <strong>亲手点沙</strong>
              <small>4组 × 4行，每次点按留下一粒沙</small>
            </button>
            <button
              type="button"
              onClick={() => send((s) => selectGeomancyMode(s, "physical"))}
            >
              <span aria-hidden="true">✎</span>
              <strong>实物录入</strong>
              <small>把沙地或纸上的16行点数带进来</small>
            </button>
            <button
              type="button"
              onClick={() => send((s) => selectGeomancyMode(s, "auto"))}
            >
              <span aria-hidden="true">⁙</span>
              <strong>自动点沙</strong>
              <small>使用本次提交时已冻结的随机点数</small>
            </button>
          </div>
          <p className="gm-note">
            基本盾形图：4母、4女、4侄、2证人、1裁判；本版不作十二宫断法。
          </p>
        </div>
      )}
      {state.mode && (
        <p className="gm-mode-label">本次方式 · {modeNames[state.mode]}</p>
      )}
      {state.phase === "input" && state.mode === "hand" && (
        <div className="gm-hand-input">
          <div
            className="gm-row-progress"
            aria-label={`已提交${rowIndex}行，共16行`}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className={
                  i < rowIndex ? "gm-done" : i === rowIndex ? "gm-current" : ""
                }
              >
                {i < rowIndex
                  ? state.committedCounts[i] % 2
                    ? "•"
                    : "••"
                  : i + 1}
              </span>
            ))}
          </div>
          <h4>
            第{Math.floor(rowIndex / 4) + 1}组 · 第{(rowIndex % 4) + 1}行
          </h4>
          <p id="gm-hand-help">
            点击沙面或按空格加一点；按 Enter 结束当前行。每行1–{HAND_DOT_LIMIT}
            点，上限会明确提示；长按不连点。
          </p>
          <button
            type="button"
            className="gm-sand-pad"
            aria-label="点沙面，每次添加一个点"
            aria-describedby="gm-hand-help"
            onClick={add}
            onKeyDown={(event) => {
              if (event.repeat) {
                event.preventDefault();
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                send(commitSandRow);
              }
            }}
          >
            <span className="gm-sand-grain" aria-hidden="true" />
            {currentDots.map((point) => (
              <i
                key={point.id}
                className="gm-sand-dot"
                data-point-id={point.id}
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              />
            ))}
            {!currentDots.length && (
              <span className="gm-pad-prompt">让手指在沙面留下一点</span>
            )}
          </button>
          <div className="gm-hand-actions">
            <span aria-live="polite">
              本行 {currentDots.length} 点
              {currentDots.length === HAND_DOT_LIMIT
                ? " · 已达上限，请结束本行"
                : ""}
            </span>
            <button
              type="button"
              disabled={!currentDots.length}
              onClick={() => send(clearSandRow)}
            >
              清空当前行
            </button>
            <button
              type="button"
              className="primary"
              disabled={!currentDots.length}
              onClick={() => send(commitSandRow)}
            >
              结束本行
            </button>
          </div>
          {rowIndex > 0 && (
            <p className="gm-last-row" role="status">
              第{rowIndex}行已冻结：{state.committedCounts[rowIndex - 1]}点 →{" "}
              {state.committedCounts[rowIndex - 1] % 2
                ? "奇数 · 单点"
                : "偶数 · 双点"}
            </p>
          )}
        </div>
      )}
      {state.phase === "input" && state.mode === "physical" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              send(commitPhysicalCounts);
              setError("");
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "请检查16行点数",
              );
            }
          }}
        >
          <p>
            从上往下、每四行为一组，填写全部16行正整数。每行1–999999，空行不算偶数。
          </p>
          <div className="gm-physical-grid">
            {Array.from({ length: 4 }, (_, group) => (
              <fieldset key={group}>
                <legend>
                  第{group + 1}组 · M{group + 1}
                </legend>
                {Array.from({ length: 4 }, (_, row) => {
                  const i = group * 4 + row;
                  return (
                    <label key={i}>
                      第{i + 1}行
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[1-9][0-9]{0,5}"
                        required
                        maxLength={6}
                        value={state.physicalDraft[i]}
                        onChange={(event) =>
                          send((s) =>
                            setPhysicalCount(s, i, event.target.value),
                          )
                        }
                        aria-label={`第${i + 1}行点数`}
                      />
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="primary">
            冻结16行，开始推演
          </button>
        </form>
      )}
      {state.phase === "input" && state.mode === "auto" && (
        <div className="gm-auto-input">
          <div className="gm-auto-mark" aria-hidden="true">
            ∴<span>∵</span>∴
          </div>
          <p>
            每行均匀抽取5–36点，奇偶各占16种。这是本站数字模拟约定，并非古籍规定的点数范围。
          </p>
          <p>16行已在本次提交时冻结；点击后只展开，不重新生成。</p>
          <button
            type="button"
            className="primary"
            onClick={() => send(commitAutomaticCounts)}
          >
            展开自动沙迹
          </button>
        </div>
      )}
      {state.raw && (
        <>
          <nav className="gm-view-tabs" aria-label="地占查看方式">
            {(["sand", "shield", "interpret"] as const).map((view, i) => (
              <button
                type="button"
                key={view}
                disabled={view === "interpret" && state.phase !== "complete"}
                aria-pressed={state.view === view}
                onClick={() => send((s) => ({ ...s, view }))}
              >
                {["看沙迹", "看盾图", "看解读"][i]}
              </button>
            ))}
          </nav>
          {state.phase === "reveal" && (
            <div className="gm-demonstration">
              <p role="status">
                {steps[state.revealStep]}{" "}
                <small>{state.revealStep + 1}/6</small>
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => send((s) => ({ ...s, running: !s.running }))}
                >
                  {state.running ? "暂停推演" : "继续推演"}
                </button>
                <button
                  type="button"
                  onClick={() => send((s) => advanceGeomancy(s))}
                >
                  下一步
                </button>
                <button
                  type="button"
                  onClick={() => send((s) => advanceGeomancy(s, true))}
                >
                  跳过演示，保留结果
                </button>
              </div>
              {(motionPaused || reduced) && (
                <small>动态效果已暂停，可逐步查看或跳过演示。</small>
              )}
            </div>
          )}
          {state.view === "sand" && (
            <div
              className={`gm-traces ${state.phase === "reveal" && state.revealStep === 0 ? "gm-pairing" : ""}`}
            >
              {state.raw.rawCounts.map((count, i) => (
                <div className="gm-trace-row" key={i}>
                  <span className="gm-trace-label">
                    M{Math.floor(i / 4) + 1} · 第{i + 1}行
                  </span>
                  <div className="gm-trace-dots" aria-label={`原始${count}点`}>
                    {Array.from(
                      { length: Math.min(count, HAND_DOT_LIMIT) },
                      (_, n) => (
                        <i
                          key={
                            state.mode === "hand" ? state.handRows[i][n].id : n
                          }
                          data-point-id={
                            state.mode === "hand"
                              ? state.handRows[i][n].id
                              : undefined
                          }
                          className={
                            n < count - (count % 2 || 2)
                              ? "gm-paired-dot"
                              : "gm-remainder-dot"
                          }
                        />
                      ),
                    )}
                    {count > HAND_DOT_LIMIT && (
                      <span className="gm-more-count">
                        … 共{count}点（完整数量见右）
                      </span>
                    )}
                  </div>
                  <strong>
                    {count} → {count % 2 ? "•" : "••"}
                    <small>{count % 2 ? "奇" : "偶"}</small>
                  </strong>
                </div>
              ))}
              <p className="gm-note">
                单点编码1，双点编码0；每个图形的四行从上向下读取。实物大数量仅缩略画点，计算始终使用完整录入值。
              </p>
            </div>
          )}
          {state.view === "shield" && (
            <div className="gm-shield-view">
              <p className="gm-note">
                屏幕右侧为母图，左侧为女图；每行从右向左编号。点开图位查看它从哪里来。
              </p>
              <div
                className="gm-shield-scroll"
                tabIndex={0}
                aria-label="盾形图，可横向滚动"
              >
                <div className="gm-shield">
                  {layout.map((row, layer) => (
                    <div
                      className={`gm-shield-layer gm-layer-${layer}`}
                      key={layer}
                    >
                      {layer > 0 && (
                        <svg
                          className="gm-connections"
                          viewBox="0 0 800 40"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          {row.map((id, i) => {
                            const width = 800 / row.length;
                            const middle = width * (i + 0.5);
                            return (
                              <path
                                key={id}
                                d={`M ${middle - width / 4} 0 V 12 L ${middle} 36 L ${middle + width / 4} 12 V 0`}
                              />
                            );
                          })}
                        </svg>
                      )}
                      <div
                        className="gm-shield-nodes"
                        style={{
                          gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {row.map((id) => {
                          const index = state.raw!.positions.findIndex(
                            (p) => p.id === id,
                          );
                          const position = state.raw!.positions[index];
                          const visible = index < available;
                          const figure = figureFor(position.code);
                          return (
                            <button
                              type="button"
                              key={id}
                              className={`gm-shield-node ${visible ? "gm-node-visible" : "gm-node-pending"}`}
                              disabled={!visible}
                              aria-pressed={selected?.id === id}
                              data-position={id}
                              data-code={visible ? position.code : undefined}
                              onClick={() =>
                                send((s) => ({ ...s, selectedPosition: id }))
                              }
                              aria-label={
                                visible
                                  ? `${id} ${figure.name}，查看生成依据`
                                  : `${id}尚未推演`
                              }
                            >
                              <small>{id}</small>
                              {visible ? (
                                <>
                                  <FigureDots
                                    code={position.code}
                                    label={figure.name}
                                  />
                                  <strong>{figure.name}</strong>
                                </>
                              ) : (
                                <span className="gm-node-empty">·</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selected && (
                <aside className="gm-position-detail" aria-live="polite">
                  <h4>
                    {selected.id} · {figureFor(selected.code).name}{" "}
                    <small>{figureFor(selected.code).latin}</small>
                  </h4>
                  <p>{derivation(selected)}</p>
                  {selected.parents.length === 2 && (
                    <p className="gm-xor-proof">
                      {selected.parents
                        .map(
                          (id) =>
                            state.raw!.positions.find((p) => p.id === id)!.code,
                        )
                        .join(" ⊕ ")}{" "}
                      = {selected.code}
                    </p>
                  )}
                  <p>
                    <strong>本站条目说明：</strong>
                    {figureFor(selected.code).meaning}
                  </p>
                  <small>{figureFor(selected.code).traditional}</small>
                </aside>
              )}
            </div>
          )}
          {state.view === "interpret" && interpretation && (
            <div className="gm-reading">
              <div className="gm-judge-seal">
                <FigureDots
                  code={state.raw.positions[14].code}
                  label={figureFor(state.raw.positions[14].code).name}
                />
                <div>
                  <small>裁判 J · 由两位证人合成</small>
                  <h4>{figureFor(state.raw.positions[14].code).name}</h4>
                  <p>{interpretation.headline}</p>
                </div>
              </div>
              {interpretation.traditional.map((p, index) => (
                <article
                  key={`traditional-${index}`}
                  data-knowledge-id={p.knowledgeId}
                  data-rule-id={p.ruleId}
                  data-template-id={p.templateId}
                >
                  <h4>传统资料 · {p.label}</h4>
                  <p>{p.text}</p>
                </article>
              ))}
              {[...interpretation.paragraphs, ...interpretation.reflection].map(
                (p, index) => (
                  <article
                    key={`reading-${index}`}
                    data-knowledge-id={p.knowledgeId}
                    data-rule-id={p.ruleId}
                    data-template-id={p.templateId}
                  >
                    <h4>{p.label}</h4>
                    <p>{p.text}</p>
                  </article>
                ),
              )}
              <details>
                <summary>传统图名与本站联想的边界</summary>
                <p>
                  传统资料支持本页图形、名称和盾图推演。上面的中文象征解释及位置联想由本站整理；没有十二宫断法，不把裁判当作一条事实预言，也不把15个图位当15票。
                </p>
                <a
                  href="https://swh.princeton.edu/~ezb/geomancy/agrippa.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  查看 Turner 1655《Of Geomancy》资料
                </a>
              </details>
            </div>
          )}
          {state.view === "interpret" && !interpretation && (
            <p className="gm-note" role="status">
              本条冻结解读尚未载入；沙迹与盾图仍可查看。
            </p>
          )}
        </>
      )}
    </section>
  );
}
