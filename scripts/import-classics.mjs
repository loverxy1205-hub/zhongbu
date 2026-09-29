// Development-only importer. The running website never calls these endpoints.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const root = JSON.parse(await readFile("docs/sources/wiki.json", "utf8")).parse
  .wikitext["*"];
const ordered = root
  .slice(root.indexOf("== 上下經卦名次序"))
  .split("== 分宮")[0];
const names = [...ordered.matchAll(/\[\[\/([^|]+)\|/g)].map((m) => m[1]);
if (names.length !== 64) throw Error(`Expected 64 names, got ${names.length}`);
let pages = [];
try {
  pages = JSON.parse(
    await readFile("docs/sources/wikisource-pages.json", "utf8"),
  );
} catch {
  /* first import */
}
for (let i = 0; pages.length < 64 && i < names.length; i += 32) {
  const url = new URL("https://zh.wikisource.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "ids|timestamp|content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
    titles: names
      .slice(i, i + 32)
      .map((n) => `周易/${n}`)
      .join("|"),
  });
  const data =
    process.platform === "win32"
      ? JSON.parse(
          execFileSync(
            "powershell",
            [
              "-NoProfile",
              "-Command",
              `(Invoke-WebRequest -UseBasicParsing '${url.href}').Content`,
            ],
            { encoding: "utf8", maxBuffer: 10_000_000 },
          ),
        )
      : await (await fetch(url)).json();
  if (!data.query) throw Error(JSON.stringify(data));
  pages.push(...data.query.pages);
}
await writeFile(
  "docs/sources/wikisource-pages.json",
  JSON.stringify(pages, null, 2),
);
const clean = (s) =>
  s
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/-\{([^{}]*)\}-/g, "$1")
    .replace(/'{2,3}/g, "")
    .replace(/\{\{另\|[^|]*\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[([^|\]]*\|)?([^\]]+)\]\]/g, "$2")
    .replace(/^[*#:;]+/, "")
    .trim();
const entries = names.map((name, i) => {
  const p = pages.find((p) => p.title === `周易/${name}`);
  const raw = p?.revisions?.[0]?.slots?.main?.content;
  if (!raw) throw Error(`Missing ${name}`);
  // Keep the 经 text only, not 彖/象/文言 commentaries.
  const blue = raw
    .split("\n")
    .filter((s) => s.includes('<span style="color:blue">'))
    .map(clean)
    .filter((s) => s !== "易經：");
  const yaoci = blue.filter((s) =>
    /^(初[九六]|[九六][二三四五]|上[九六])[：，、]/.test(s),
  );
  if (yaoci.length !== 6)
    throw Error(`${name}: ${yaoci.length} lines; ${JSON.stringify(blue)}`);
  return {
    number: i + 1,
    name,
    guaci: blue[0],
    yaoci,
    extra: blue.filter((s) => /^用[九六]/.test(s)),
    source: `https://zh.wikisource.org/w/index.php?oldid=${p.revisions[0].revid}`,
    revision: p.revisions[0].revid,
  };
});
await writeFile(
  "src/data/classics.json",
  JSON.stringify(entries, null, 2) + "\n",
);
console.log(
  `Imported ${entries.length} judgments, ${entries.reduce((n, e) => n + e.yaoci.length, 0)} lines; revision URLs recorded.`,
);
