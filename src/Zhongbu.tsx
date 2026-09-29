import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  Category,
  EngineId,
  Input,
  Preferences,
  SavedReading,
  Scene,
} from "./types";
import { DISCLAIMER, ENGINES, ENGINE_IDS } from "./data/meta";
import { createReading } from "./engines/reading";
import { detectTimezone, todayLocal } from "./lib/dates";
import {
  clearHistory,
  defaultPreferences,
  getBrowserStorage,
  loadHistory,
  loadSession,
  saveHistory,
  saveSession,
  SESSION_KEY,
} from "./lib/storage";
import {
  download,
  exportJSON,
  readingMarkdown,
  resultMarkdown,
} from "./lib/export";
import { ResultCard } from "./components/ResultCard";
import { KnowledgeLibrary } from "./components/KnowledgeLibrary";
import { SummaryView } from "./components/SummaryView";
import { ADAPTED_ACTIONS } from "./rules/interpret";
import "./styles.css";
const initialInput = (): Input => ({
  question: "",
  category: "日常",
  mode: "explore",
  scene: "无预设",
  action: "",
  targetDate: todayLocal(),
  timezone: detectTimezone(),
  engines: [...ENGINE_IDS],
  birthday: "",
  reversals: true,
  everydayOnly: false,
});
function restoreSession() {
  try {
    return loadSession(getBrowserStorage("sessionStorage"));
  } catch {
    return { value: null, error: "会话存储不可用，刷新不会保留当前结果。" };
  }
}
function restoreHistory() {
  try {
    return loadHistory(getBrowserStorage("localStorage"));
  } catch {
    return { value: [], error: "本机存储不可用，当前计算不受影响。" };
  }
}
export default function Zhongbu() {
  const [initialSession] = useState(restoreSession),
    [initialHistory] = useState(restoreHistory);
  const [active, setActive] = useState<SavedReading | null>(
      initialSession.value,
    ),
    [history, setHistory] = useState<SavedReading[]>(initialHistory.value);
  const [input, setInput] = useState<Input>(initialInput),
    [page, setPage] = useState<"reading" | "history" | "library">("reading");
  const [view, setView] = useState<"all" | "summary" | "personal">("all"),
    [notice, setNotice] = useState(
      initialSession.error || initialHistory.error || "",
    );
  const [historyError, setHistoryError] = useState(!!initialHistory.error),
    [formError, setFormError] = useState("");
  const [animate, setAnimate] = useState(false),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  const lock = useRef(!!initialSession.value),
    heading = useRef<HTMLHeadingElement>(null);
  const readingKey = active?.reading.readingId;
  useEffect(() => {
    if (readingKey && page === "reading") heading.current?.focus();
  }, [readingKey, page]);
  function activate(value: SavedReading) {
    setActive(value);
    try {
      const error = saveSession(getBrowserStorage("sessionStorage"), value);
      if (error) setNotice(error);
    } catch {
      setNotice("会话存储不可用；当前结果可以导出，刷新不会保留。");
    }
  }
  function update<K extends keyof Input>(key: K, value: Input[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }
  function persist(items: SavedReading[]) {
    if (historyError) {
      setNotice("原有记录读取失败；请先导出当前结果，或清空损坏记录后再保存。");
      return false;
    }
    try {
      const error = saveHistory(getBrowserStorage("localStorage"), items);
      if (error) {
        setNotice(error);
        return false;
      }
      setHistory(items);
      return true;
    } catch {
      setNotice("保存失败：本机存储不可用，请导出当前记录。");
      return false;
    }
  }
  function save(value = active, quiet = false) {
    if (!value) return;
    const next = { ...value, savedAt: new Date().toISOString() };
    if (
      persist([
        next,
        ...history.filter(
          (h) => h.reading.readingId !== value.reading.readingId,
        ),
      ])
    ) {
      if (!quiet) setNotice("已保存到本机记录。生日未写入记录。");
    }
  }
  function changePreferences(prefs: Preferences, shouldSave = false) {
    if (!active) return;
    const next = { ...active, preferences: prefs };
    activate(next);
    if (
      shouldSave ||
      history.some((h) => h.reading.readingId === next.reading.readingId)
    )
      save(next, true);
  }
  function toggle(key: keyof Preferences, id: EngineId) {
    if (!active) return;
    const old = active.preferences[key];
    changePreferences(
      {
        ...active.preferences,
        [key]: old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
      },
      key === "favorites",
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setFormError("");
    try {
      const reading = createReading(input, new Date().toISOString());
      activate({
        reading,
        preferences: defaultPreferences(reading),
        savedAt: "",
      });
      update("birthday", "");
      setView("all");
      setOnlyFavorites(false);
      setAnimate(true);
    } catch (error) {
      lock.current = false;
      setFormError(
        error instanceof Error ? error.message : "无法创建记录，请检查输入。",
      );
    }
  }
  function newReading() {
    lock.current = false;
    setActive(null);
    setAnimate(false);
    setPage("reading");
    setFormError("");
    try {
      getBrowserStorage("sessionStorage").removeItem(SESSION_KEY);
    } catch {
      setNotice("无法清除会话存储。");
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("已复制，可粘贴到你的笔记。");
    } catch {
      setNotice("浏览器未允许复制；可使用 Markdown 导出。");
    }
  }
  function clearAll() {
    try {
      const error = clearHistory(getBrowserStorage("localStorage"));
      if (error) setNotice(error);
      else {
        setHistory([]);
        setHistoryError(false);
        setNotice("已清空本机历史，当前结果仍保留。");
      }
    } catch {
      setNotice("清空失败：本机存储不可用。");
    }
    setConfirmClear(false);
  }
  const displayed = active
    ? [...active.reading.results]
        .filter(
          (r) =>
            !onlyFavorites || active.preferences.favorites.includes(r.engine),
        )
        .sort(
          (a, b) =>
            Number(active.preferences.pinned.includes(b.engine)) -
            Number(active.preferences.pinned.includes(a.engine)),
        )
    : [];
  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => setPage("reading")}
          aria-label="众卜首页"
        >
          <span className="brand-seal">众</span>
          <span>
            众卜<small>一个问题，多种视角。</small>
          </span>
        </button>
        <nav aria-label="主导航">
          <button
            onClick={() => setPage("reading")}
            aria-current={page === "reading" ? "page" : undefined}
          >
            问一件事
          </button>
          <button
            onClick={() => setPage("history")}
            aria-current={page === "history" ? "page" : undefined}
          >
            本机记录 <span>{history.length}</span>
          </button>
          <button
            onClick={() => setPage("library")}
            aria-current={page === "library" ? "page" : undefined}
          >
            方法与知识
          </button>
        </nav>
        <span className="local-badge">
          <i /> 只在你的设备上计算
        </span>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="关闭通知">
            ×
          </button>
        </div>
      )}
      <main id="main">
        {page === "library" ? (
          <KnowledgeLibrary />
        ) : page === "history" ? (
          <section className="history-page">
            <div className="section-kicker">只属于你的笔记</div>
            <h1>本机记录</h1>
            <p>
              主动保存的结果与收藏留在此浏览器中。不同设备或浏览器之间不会同步。
            </p>
            <div className="toolbar">
              <button
                onClick={() =>
                  download(
                    "众卜-本机记录.json",
                    JSON.stringify(history, null, 2),
                    "application/json",
                  )
                }
                disabled={!history.length}
              >
                导出全部 JSON
              </button>
              <button
                onClick={() =>
                  download(
                    "众卜-本机记录.md",
                    history
                      .map((h) => readingMarkdown(h.reading))
                      .join("\n\n---\n\n"),
                    "text/markdown",
                  )
                }
                disabled={!history.length}
              >
                导出全部 Markdown
              </button>
              <button
                className="danger-text"
                onClick={() => setConfirmClear(true)}
                disabled={!history.length && !historyError}
              >
                清空记录
              </button>
            </div>
            {confirmClear && (
              <div className="clear-confirm" role="alert">
                <p>
                  将删除此浏览器中的全部已保存记录，无法撤销。可先导出一份。
                </p>
                <button onClick={clearAll}>确认清空</button>
                <button onClick={() => setConfirmClear(false)}>保留记录</button>
              </div>
            )}
            {history.length ? (
              <div className="history-list">
                {history.map((h) => (
                  <article key={h.reading.readingId}>
                    <div>
                      <span className="section-kicker">
                        {h.reading.input.targetDate} ·{" "}
                        {h.reading.input.category}
                      </span>
                      <h3>
                        {h.reading.input.question || "一次没有标题的探索"}
                      </h3>
                      <p>
                        {h.reading.results
                          .map((r) => ENGINES[r.engine].short)
                          .join(" / ")}{" "}
                        · 收藏 {h.preferences.favorites.length} 条
                      </p>
                    </div>
                    <div className="toolbar">
                      <button
                        onClick={() => {
                          activate(h);
                          lock.current = true;
                          setPage("reading");
                          setView("all");
                          setOnlyFavorites(false);
                          setAnimate(false);
                        }}
                      >
                        打开原记录
                      </button>
                      <button
                        className="danger-text"
                        onClick={() =>
                          persist(
                            history.filter(
                              (x) =>
                                x.reading.readingId !== h.reading.readingId,
                            ),
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>◇</span>
                <h2>还没有留下的记录</h2>
                <p>遇到值得回看的角度，再把它收藏在这里。</p>
                <button className="primary" onClick={() => setPage("reading")}>
                  去问一件事 →
                </button>
              </div>
            )}
          </section>
        ) : active ? (
          <section
            className={`results-page ${animate ? "reveal-results" : ""}`}
          >
            <div className="reading-topline">
              <span className="section-kicker">
                本次问卜 / 各自成篇，彼此参照
              </span>
              <button onClick={newReading}>＋ 再问一次（新记录）</button>
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {active.reading.input.question || "留一个问题给此刻的自己。"}
            </h1>
            <div className="reading-context">
              <span>{active.reading.input.category}</span>
              <span>
                {active.reading.input.mode === "explore"
                  ? "开放探索"
                  : "行动取舍"}
              </span>
              <span>目标 {active.reading.input.targetDate}</span>
              <span>{active.reading.input.scene}</span>
            </div>
            {active.reading.input.mode === "action" && (
              <p className="exact-action">
                正在考虑的行动：<strong>{active.reading.input.action}</strong>
              </p>
            )}
            <details className="reading-metadata">
              <summary>已冻结 · 问卜时刻与版本信息</summary>
              <p>
                {active.reading.askedAt} · 时区 {active.reading.input.timezone}
                <br />
                <code data-testid="reading-id">{active.reading.readingId}</code>
              </p>
              <p>
                {Object.entries(active.reading.versions)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" / ")}
              </p>
              <p>
                刷新、排序、收藏与偏好不会重新抽取。时间型体系在相同输入下可能不变。
              </p>
            </details>
            <div className="result-toolbar">
              <div className="tabs" aria-label="结果视图">
                <button
                  aria-pressed={view === "all"}
                  onClick={() => setView("all")}
                >
                  看各家 <span>{active.reading.results.length}</span>
                </button>
                <button
                  aria-pressed={view === "summary"}
                  onClick={() => setView("summary")}
                >
                  规则汇总
                </button>
                <button
                  aria-pressed={view === "personal"}
                  onClick={() => setView("personal")}
                >
                  我的偏好汇总
                </button>
              </div>
              <div className="toolbar">
                <button onClick={() => save()}>
                  {history.some(
                    (h) => h.reading.readingId === active.reading.readingId,
                  )
                    ? "✓ 已保存 · 更新"
                    : "保存本次"}
                </button>
                <details className="export-menu">
                  <summary>导出 ↓</summary>
                  <button
                    onClick={() =>
                      download(
                        `${active.reading.readingId}.json`,
                        exportJSON(active),
                        "application/json",
                      )
                    }
                  >
                    JSON
                  </button>
                  <button
                    onClick={() =>
                      download(
                        `${active.reading.readingId}.md`,
                        readingMarkdown(active.reading),
                        "text/markdown",
                      )
                    }
                  >
                    Markdown
                  </button>
                  <small>分享前检查问题和行动中的个人信息。</small>
                </details>
              </div>
            </div>
            {animate && (
              <button
                className="skip-animation"
                onClick={() => setAnimate(false)}
              >
                跳过动画／减少动态
              </button>
            )}
            {view === "all" ? (
              <>
                <div className="compare-intro">
                  <p>
                    不必认同多数，留下对你有意义的那一条。
                    <small>“我更认同”只表示偏好，不代表更准确。</small>
                  </p>
                  <div className="toolbar">
                    <button
                      onClick={() => {
                        setOnlyFavorites(false);
                        setView("all");
                      }}
                    >
                      查看全部
                    </button>
                    <button
                      aria-pressed={onlyFavorites}
                      onClick={() => setOnlyFavorites(!onlyFavorites)}
                    >
                      只看收藏
                    </button>
                    <button
                      onClick={() =>
                        changePreferences({ ...active.preferences, pinned: [] })
                      }
                    >
                      恢复默认排序
                    </button>
                  </div>
                </div>
                <div className="results-grid">
                  {displayed.map((r) => (
                    <ResultCard
                      key={r.engine}
                      result={r}
                      prefs={active.preferences}
                      onToggle={toggle}
                      onCopy={() => copy(resultMarkdown(r))}
                    />
                  ))}
                </div>
                {!displayed.length && (
                  <div className="empty-state">
                    本次尚未收藏解读。选择“查看全部”继续比较。
                  </div>
                )}
              </>
            ) : (
              <SummaryView
                reading={active.reading}
                prefs={active.preferences}
                personal={view === "personal"}
                onScope={(id) => toggle("included", id)}
              />
            )}
          </section>
        ) : (
          <>
            <section className="intro">
              <div>
                <span className="section-kicker">众卜 · 给思考留一点空白</span>
                <h1>
                  一个问题，<em>多种视角。</em>
                </h1>
                <p>让不同的象征各自说话。答案由你理解，选择始终属于你。</p>
              </div>
              <div className="intro-mark" aria-hidden="true">
                <span>✧</span>
                <i />
                <small>看见 · 思考 · 自择</small>
              </div>
            </section>
            <div className="workspace">
              <form className="question-form" onSubmit={submit}>
                <div className="form-heading">
                  <span className="step-number">01</span>
                  <div>
                    <h2>此刻，你想问什么？</h2>
                    <p>不必问得完美，从正在想的一件小事开始。</p>
                  </div>
                </div>
                <label className="field question-field">
                  你的问题 <span>可以留白，只做探索</span>
                  <textarea
                    value={input.question}
                    onChange={(e) => update("question", e.target.value)}
                    maxLength={2000}
                    placeholder="比如：面对接下来的一周，我可以留意些什么？"
                    rows={3}
                  />
                </label>
                <div className="input-note">
                  问题用于展示与记录；解读依据下方由你选择的类别、场景和行动。
                </div>
                <fieldset className="chip-field">
                  <legend>问题类别</legend>
                  <div className="chips">
                    {(
                      [
                        "日常",
                        "学业",
                        "工作",
                        "人际",
                        "自我探索",
                        "其他",
                      ] as Category[]
                    ).map((c) => (
                      <button
                        type="button"
                        aria-pressed={input.category === c}
                        onClick={() => update("category", c)}
                        key={c}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="mode-field">
                  <legend>想从哪种方式开始</legend>
                  <div className="mode-options">
                    {(["explore", "action"] as const).map((m) => (
                      <label
                        key={m}
                        className={input.mode === m ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="mode"
                          checked={input.mode === m}
                          onChange={() => update("mode", m)}
                        />
                        <span>
                          <b>{m === "explore" ? "开放探索" : "行动取舍"}</b>
                          <small>
                            {m === "explore"
                              ? "看看有哪些值得留意的角度"
                              : "围绕一项明确的行动反思"}
                          </small>
                        </span>
                        <i>{m === "explore" ? "✧" : "⇌"}</i>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {input.mode === "action" && (
                  <label className="field">
                    我正在考虑做什么 <span>必填，保留否定词的原意</span>
                    <input
                      required
                      value={input.action}
                      maxLength={300}
                      onChange={(e) => update("action", e.target.value)}
                      placeholder="例如：去上课；或：不联系对方"
                    />
                  </label>
                )}
                <div className="form-row">
                  <label className="field">
                    预设场景 <span>可选</span>
                    <select
                      value={input.scene}
                      onChange={(e) => update("scene", e.target.value as Scene)}
                    >
                      {[
                        "无预设",
                        "上课安排",
                        "任务推进",
                        "休息安排",
                        "沟通联系",
                        "一般选择",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    目标日期
                    <input
                      type="date"
                      min="1901-01-01"
                      max="2099-12-31"
                      required
                      value={input.targetDate}
                      onChange={(e) => update("targetDate", e.target.value)}
                    />
                  </label>
                </div>
                {input.mode === "action" && (
                  <div className="action-scope">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={input.everydayOnly}
                        onChange={(e) =>
                          update("everydayOnly", e.target.checked)
                        }
                      />
                      这是一项普通日常安排，不涉及医疗、法律、投资或政治决策
                    </label>
                    <small>
                      {ADAPTED_ACTIONS[input.scene]
                        ? `本场景的首版适配行动：${ADAPTED_ACTIONS[input.scene]!.join("、")}。其他行动只作通用反思。`
                        : "本场景没有行动倾向规则，只提供象征解释与反思。"}
                    </small>
                  </div>
                )}
                <details className="time-settings">
                  <summary>
                    问卜时刻与时区 <span>{input.timezone}</span>
                  </summary>
                  <p>
                    问卜时刻在提交时捕获并冻结。梅花用这个时刻，数字命理用目标日期。
                  </p>
                  <label className="field">
                    时区（IANA 标识）
                    <input
                      list="timezones"
                      required
                      value={input.timezone}
                      onChange={(e) => update("timezone", e.target.value)}
                    />
                    <datalist id="timezones">
                      {[
                        "Asia/Shanghai",
                        "Asia/Singapore",
                        "Asia/Tokyo",
                        "Europe/London",
                        "America/New_York",
                        "America/Los_Angeles",
                        "Pacific/Auckland",
                        "UTC",
                      ].map((z) => (
                        <option key={z} value={z} />
                      ))}
                    </datalist>
                  </label>
                  <small>
                    默认浏览器检测；无效时区会让依赖时区的体系报告不可用。
                  </small>
                </details>
                <div className="form-divider" />
                <div className="form-heading">
                  <span className="step-number">02</span>
                  <div>
                    <h2>听听哪些占卜体系？</h2>
                    <p>各自独立生成结果，你可以逐一比较。</p>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      update(
                        "engines",
                        input.engines.length === 5 ? [] : [...ENGINE_IDS],
                      )
                    }
                  >
                    {input.engines.length === 5 ? "取消全选" : "全选"}
                  </button>
                </div>
                <div className="engine-picker">
                  {ENGINE_IDS.map((id) => (
                    <label
                      key={id}
                      className={input.engines.includes(id) ? "checked" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={input.engines.includes(id)}
                        onChange={() =>
                          update(
                            "engines",
                            input.engines.includes(id)
                              ? input.engines.filter((e) => e !== id)
                              : [...input.engines, id],
                          )
                        }
                      />
                      <span className="picker-icon" aria-hidden="true">
                        {ENGINES[id].icon}
                      </span>
                      <span>
                        <b>{ENGINES[id].name}</b>
                        <small>{ENGINES[id].description}</small>
                      </span>
                      <span className="picker-check" aria-hidden="true">
                        {input.engines.includes(id) ? "✓" : "○"}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="related-hint">
                  周易与梅花为相关体系，不是两份独立科学证据。
                </p>
                <div className="options-row">
                  {input.engines.includes("tarot") && (
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={input.reversals}
                        onChange={(e) => update("reversals", e.target.checked)}
                      />
                      塔罗启用逆位 <small>每张独立 50%</small>
                    </label>
                  )}
                  {input.engines.includes("numerology") && (
                    <label className="field birthday-field">
                      出生日期 <span>仅数字命理需要</span>
                      <input
                        type="date"
                        min="1901-01-01"
                        max={todayLocal()}
                        value={input.birthday}
                        onChange={(e) => update("birthday", e.target.value)}
                      />
                      <small>可不填；只跳过数字命理。生日不写入记录。</small>
                    </label>
                  )}
                </div>
                {formError && (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                )}
                <button className="primary submit-button" type="submit">
                  <span>开启这次探索</span>
                  <span>→</span>
                </button>
                <p className="submit-note">
                  一次提交，一份固定结果。只有“再问一次”才会创建新记录。
                </p>
              </form>
              <aside className="side-notes">
                <div className="perspectives-card">
                  <span className="section-kicker">不同的窗，同一个问题</span>
                  <div className="symbol-composition" aria-hidden="true">
                    <div className="tiny-card">
                      ✧<span>THE STAR</span>
                    </div>
                    <div className="tiny-hex">☷</div>
                    <div className="tiny-rune">ᚱ</div>
                    <span className="gold-spark">✦</span>
                  </div>
                  <h2>
                    不用急着找
                    <br />
                    唯一的答案。
                  </h2>
                  <p>塔罗看见处境，卦象展开变化，数字与符文带来另一种提醒。</p>
                  <p>可以偏爱一家，也可以只认同其中一句。不需要服从多数。</p>
                  <div className="aside-footer">五套体系 / 各自成篇</div>
                </div>
                <div className="privacy-note">
                  <span>⌁</span>
                  <h3>只在这里，只属于你</h3>
                  <p>
                    计算与解读均在浏览器本地完成。没有账户，没有模型调用，也没有后台上传。
                  </p>
                  <p>想回看时，再主动保存到本机。</p>
                </div>
                <div className="small-note">
                  <span>✦</span>
                  <p>{DISCLAIMER}</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>众卜 · 一个问题，多种视角。</span>
        <p>{DISCLAIMER}</p>
        <button onClick={() => setPage("library")}>来源与算法约定 ↗</button>
      </footer>
    </>
  );
}
