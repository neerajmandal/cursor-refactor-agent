import { describe, expect, it } from "vitest";
import {
  extractEvaluationReport,
  extractExecutionReport,
  extractProgress,
  isVideoArtifactPath,
  mergeEvaluationVideos,
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
  "videos":[{"journeyId":"checkout","path":"artifacts/checkout.mp4","label":"Checkout walkthrough"}],
  "journeys":[{
    "journeyId":"checkout",
    "status":"failed",
    "checks":[{
      "name":"Order total",
      "status":"failed",
      "legacy":"10.00",
      "target":"11.00",
      "difference":"Totals differ",
      "evidence":["artifacts/checkout.mp4"]
    }]
  }]
}
\`\`\`
`);
    expect(report?.status).toBe("failed");
    expect(report?.journeys[0].checks[0].difference).toBe("Totals differ");
    expect(report?.videos).toEqual([{
      journeyId: "checkout",
      path: "artifacts/checkout.mp4",
      label: "Checkout walkthrough",
    }]);
  });

  it("defaults missing videos to an empty list", () => {
    const report = extractEvaluationReport(`
CURAL_EVALUATION_REPORT
\`\`\`json
{
  "status":"passed",
  "summary":"ok",
  "journeys":[{
    "journeyId":"checkout",
    "status":"passed",
    "checks":[{
      "name":"Order total",
      "status":"passed",
      "legacy":"10.00",
      "target":"10.00",
      "difference":"",
      "evidence":[]
    }]
  }]
}
\`\`\`
`);
    expect(report?.videos).toEqual([]);
  });

  it("merges reported videos with listed VM artifacts", () => {
    expect(
      mergeEvaluationVideos(
        [{ path: "artifacts/a.mp4", label: "Reported", journeyId: "j1" }],
        [
          { path: "artifacts/a.mp4", label: "a.mp4", sizeBytes: 12 },
          { path: "artifacts/b.webm", label: "b.webm", sizeBytes: 34 },
        ],
      ),
    ).toEqual([
      {
        path: "artifacts/a.mp4",
        label: "Reported",
        journeyId: "j1",
        sizeBytes: 12,
      },
      { path: "artifacts/b.webm", label: "b.webm", sizeBytes: 34 },
    ]);
    expect(isVideoArtifactPath("artifacts/demo.MP4")).toBe(true);
    expect(isVideoArtifactPath("artifacts/report.json")).toBe(false);
  });
});
