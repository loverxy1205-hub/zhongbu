import { expect, it } from "vitest";
import pages from "../docs/sources/wikisource-pages.json";
import { HEXAGRAMS } from "../src/data/hexagrams";
it("all 64 upper/lower pairs agree with the independent original-source headings", () => {
  for (const h of HEXAGRAMS) {
    const p = pages.find((p) => p.title === `周易/${h.name}`)!;
    const text = p.revisions[0].slots.main.content
      .replace(/-\{([^{}]*)\}-/g, "$1")
      .replace(/'/g, "");
    const m = text.match(
      /([乾坤震巽坎離艮兌兑离])下([乾坤震巽坎離艮兌兑离])上/,
    );
    expect(m, `${h.name} source heading`).not.toBeNull();
    const normalized = (s: string) => s.replace("離", "离").replace("兌", "兑");
    expect(h.lower).toBe(normalized(m![1]));
    expect(h.upper).toBe(normalized(m![2]));
  }
});
