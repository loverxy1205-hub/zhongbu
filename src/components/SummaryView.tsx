import type { EngineId, Preferences, Reading } from "../types";
import { ENGINES } from "../data/meta";
import { summarize } from "../rules/summary";
export function SummaryView({
  reading,
  prefs,
  personal,
  onScope,
}: {
  reading: Reading;
  prefs: Preferences;
  personal: boolean;
  onScope: (id: EngineId) => void;
}) {
  const results = personal
    ? reading.results.filter((r) => prefs.included.includes(r.engine))
    : reading.results;
  const s = summarize(results, reading.input);
  return (
    <section className="summary-panel">
      <div className="section-kicker">
        {personal ? "由你选择参考范围" : "所有已选体系的共同参照"}
      </div>
      {!!s.excluded.length && (
        <p className="scope-note">
          {s.excluded.join("、")}{" "}
          保留在各家视图，属于资料／历史／演示记录，不进入主题归纳或方向汇总。
        </p>
      )}
      {s.experiential && (
        <p className="muted">
          新体验不为行动选项投票。地占的十五图位、咖啡的多个意象、掷筊的三次确认各只构成一个结果；掷筊的应允只对应它单独确认的命题。
        </p>
      )}
      <h2>{personal ? "我的偏好汇总" : "规则汇总"}</h2>
      <p className="muted">
        只读取已经生成并冻结的结果。认同只是偏好，不代表更准确。
      </p>
      {personal && (
        <fieldset className="scope-options">
          <legend>哪些结果参与本次汇总</legend>
          {reading.results.map((r) => (
            <label key={r.engine}>
              <input
                type="checkbox"
                checked={prefs.included.includes(r.engine)}
                onChange={() => onScope(r.engine)}
              />
              {ENGINES[r.engine].name}
            </label>
          ))}
        </fieldset>
      )}
      <div className="scope-note">
        当前范围：{s.scope.join("、") || "未选择结果"}。
        {s.unavailable ? `${s.unavailable} 项不可用，不参与主题归纳。` : ""}
      </div>
      {!results.length ? (
        <p>选择至少一项结果后显示汇总。</p>
      ) : (
        <>
          <h3>共同主题</h3>
          {s.common.length ? (
            s.common.map((t) => <p key={t}>{t}</p>)
          ) : (
            <p>当前范围没有重复主题，不强行归并。</p>
          )}
          <h3>各自的侧重点</h3>
          {s.differences.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <div className="difference-note">
            <h3>保留分歧</h3>
            <p>{s.conflict}</p>
          </div>
          {s.inclination && (
            <p>
              <b>规则参考：{s.inclination}</b>
            </p>
          )}
          <p>{s.note}</p>
          {s.related && (
            <p className="related-note">
              周易与梅花易数属于相关体系，不是两份独立科学证据。
            </p>
          )}
        </>
      )}
    </section>
  );
}
