// Owner-only local administration through Wrangler's existing authenticated CLI.
// Never bundled into the website; there is no public feedback-read API.
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [operation, receiptId] = process.argv.slice(2);
let sql;
if (operation === "list") {
  sql =
    "SELECT id, received_at, kind, message, question, engine, app_version FROM feedback ORDER BY received_at DESC LIMIT 100";
} else if (operation === "export") {
  sql =
    "SELECT id, received_at, kind, message, question, engine, app_version FROM feedback ORDER BY received_at DESC";
} else if (
  operation === "delete" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    receiptId ?? "",
  )
) {
  sql = `DELETE FROM feedback WHERE id = '${receiptId}'`;
} else if (operation === "clear" && receiptId === "--confirm") {
  sql = "DELETE FROM feedback";
} else {
  console.error(
    "用法：node worker/scripts/feedback.mjs list | export | delete <回执UUID> | clear --confirm",
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1",
    "execute",
    "FEEDBACK_DB",
    "--remote",
    "--config",
    "worker/wrangler.jsonc",
    "--json",
    "--command",
    sql,
  ],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
if (operation === "export") {
  // A fixed gitignored directory prevents accidentally publishing feedback.
  const directory = path.join(root, ".wrangler", "private-feedback");
  await mkdir(directory, { recursive: true });
  const target = path.join(
    directory,
    `feedback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await writeFile(target, JSON.stringify(JSON.parse(result.stdout), null, 2), {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`已导出到本机私有文件：${target}`);
} else {
  process.stdout.write(result.stdout);
}
