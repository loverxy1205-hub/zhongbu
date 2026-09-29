import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_REQUEST_TIMEOUT_MS,
  buildAiRequest,
  requestAi,
} from "../src/lib/ai";
import { createReading } from "../src/engines/reading";
import { interpret } from "../src/rules/interpret";
import { defaultPreferences } from "../src/lib/storage";
import type { AiResponse } from "../shared/ai-contract";
import type { EngineId, Input, TarotRaw, RuneRaw } from "../src/types";

const engines: EngineId[] = [
  "tarot",
  "iching",
  "meihua",
  "numerology",
  "runes",
];
const instant = "2026-09-29T04:37:19.123Z";
const input: Input = {
  question: "私人问题：暂时不联系，可以如何理解自己的边界？",
  category: "人际",
  mode: "action",
  scene: "沟通联系",
  action: "",
  options: ["不联系", "联系"],
  targetDate: "2026-09-29",
  timezone: "Asia/Shanghai",
  engines,
  birthday: "1998-06-15",
  reversals: true,
  everydayOnly: true,
};
function reading(overrides: Partial<Input> = {}) {
  let seed = 17;
  return createReading({ ...input, ...overrides }, instant, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  });
}
function legacyReading() {
  const source = structuredClone(reading());
  source.input.category = "人际";
  source.input.action = "不联系";
  delete source.input.options;
  // A restored pre-v1.2 snapshot already contains its frozen reflection text.
  for (const result of source.results)
    if (result.interpretation)
      result.interpretation.reflection = result.interpretation.reflection.map(
        (paragraph) => ({
          ...paragraph,
          text: "原记录关于「不联系」的冻结反思。",
        }),
      );
  return source;
}
const response: AiResponse = {
  text: "这组象征可以成为观察边界的一个角度。你可以保留自己的理解，结合真实经历慢慢思考。",
  model: "deepseek-chat",
  promptVersion: "zhongbu-ai-v1",
  generatedAt: "2026-09-29T04:38:00.000Z",
};

describe("single-engine AI request privacy", () => {
  it.each(engines)(
    "%s request is identical after all other results, previous AI advice and preferences change",
    (engine) => {
      const source = structuredClone(reading());
      const expected = buildAiRequest(source, engine);
      const modified = structuredClone(source);
      const selected = modified.results.find(
        (result) => result.engine === engine,
      )!;
      // Neither previous model outputs nor presentation metadata are evidence.
      Object.assign(selected, {
        enhancement: "PRIVATE_PREVIOUS_SELECTED_ADVICE",
      });
      Object.assign(modified, {
        preferences: { pinned: [engine], liked: [engine], included: [] },
        enhancements: Object.fromEntries(
          engines.map((other) => [
            other,
            {
              response: { text: `PRIVATE_PREVIOUS_ADVICE_${other}` },
            },
          ]),
        ),
      });
      modified.input.engines = [engine];
      modified.results = [
        selected,
        ...modified.results
          .filter((result) => result.engine !== engine)
          .reverse()
          .map((result) => ({
            ...result,
            raw: {
              kind: "runes" as const,
              runes: [{ id: "PRIVATE_OTHER_RAW", position: "提示" as const }],
            },
            interpretation: {
              ...result.interpretation!,
              headline: "PRIVATE_OTHER_HEADLINE",
              paragraphs: [
                {
                  label: "PRIVATE_OTHER_POSITION",
                  text: "PRIVATE_OTHER_ADVICE",
                  knowledgeId: "",
                  ruleId: "",
                  templateId: "",
                },
              ],
            },
          })),
      ];
      const before = JSON.stringify(modified);
      expect(buildAiRequest(modified, engine)).toEqual(expected);
      expect(JSON.stringify(modified)).toBe(before);
      // Deleting the other systems also has no influence.
      modified.results = [selected];
      expect(buildAiRequest(modified, engine)).toEqual(expected);
    },
  );

  it("preserves tarot positions and reversals that can change the advice while keeping the question identical", () => {
    const source = structuredClone(reading());
    const selected = source.results.find(
      (result) => result.engine === "tarot",
    )!;
    const raw: TarotRaw = {
      kind: "tarot",
      cards: [
        { id: "tarot-major-1", position: "现状", reversed: false },
        { id: "tarot-major-7", position: "阻力", reversed: false },
        { id: "tarot-major-9", position: "提示", reversed: false },
      ],
    };
    selected.raw = raw;
    selected.interpretation = interpret(raw, source.input);
    const upright = buildAiRequest(source, "tarot");
    raw.cards[1].reversed = true;
    selected.interpretation = interpret(raw, source.input);
    const reversed = buildAiRequest(source, "tarot");
    expect(reversed.context).toEqual(upright.context);
    expect(upright.evidence.rawSummary).toContain("阻力：战车（正位）");
    expect(reversed.evidence.rawSummary).toContain("阻力：战车（逆位）");
    expect(reversed.evidence.paragraphs[1]).not.toEqual(
      upright.evidence.paragraphs[1],
    );
    expect(reversed.evidence.paragraphs[0]).toEqual(
      upright.evidence.paragraphs[0],
    );
    expect(reversed.evidence.paragraphs[2]).toEqual(
      upright.evidence.paragraphs[2],
    );
  });

  it("preserves rune role changes even when the three symbols and broad themes are identical", () => {
    const source = structuredClone(reading());
    const selected = source.results.find(
      (result) => result.engine === "runes",
    )!;
    const raw: RuneRaw = {
      kind: "runes",
      runes: [
        { id: "rune-1", position: "现状" },
        { id: "rune-11", position: "阻力" },
        { id: "rune-5", position: "提示" },
      ],
    };
    selected.raw = raw;
    selected.interpretation = interpret(raw, source.input);
    const move = buildAiRequest(source, "runes");
    raw.runes[1].id = "rune-5";
    raw.runes[2].id = "rune-11";
    selected.interpretation = interpret(raw, source.input);
    const pause = buildAiRequest(source, "runes");
    expect(pause.context).toEqual(move.context);
    expect([...pause.evidence.themes].sort()).toEqual(
      [...move.evidence.themes].sort(),
    );
    expect(pause.evidence.rawSummary).not.toBe(move.evidence.rawSummary);
    expect(pause.evidence.paragraphs[0]).toEqual(move.evidence.paragraphs[0]);
    expect(pause.evidence.paragraphs.slice(1)).not.toEqual(
      move.evidence.paragraphs.slice(1),
    );
    expect(pause.evidence.paragraphs.map(({ label }) => label)).toEqual(
      selected.interpretation.paragraphs.map(({ label }) => label),
    );
  });

  it.each(engines)("%s only sends the documented allowlist", (engine) => {
    const source = structuredClone(reading());
    // Unexpected restored metadata must never broaden the outbound payload.
    Object.assign(source.input, { birthday: input.birthday });
    Object.assign(source, { preferences: defaultPreferences(source) });
    for (const result of source.results) {
      if (result.engine !== engine && result.interpretation)
        result.interpretation.headline = `OTHER_ENGINE_PRIVATE_${result.engine}`;
    }
    const before = JSON.stringify(source);
    const request = buildAiRequest(source, engine, false);
    const serialized = JSON.stringify(request);
    expect(Object.keys(request).sort()).toEqual([
      "context",
      "engine",
      "evidence",
      "readingId",
    ]);
    expect(Object.keys(request.context).sort()).toEqual([
      "mode",
      "scene",
      "targetDate",
    ]);
    expect(Object.keys(request.evidence).sort()).toEqual([
      "headline",
      "methodVersion",
      "paragraphs",
      "rawSummary",
      "reflection",
      "themes",
      "traditional",
    ]);
    expect(request.engine).toBe(engine);
    expect(request.readingId).toBe(source.readingId);
    expect(request.evidence.headline).toBe(
      source.results.find((result) => result.engine === engine)!.interpretation!
        .headline,
    );
    expect(request.evidence.rawSummary.length).toBeGreaterThan(5);
    for (const forbidden of [
      input.birthday,
      instant,
      input.timezone,
      "04:37",
      "OTHER_ENGINE_PRIVATE_",
    ])
      expect(serialized).not.toContain(forbidden);
    for (const field of [
      "birthday",
      "askedAt",
      "timezone",
      "preferences",
      "liked",
      "pinned",
      "favorites",
      "included",
      "results",
      "trace",
      "lunar",
      "local",
    ])
      expect(serialized).not.toContain(`"${field}":`);
    for (const paragraph of [
      ...request.evidence.paragraphs,
      ...request.evidence.traditional,
    ])
      expect(Object.keys(paragraph).sort()).toEqual(["label", "text"]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each(engines)(
    "%s omits free text even when action is embedded in reflections",
    (engine) => {
      const source = legacyReading();
      expect(
        source.results
          .find((r) => r.engine === engine)!
          .interpretation!.reflection.some((p) =>
            p.text.includes(source.input.action),
          ),
      ).toBe(true);
      const request = buildAiRequest(source, engine, false);
      expect(request.context).not.toHaveProperty("question");
      expect(request.context).not.toHaveProperty("action");
      expect(request.context).not.toHaveProperty("options");
      expect(request.evidence.reflection).toEqual([]);
      expect(JSON.stringify(request)).not.toContain(input.question);
      expect(JSON.stringify(request)).not.toContain(source.input.action);
    },
  );

  it.each(engines)(
    "%s includes the exact question and legacy negated action by default",
    (engine) => {
      const source = legacyReading();
      const request = buildAiRequest(source, engine);
      expect(request.context.question).toBe(input.question);
      expect(request.context.action).toBe("不联系");
      expect(request.context).not.toHaveProperty("category");
      expect(request.evidence.reflection).toEqual([]);
      expect(JSON.stringify(request)).not.toContain(input.birthday);
      expect(JSON.stringify(request)).not.toContain(instant);
    },
  );

  it.each(engines)(
    "%s sends every action option in original order without changing negation",
    (engine) => {
      const options = [
        "今天不联系对方，先整理自己的想法",
        "今天联系对方，但不谈尚未确认的消息",
        "明天只发一句问候",
        "先不决定，等对方回复后再选",
      ];
      const source = reading({ action: "", options });
      const before = JSON.stringify(source);
      const request = buildAiRequest(source, engine);
      expect(request.context.options).toEqual(options);
      expect(request.context.options).not.toBe(source.input.options);
      expect(request.context.question).toBe(input.question);
      expect(request.context.action).toBe("");
      expect(request.context).not.toHaveProperty("category");
      expect(JSON.stringify(request)).not.toContain(input.birthday);
      expect(JSON.stringify(request)).not.toContain(instant);
      expect(JSON.stringify(source)).toBe(before);
      // Option comparison uses the one existing result, not another draw.
      expect(request.evidence.rawSummary).toBe(
        buildAiRequest(reading(), engine).evidence.rawSummary,
      );
      const withoutContext = buildAiRequest(source, engine, false);
      expect(withoutContext.context).not.toHaveProperty("question");
      expect(withoutContext.context).not.toHaveProperty("action");
      expect(withoutContext.context).not.toHaveProperty("options");
      expect(withoutContext.evidence.reflection).toEqual([]);
      for (const text of [input.question, ...options])
        expect(JSON.stringify(withoutContext)).not.toContain(text);
    },
  );

  it("does not send dormant action options with an exploration question", () => {
    const source = structuredClone(reading({ mode: "explore", action: "" }));
    source.input.options = [
      "PRIVATE_DORMANT_OPTION_A",
      "PRIVATE_DORMANT_OPTION_B",
    ];
    const request = buildAiRequest(source, "tarot");
    expect(request.context.question).toBe(input.question);
    expect(request.context).not.toHaveProperty("options");
    expect(JSON.stringify(request)).not.toContain("PRIVATE_DORMANT_OPTION");
  });

  it.each(["明天可以翘课吗？", "我明天可以翘课嘛？", "我可以不去上学吗？"])(
    "preserves the original exploration question and target day without inferring an attendance action: %s",
    (question) => {
      const source = reading({
        question,
        mode: "explore",
        scene: "无预设",
        action: "",
        options: undefined,
        targetDate: "2026-10-01",
      });
      const request = buildAiRequest(source, "tarot");
      expect(request.context).toEqual({
        question,
        mode: "explore",
        scene: "无预设",
        action: "",
        targetDate: "2026-10-01",
      });
      const reworded = structuredClone(source);
      reworded.input.question = "关于这一天的普通安排";
      expect(buildAiRequest(reworded, "tarot").evidence).toEqual(
        request.evidence,
      );
      expect(request.context).not.toHaveProperty("options");
      expect(JSON.stringify(request)).not.toContain(input.birthday);
    },
  );

  it("rejects missing or unavailable engine results", () => {
    const source = structuredClone(reading());
    source.results = source.results.filter((r) => r.engine !== "tarot");
    expect(() => buildAiRequest(source, "tarot", false)).toThrow(
      "尚无可延伸的结果",
    );
    source.results[0].status = "unavailable";
    expect(() =>
      buildAiRequest(source, source.results[0].engine, false),
    ).toThrow("尚无可延伸的结果");
  });
});

describe("AI transport", () => {
  const endpoint = "https://proxy.example.test/interpret";
  const request = buildAiRequest(reading(), "tarot", false);
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts only the selected request without cookies and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(response));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    expect(await requestAi(request, controller.signal, endpoint)).toEqual(
      response,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not fetch when the endpoint is absent or the browser is offline", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      requestAi(request, new AbortController().signal, ""),
    ).rejects.toThrow("暂未开通");
    vi.stubGlobal("navigator", { onLine: false });
    await expect(
      requestAi(request, new AbortController().signal, endpoint),
    ).rejects.toThrow("当前离线");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates cancellation to the in-flight fetch and reports it distinctly", async () => {
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            fetchSignal = init.signal!;
            fetchSignal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );
    const controller = new AbortController();
    const pending = requestAi(request, controller.signal, endpoint);
    const rejected = expect(pending).rejects.toThrow("已取消");
    controller.abort();
    await rejected;
    expect(fetchSignal?.aborted).toBe(true);
  });

  it("reports network failures without exposing transport details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("sensitive transport details")),
    );
    await expect(
      requestAi(request, new AbortController().signal, endpoint),
    ).rejects.toThrow("暂时没有连接上解读服务");
  });

  it("works without AbortSignal.any or AbortSignal.timeout on older mobile browsers", async () => {
    const descriptors = Object.getOwnPropertyDescriptors(AbortSignal);
    Object.defineProperty(AbortSignal, "any", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
    try {
      await expect(
        requestAi(request, new AbortController().signal, endpoint),
      ).resolves.toEqual(response);
    } finally {
      Object.defineProperties(AbortSignal, descriptors);
    }
  });

  it("does not start a request that was already cancelled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestAi(request, controller.signal, endpoint),
    ).rejects.toThrow("已取消");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ends a stalled mobile connection at the deadline without automatic retries", async () => {
    vi.useFakeTimers();
    let received: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      received = init.signal;
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);
    const pending = requestAi(request, new AbortController().signal, endpoint);
    const rejected = expect(pending).rejects.toThrow("连接等待超时");
    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(received?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the deadline active until a slow response body is read", async () => {
    vi.useFakeTimers();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    const pending = requestAi(request, new AbortController().signal, endpoint);
    const rejected = expect(pending).rejects.toThrow("连接等待超时");
    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS);
    await rejected;
    streamController.error(new Error("test body stopped"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up its deadline and caller listener after success", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await requestAi(request, controller.signal, endpoint);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it.each([
    [429, "一分钟后再试"],
    [503, "暂未就绪"],
    [504, "响应超时"],
    [500, "请稍后重试"],
  ])("reports HTTP %s as a retryable failure", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private upstream error", { status: Number(status) }),
        ),
    );
    await expect(
      requestAi(request, new AbortController().signal, endpoint),
    ).rejects.toThrow(String(message));
  });

  it.each([
    {},
    { ...response, text: "" },
    { ...response, generatedAt: "not a date" },
    { ...response, model: 123 },
    { ...response, promptVersion: undefined },
  ])(
    "rejects a successful HTTP response with invalid response fields: %j",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
      await expect(
        requestAi(request, new AbortController().signal, endpoint),
      ).rejects.toThrow("无法识别的内容");
    },
  );

  it("reports a non-JSON success body as an invalid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>not JSON</html>")),
    );
    await expect(
      requestAi(request, new AbortController().signal, endpoint),
    ).rejects.toThrow("无法识别的内容");
  });
});
