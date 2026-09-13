import { describe, expect, it } from "vitest";
import {
  MAX_PROOF_CYCLES,
  NEON_GOAL_CHECK,
  OPENAI_GOAL_CHECK,
  SAMPLE_UI_QUESTIONS,
} from "@/lib/prompts";
import {
  extractEvaluationReport,
  extractExecutionReport,
  extractProgress,
  failedGoalGates,
  isVideoArtifactPath,
  mergeEvaluationVideos,
  redactSecrets,
} from "@/lib/reports";

const completeEvaluation = {
  status: "passed",
  summary: "All proof gates passed",
  testCycles: 2,
  videos: [{
    journeyId: "ask-a-question",
    path: "artifacts/computer-use.mp4",
    label: "Computer-use walkthrough",
  }],
  journeys: [{
    journeyId: "ask-a-question",
    status: "passed",
    checks: [
      ...SAMPLE_UI_QUESTIONS.map((question) => ({
        name: question,
        status: "passed",
        legacy: `Legacy answer for ${question}`,
        target: `Modern answer for ${question}`,
        difference: "Wording differs; diagnosis and actions agree.",
        evidence: ["artifacts/computer-use.mp4"],
      })),
      {
        name: OPENAI_GOAL_CHECK,
        status: "passed",
        evidence: ["response id resp_first", "response id resp_second"],
      },
      {
        name: NEON_GOAL_CHECK,
        status: "passed",
        evidence: [
          "Neon endpoint ep-example",
          `row 1: ${SAMPLE_UI_QUESTIONS[0]}`,
          `row 2: ${SAMPLE_UI_QUESTIONS[1]}`,
        ],
      },
    ],
  }],
};

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

  it("refuses passed reports that skip the OpenAI or Neon gates", () => {
    const report = extractEvaluationReport(`
CURAL_EVALUATION_REPORT
\`\`\`json
{
  "status":"passed",
  "summary":"looks fine on screen",
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
    expect(report?.status).toBe("failed");
    expect(failedGoalGates(report!)).toEqual(
      expect.arrayContaining([OPENAI_GOAL_CHECK, NEON_GOAL_CHECK]),
    );
  });

  it("accepts complete UI, OpenAI, and Neon proof without a named branch", () => {
    const report = extractEvaluationReport(`
CURAL_EVALUATION_REPORT
\`\`\`json
${JSON.stringify(completeEvaluation)}
\`\`\`
`);
    expect(report?.status).toBe("passed");
    expect(report?.testCycles).toBe(2);
    expect(failedGoalGates(report!)).toEqual([]);
  });

  it("rejects out-of-range cycles and missing computer-use artifacts", () => {
    const invalid = structuredClone(completeEvaluation);
    invalid.testCycles = MAX_PROOF_CYCLES + 1;
    invalid.journeys[0].checks[0].evidence = ["called /api/chat directly"];
    const report = extractEvaluationReport(`
CURAL_EVALUATION_REPORT
\`\`\`json
${JSON.stringify(invalid)}
\`\`\`
`);
    expect(report?.status).toBe("failed");
    expect(failedGoalGates(report!)).toEqual(
      expect.arrayContaining([
        `1-${MAX_PROOF_CYCLES} complete computer-use proof cycles`,
        `Computer-use proof for "${SAMPLE_UI_QUESTIONS[0]}"`,
      ]),
    );
  });

  it("redacts credentials before report data is exposed", () => {
    expect(
      redactSecrets(
        "DATABASE_URL=postgresql://user:pass@ep-test.neon.tech/db OPENAI_API_KEY=sk-proj-abcdefghijklmnop",
      ),
    ).toBe("[REDACTED_ENV_VALUE] [REDACTED_ENV_VALUE]");
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
