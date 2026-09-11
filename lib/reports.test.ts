import { describe, expect, it } from "vitest";
import {
  extractEvaluationReport,
  extractExecutionReport,
  extractProgress,
} from "@/lib/reports";

describe("strict agent result protocol", () => {
  it("accepts only exact progress messages", () => {
    const statuses = extractProgress(
      [
        'CURAL_STATUS {"id":"api","status":"running"}',
        "api was probably done",
        'CURAL_STATUS {"id":"ui","status":"done"}',
      ].join("\n"),
      ["api", "ui", "db"],
    );
    expect(statuses).toEqual({ api: "running", ui: "done", db: "pending" });
  });

  it("parses a terminal component report", () => {
    const report = extractExecutionReport(`
CURAL_EXECUTION_REPORT
\`\`\`json
{"status":"passed","components":[{"id":"api","status":"done","summary":"Implemented"}]}
\`\`\`
`);
    expect(report).toEqual({
      status: "passed",
      components: [{ id: "api", status: "done", summary: "Implemented" }],
    });
  });

  it("does not turn a failed parity report into success", () => {
    const report = extractEvaluationReport(`
CURAL_EVALUATION_REPORT
\`\`\`json
{
  "status":"passed",
  "summary":"Mismatch found",
  "journeys":[{
    "journeyId":"checkout",
    "status":"failed",
    "checks":[{
      "name":"Order total",
      "status":"failed",
      "legacy":"10.00",
      "target":"11.00",
      "difference":"Totals differ",
      "evidence":["report.json"]
    }]
  }]
}
\`\`\`
`);
    expect(report?.status).toBe("failed");
    expect(report?.journeys[0].checks[0].difference).toBe("Totals differ");
  });
});
