import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = join(root, ".wrangler", "advice-evaluation");
const HELP = `Local generation (no network or key):
  node scripts/evaluate-advice.mjs generate --run school-check
  node scripts/evaluate-advice.mjs generate --run school-action --mode action --scene 上课安排 --question "我明天可以翘课嘛？" --option "明天去上课" --option "明天不去上课"
Paid public-endpoint sampling (explicit opt-in; never reads a key):
  node scripts/evaluate-advice.mjs sample --send --run school-check --phase baseline --endpoint https://zhongbu.pages.dev/api/interpret --origin https://zhongbu.pages.dev --expect-prompt VERSION
  node scripts/evaluate-advice.mjs sample --send --run school-check --phase updated --endpoint https://zhongbu.pages.dev/api/interpret --origin https://zhongbu.pages.dev --expect-prompt VERSION
  node scripts/evaluate-advice.mjs sample --send --run school-check --phase updated-diagnostic --group diagnostic --endpoint https://zhongbu.pages.dev/api/interpret --origin https://zhongbu.pages.dev
Reports (no network):
  node scripts/evaluate-advice.mjs report --run school-check
Options: --date YYYY-MM-DD (default tomorrow in --timezone Asia/Shanghai),
  --mode explore|action, --scene 无预设|上课安排|任务推进|休息安排|沟通联系|一般选择,
  repeated --option (2–10 for action); --interval-ms >=12000; --group random|diagnostic|all.
Existing fixtures are never overwritten. Resume a phase by repeating exactly its command.
Already attempted samples (including HTTP/network failures and interrupted requests) are never retried.
Random and constructed diagnostic results are always reported separately.`;

function parseArgs(argv) {
  const [command = "help", ...tokens] = argv;
  const flags = {};
  const allowed = new Set([
    "run",
    "question",
    "mode",
    "scene",
    "option",
    "date",
    "timezone",
    "phase",
    "endpoint",
    "origin",
    "expect-prompt",
    "interval-ms",
    "group",
    "send",
  ]);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--") || !allowed.has(token.slice(2)))
      throw Error(`Unknown argument: ${token}`);
    const name = token.slice(2);
    if (name === "send") {
      flags.send = true;
      continue;
    }
    const value = tokens[++i];
    if (value === undefined || value.startsWith("--"))
      throw Error(`Missing value for ${token}`);
    if (name === "option") (flags.option ??= []).push(value);
    else if (name in flags) throw Error(`Duplicate argument: ${token}`);
    else flags[name] = value;
  }
  return { command, flags };
}
function safeName(value, label) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value ?? ""))
    throw Error(
      `${label} requires a lower-case alphanumeric/hyphen name (1–80 characters).`,
    );
  return value;
}
function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}
function tomorrow(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type).value;
  const date = new Date(
    `${part("year")}-${part("month")}-${part("day")}T00:00:00Z`,
  );
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function validDate(value) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw Error("Invalid calendar date.");
  return value;
}
async function generate(flags) {
  const run = safeName(flags.run, "--run");
  const folder = join(outputRoot, run);
  await mkdir(folder, { recursive: true });
  const path = join(folder, "fixtures.json");
  // Reserve the run before using randomness; no accidental reroll over old data.
  const reservation = await open(path, "wx").catch((error) => {
    if (error.code === "EEXIST")
      throw Error(
        `Frozen fixtures already exist: ${path}. Reuse this run; do not regenerate between prompt versions.`,
      );
    throw error;
  });
  try {
    const timezone = flags.timezone ?? "Asia/Shanghai";
    const input = {
      question: flags.question ?? "我明天可以翘课嘛？",
      mode: flags.mode ?? "explore",
      scene: flags.scene ?? "无预设",
      action: "",
      targetDate: validDate(flags.date ?? tomorrow(timezone)),
      timezone,
      engines: ["tarot"],
      reversals: true,
      everydayOnly: true,
      ...(flags.option ? { options: flags.option } : {}),
    };
    new Intl.DateTimeFormat("zh-CN", { timeZone: timezone }).format(new Date());
    if (!["explore", "action"].includes(input.mode))
      throw Error("Invalid mode.");
    if (
      input.mode === "action" &&
      (!input.options || input.options.length < 2 || input.options.length > 10)
    )
      throw Error("Action mode requires 2–10 --option values.");
    if (input.mode === "explore" && input.options)
      throw Error(
        "Explore mode must not supply options; use --mode action to preserve them.",
      );
    const { rolldown } = await import("rolldown");
    const bundle = await rolldown({
      input: join(root, "scripts", "advice-fixtures.ts"),
      platform: "node",
      transform: { define: { "import.meta.env": "{}" } },
      plugins: [
        {
          name: "offline-fixture-style-stubs",
          load(id) {
            if (id.endsWith(".css"))
              return {
                code: "export {};",
                moduleType: "js",
                moduleSideEffects: false,
              };
          },
        },
      ],
    });
    const bundlePath = join(folder, "generator.mjs");
    try {
      await bundle.write({ file: bundlePath, format: "es" });
    } finally {
      await bundle.close();
    }
    const { generateFixtures } = await import(pathToFileURL(bundlePath).href);
    const generatedAt = new Date().toISOString();
    const fixtures = generateFixtures(input, generatedAt);
    let sourceCommit = "unknown";
    try {
      sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      /* Source tree may be an exported archive. */
    }
    const document = {
      schemaVersion: 1,
      run,
      generatedAt,
      sourceCommit,
      input,
      randomMethod:
        "Production drawTarot: complete 78-card deck, partial Fisher–Yates without replacement; independent fair reversals; Web Crypto uint32 rejection sampling. Ten consecutive unfiltered draws, no replacement based on output.",
      fixturesSha256: sha(JSON.stringify(fixtures)),
      fixtures,
    };
    await reservation.writeFile(
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8",
    );
    console.log(
      JSON.stringify({
        run,
        path,
        randomSamples: 10,
        diagnosticSamples: 2,
        fixturesSha256: document.fixturesSha256,
        paidRequests: 0,
      }),
    );
  } catch (error) {
    await reservation.close();
    await unlink(path);
    throw error;
  }
  await reservation.close();
}
async function loadDocument(flags) {
  const folder = join(outputRoot, safeName(flags.run, "--run"));
  const document = await readJson(join(folder, "fixtures.json"));
  if (
    document.schemaVersion !== 1 ||
    sha(JSON.stringify(document.fixtures)) !== document.fixturesSha256
  )
    throw Error(
      "Fixture integrity check failed; never regenerate to hide a changed sample.",
    );
  return { folder, document };
}
function publicUrl(value, kind) {
  if (!value) throw Error(`--${kind} is required.`);
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error(
      `${kind} must be an explicit HTTPS URL without credentials, query or fragment.`,
    );
  if (kind === "origin" && url.pathname !== "/")
    throw Error("Origin must not contain a path.");
  return kind === "origin" ? url.origin : url.href;
}
async function sample(flags) {
  if (!flags.send)
    throw Error(
      "No requests sent. Sampling requires the explicit --send flag and may consume model quota.",
    );
  const { folder, document } = await loadDocument(flags);
  const phase = safeName(flags.phase, "--phase");
  const endpoint = publicUrl(flags.endpoint, "endpoint");
  const origin = publicUrl(flags.origin, "origin");
  const intervalMs = Number(flags["interval-ms"] ?? 12000);
  if (!Number.isFinite(intervalMs) || intervalMs < 12000)
    throw Error(
      "Use an interval of at least 12000 ms; this tool does not bypass public endpoint limits.",
    );
  const group = flags.group ?? "random";
  if (!["random", "diagnostic", "all"].includes(group))
    throw Error("Invalid group.");
  const expectedPrompt = flags["expect-prompt"] ?? null;
  const resultPath = join(folder, `${phase}.json`);
  const config = {
    run: document.run,
    phase,
    endpoint,
    origin,
    group,
    expectedPrompt,
    intervalMs,
    fixturesSha256: document.fixturesSha256,
  };
  let record;
  try {
    record = await readJson(resultPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    record = { schemaVersion: 1, config, attempts: [] };
  }
  if (JSON.stringify(record.config) !== JSON.stringify(config))
    throw Error(
      "Resume configuration differs from the stored phase; do not mix endpoints, fixtures or prompt versions.",
    );
  const lockPath = join(outputRoot, ".sampling.lock");
  const lock = await open(lockPath, "wx").catch((error) => {
    if (error.code === "EEXIST")
      throw Error(
        `Another sampler may be active (${lockPath}). If a process was forcibly killed, verify it stopped before manually removing this lock.`,
      );
    throw error;
  });
  await lock.writeFile(
    JSON.stringify({
      pid: process.pid,
      run: document.run,
      phase,
      createdAt: new Date().toISOString(),
    }),
  );
  const cadencePath = join(outputRoot, "last-request.json");
  let stopped = false;
  let controller;
  const stop = () => {
    stopped = true;
    controller?.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const fixtures = document.fixtures.filter(
      (fixture) => group === "all" || fixture.group === group,
    );
    for (const fixture of fixtures) {
      if (record.attempts.some((attempt) => attempt.id === fixture.id))
        continue;
      if (stopped) break;
      let lastStartedAt = 0;
      try {
        lastStartedAt = (await readJson(cadencePath)).startedAt;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const waitMs = Math.max(0, intervalMs - (Date.now() - lastStartedAt));
      // One-second slices make Ctrl+C responsive without creating new requests.
      for (let remaining = waitMs; remaining > 0 && !stopped; remaining -= 1000)
        await delay(Math.min(1000, remaining));
      if (stopped) break;
      const startedAt = Date.now();
      const attempt = {
        id: fixture.id,
        group: fixture.group,
        startedAt: new Date(startedAt).toISOString(),
        requestSha256: sha(JSON.stringify(fixture.request)),
        status: "in-flight",
      };
      record.attempts.push(attempt);
      await atomicJson(resultPath, record);
      await atomicJson(cadencePath, { startedAt });
      controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 40000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(fixture.request),
          signal: controller.signal,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
        });
        attempt.httpStatus = response.status;
        attempt.responseHeaders = {
          contentType: response.headers.get("content-type"),
          retryAfter: response.headers.get("retry-after"),
          cfRay: response.headers.get("cf-ray"),
        };
        attempt.rawResponse = await response.text();
        try {
          attempt.response = JSON.parse(attempt.rawResponse);
        } catch {
          /* Preserve non-JSON responses as received. */
        }
        attempt.model = attempt.response?.model ?? null;
        attempt.promptVersion = attempt.response?.promptVersion ?? null;
        attempt.status = response.ok ? "http-success" : "http-error";
        if (
          response.ok &&
          (typeof attempt.response?.text !== "string" ||
            !attempt.model ||
            !attempt.promptVersion)
        )
          attempt.status = "invalid-response";
        if (
          response.ok &&
          expectedPrompt &&
          attempt.promptVersion !== expectedPrompt
        )
          attempt.status = "unexpected-prompt-version";
        if (
          response.status === 429 ||
          attempt.status === "unexpected-prompt-version"
        )
          stopped = true;
      } catch (error) {
        attempt.status = stopped
          ? "cancelled"
          : timedOut
            ? "timeout"
            : "network-error";
        attempt.error = { name: error.name, message: error.message };
      } finally {
        clearTimeout(timeout);
        controller = undefined;
        attempt.elapsedMs = Date.now() - startedAt;
        attempt.finishedAt = new Date().toISOString();
        await atomicJson(resultPath, record);
      }
      console.log(
        JSON.stringify({
          id: attempt.id,
          status: attempt.status,
          httpStatus: attempt.httpStatus ?? null,
          model: attempt.model ?? null,
          promptVersion: attempt.promptVersion ?? null,
          elapsedMs: attempt.elapsedMs,
        }),
      );
    }
    console.log(
      JSON.stringify({
        resultPath,
        attempted: record.attempts.length,
        planned: fixtures.length,
        stopped,
        note: "All attempts retained; no retries or output filtering.",
      }),
    );
    if (
      record.attempts.some((attempt) => attempt.status !== "http-success") ||
      record.attempts.length !== fixtures.length
    )
      process.exitCode = 1;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await lock.close();
    await unlink(lockPath);
  }
}
async function report(flags) {
  const { folder, document } = await loadDocument(flags);
  const { readdir } = await import("node:fs/promises");
  const phases = [];
  for (const name of (await readdir(folder))
    .filter((name) => name.endsWith(".json") && name !== "fixtures.json")
    .sort()) {
    const record = await readJson(join(folder, name));
    if (!record.config || !Array.isArray(record.attempts)) continue;
    const groups = ["random", "diagnostic"].map((group) => {
      const attempts = record.attempts.filter(
        (attempt) => attempt.group === group,
      );
      return {
        group,
        planned: document.fixtures.filter(
          (fixture) =>
            fixture.group === group &&
            (record.config.group === "all" || record.config.group === group),
        ).length,
        attempts: attempts.length,
        statuses: Object.fromEntries(
          [...new Set(attempts.map((attempt) => attempt.status))].map(
            (status) => [
              status,
              attempts.filter((attempt) => attempt.status === status).length,
            ],
          ),
        ),
        models: [
          ...new Set(attempts.map((attempt) => attempt.model).filter(Boolean)),
        ],
        promptVersions: [
          ...new Set(
            attempts.map((attempt) => attempt.promptVersion).filter(Boolean),
          ),
        ],
      };
    });
    phases.push({
      phase: record.config.phase,
      fixturesMatch: record.config.fixturesSha256 === document.fixturesSha256,
      groups,
    });
  }
  console.log(
    JSON.stringify(
      {
        run: document.run,
        input: document.input,
        fixturesSha256: document.fixturesSha256,
        phases,
        review:
          "Read every original response beside its frozen cards and full question. No automatic yes/no keyword scoring, quota target, majority requirement or accuracy claim.",
      },
      null,
      2,
    ),
  );
}

try {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "help") console.log(HELP);
  else if (command === "generate") await generate(flags);
  else if (command === "sample") await sample(flags);
  else if (command === "report") await report(flags);
  else throw Error(`Unknown command: ${command}\n${HELP}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
