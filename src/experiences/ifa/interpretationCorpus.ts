/** Only independently checked, reusable traditional material may enter here. */
export interface IfaCorpusEntry {
  id: string;
  signatureId: string;
  language: string;
  source: string;
  locator: string;
  permission: string;
  usage: "verbatim" | "summary";
  checked: true;
  text: string;
}

// Full symbol coverage is not textual coverage. No unlicensed verses, invented
// Yorùbá poetry, two-column theme addition, sacrifices, taboos or iré/ìbì guesses.
export const interpretationCorpus: readonly IfaCorpusEntry[] = [];
export const IFA_CORPUS_VERSION = "ifa-corpus-empty-1";
export const MISSING_IFA_TEXT = "符号已生成，本版本尚无该项经核对的文本解读。";
