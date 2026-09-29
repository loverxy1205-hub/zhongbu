import { useId, useState } from "react";
import type { MatrixDigit, NumberMatrixRaw } from "../types";
import { MATRIX_LAYOUT, MATRIX_NUMBERS } from "../data/numbers";
import "../matrix.css";

/** Read-only interaction with the frozen matrix; no date or random source. */
export function MatrixArt({ raw }: { raw: NumberMatrixRaw }) {
  const [selected, setSelected] = useState<MatrixDigit>(
    () =>
      [...raw.cells].sort((a, b) => b.count - a.count || a.digit - b.digit)[0]
        .digit,
  );
  const detailId = useId();
  const entry = MATRIX_NUMBERS[selected - 1];
  const count = raw.cells.find((cell) => cell.digit === selected)!.count;
  return (
    <section
      className="number-matrix"
      aria-label="生日数字九宫格"
      data-testid="number-matrix"
    >
      <div className="matrix-heading">
        <span className="matrix-eyebrow">PYTHAGOREAN-STYLE · MODERN</span>
        <h3>属于你的数字图案</h3>
        <p>轻触九宫，看看每一格的含义</p>
      </div>
      <div className="matrix-frame">
        <span className="matrix-corner corner-nw" aria-hidden="true">
          ✦
        </span>
        <span className="matrix-corner corner-ne" aria-hidden="true">
          ✦
        </span>
        <span className="matrix-corner corner-sw" aria-hidden="true">
          ✦
        </span>
        <span className="matrix-corner corner-se" aria-hidden="true">
          ✦
        </span>
        <div
          className="matrix-grid"
          role="group"
          aria-label="九宫格，按行排列为一四七、二五八、三六九"
        >
          {MATRIX_LAYOUT.map((digit) => {
            const cell = raw.cells.find((cell) => cell.digit === digit)!;
            const knowledge = MATRIX_NUMBERS[digit - 1];
            return (
              <button
                type="button"
                className={`matrix-cell ${cell.count ? "is-filled" : "is-empty"}`}
                key={digit}
                onClick={() => setSelected(digit)}
                aria-label={`${digit}，${knowledge.keywords[0]}，出现 ${cell.count} 次`}
                aria-pressed={selected === digit}
                aria-controls={detailId}
                data-testid={`matrix-cell-${digit}`}
              >
                <span className="matrix-index" aria-hidden="true">
                  {digit}
                </span>
                <span className="matrix-digits" aria-hidden="true">
                  {cell.count ? (
                    Array.from({ length: cell.count }, (_, i) => (
                      <span key={i}>{digit}</span>
                    ))
                  ) : (
                    <span className="matrix-blank">·</span>
                  )}
                </span>
                <span className="matrix-keyword">{knowledge.keywords[0]}</span>
                <span className="matrix-count">
                  {cell.count ? `出现 ${cell.count} 次` : "留白"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="matrix-detail"
        id={detailId}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="matrix-detail-digit" aria-hidden="true">
          {selected}
        </span>
        <div>
          <h4>{entry.name}</h4>
          <p>
            {count
              ? entry.meaning
              : `这一格留白，不代表你缺少「${entry.keywords[0]}」；可以把它当作额外的观察角度。${entry.meaning}`}
          </p>
        </div>
      </div>
      <p className="matrix-convention">
        毕达哥拉斯式生日数字九宫格 · 本站现代约定：生日原始数字入格，忽略
        0、保留重复，不加四工作数。次数不是评分，留白不是缺陷。
      </p>
    </section>
  );
}
