import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { feedbackRequestSchema } from "../shared/feedback-contract";
it("extends feedback engine constraint while preserving every existing field and the expiry index", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync("worker/migrations/0001_feedback.sql", "utf8"));
    db.prepare("INSERT INTO feedback VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "synthetic-old",
      "2026-09-30T00:00:00.000Z",
      "建议",
      "合成反馈保留验证",
      "明确选择附带的问题",
      "tarot",
      "1.6.1",
    );
    const before = db.prepare("SELECT * FROM feedback").all();
    db.exec("BEGIN");
    db.exec(
      readFileSync("worker/migrations/0002_feedback_experiences.sql", "utf8"),
    );
    db.exec("COMMIT");
    expect(db.prepare("SELECT * FROM feedback").all()).toEqual(before);
    for (const engine of ["geomancy", "coffee", "ifa", "jiaobei", "oracle"]) {
      const body = { kind: "建议", message: "新增体验反馈测试", engine };
      expect(feedbackRequestSchema.safeParse(body).success).toBe(true);
      db.prepare(
        "INSERT INTO feedback (id,received_at,kind,message,engine) VALUES (?,?,?,?,?)",
      ).run(
        engine,
        "2026-09-30T00:00:00.000Z",
        body.kind,
        body.message,
        engine,
      );
    }
    expect(
      db.prepare("SELECT COUNT(*) AS total FROM feedback").get()?.total,
    ).toBe(6);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='feedback_received_at'",
        )
        .get(),
    ).toBeTruthy();
    expect(() =>
      db
        .prepare(
          "INSERT INTO feedback (id,received_at,kind,message,engine) VALUES (?,?,?,?,?)",
        )
        .run(
          "bad",
          "2026-09-30T00:00:00.000Z",
          "建议",
          "不是合法体系",
          "unknown",
        ),
    ).toThrow();
  } finally {
    db.close();
  }
});
