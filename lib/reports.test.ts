import { describe, expect, it } from "vitest";
import {
  extractImplementationResult,
  extractPlanResult,
  extractProgress,
  extractResearchResult,
  redactSecrets,
} from "@/lib/reports";
import type {
  ImplementationPlanReport,
  ResearchReport,
} from "@/lib/types";

const research: ResearchReport = {
  goal: "Modernize",
  scope: "Question flow",
  requestFlow: ["UI", "API"],
  findings: [],
  questions: [
    {
      question: "Question one?",
      legacyAnswer: "Old answer one",
      generation: "Worker",
      display: "Panel",
      storage: "History",
      evidence: ["one.png"],
    },
    {
      question: "Question two?",
      legacyAnswer: "Old answer two",
      generation: "Worker",
      display: "Panel",
      storage: "History",
      evidence: ["two.png"],
    },
  ],
  risks: [],
  openQuestions: [],
};

const plan: ImplementationPlanReport = {
  architectureReasoning: "Direct flow",
  decisions: [],
  phases: [{
    id: "build",
    title: "Build",
    steps: [{
      id: "api",
      title: "Build API",
      changes: "Add route",
      componentIds: ["api"],
      dependsOn: [],
      doneWhen: ["Works"],
      status: "pending",
    }],
  }],
  verify: {
    questions: research.questions.map(({ question, legacyAnswer }) => ({
      question,
      legacyAnswer,
    })) as ImplementationPlanReport["verify"]["questions"],
    instructions: ["Use UI"],
    successCriteria: ["Works"],
  },
};

function block(marker: string, value: unknown) {
  return `${marker}\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
}

describe("workflow report protocol", () => {
  it("extracts a report when prose sits between the marker and JSON", () => {
    const payload = {
      document: {
        filename: "research-plan.md",
        artifactPath: "artifacts/research-plan.md",
        content: "# Research",
      },
      graph: { nodes: [], edges: [] },
      report: research,
    };
    const result = extractResearchResult(
      [
        "Research finished.",
        "CURAL_RESEARCH_REPORT",
        "",
        "The complete JSON is in /opt/cursor/artifacts/cural-research-report.json.",
        "```json",
        JSON.stringify(payload),
        "```",
      ].join("\n"),
    );
    expect(result?.report.goal).toBe(research.goal);
    expect(result?.document.filename).toBe("research-plan.md");
  });

  it("extracts a raw artifact JSON file and JSON that embeds markdown fences", () => {
    const payload = {
      document: {
        filename: "research-plan.md",
        artifactPath: "artifacts/research-plan.md",
        content: "# Research\n\n```ts\nconst value = 1;\n```\n",
      },
      graph: { nodes: [], edges: [] },
      report: research,
    };
    expect(extractResearchResult(JSON.stringify(payload, null, 2))?.document.content)
      .toContain("const value = 1");
    expect(
      extractResearchResult(
        `CURAL_RESEARCH_REPORT\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
      )?.document.content,
    ).toContain("```ts");
  });

  it("extracts exactly two research observations and the document", () => {
    const result = extractResearchResult(
      block("CURAL_RESEARCH_REPORT", {
        document: {
          filename: "research-plan.md",
          artifactPath: "artifacts/research-plan.md",
          content: "# Research",
        },
        graph: { nodes: [], edges: [] },
        report: research,
      }),
    );
    expect(result?.report.questions).toHaveLength(2);
    expect(result?.document.filename).toBe("research-plan.md");
  });

  it("extracts a plan from an artifact JSON and restores host verify questions", () => {
    const paraphrased = structuredClone(plan);
    paraphrased.verify.questions[0] = {
      question: "Slightly different question?",
      legacyAnswer: "Changed",
    };
    const result = extractPlanResult(
      JSON.stringify({
        document: {
          filename: "implementation-plan.md",
          artifactPath: "artifacts/implementation-plan.md",
          content: "See artifacts/implementation-plan.md",
        },
        graph: { nodes: [], edges: [] },
        report: paraphrased,
      }),
      research,
    );
    expect(result?.report.verify.questions).toEqual(plan.verify.questions);
    expect(result?.document.filename).toBe("implementation-plan.md");
  });

  it("accepts different modern answers when UI, OpenAI, Neon, branch, and recording pass", () => {
    const result = extractImplementationResult(
      block("CURAL_IMPLEMENTATION_REPORT", {
        status: "passed",
        summary: "Modern behavior works",
        testCycles: 1,
        steps: [{ id: "api", status: "done", summary: "Built" }],
        observations: plan.verify.questions.map((item, index) => ({
          ...item,
          modernAnswer: `Entirely new answer ${index + 1}`,
          evidence: ["artifacts/modern-ui-verification.mp4"],
        })),
        openAiEvidence: ["response id resp_one", "response id resp_two"],
        neonEvidence: [
          "endpoint ep-example",
          `row ${plan.verify.questions[0].question}`,
          `row ${plan.verify.questions[1].question}`,
        ],
        recording: {
          path: "artifacts/modern-ui-verification.mp4",
          label: "Modern UI verification",
        },
        targetBranch: {
          name: "cural/exec-test",
          commit: "abcdef1234567",
          pushed: true,
        },
        documents: [
          {
            filename: "implementation-summary.md",
            artifactPath: "artifacts/implementation-summary.md",
            content: "# Summary",
          },
          {
            filename: "verification-report.md",
            artifactPath: "artifacts/verification-report.md",
            content: "# Verification",
          },
        ],
      }),
      plan,
    );
    expect(result?.report.status).toBe("passed");
    expect(result?.report.observations[0].modernAnswer).not.toBe(
      research.questions[0].legacyAnswer,
    );
  });

  it("fails completion without the recording and required provider evidence", () => {
    const result = extractImplementationResult(
      block("CURAL_IMPLEMENTATION_REPORT", {
        status: "passed",
        testCycles: 1,
        steps: [{ id: "api", status: "done", summary: "Built" }],
        observations: plan.verify.questions.map((item) => ({
          ...item,
          modernAnswer: "New answer",
          evidence: [],
        })),
        targetBranch: {
          name: "cural/exec-test",
          commit: "abcdef1234567",
          pushed: true,
        },
        documents: [
          { filename: "implementation-summary.md", artifactPath: "a.md", content: "x" },
          { filename: "verification-report.md", artifactPath: "b.md", content: "x" },
        ],
      }),
      plan,
    );
    expect(result?.report.status).toBe("failed");
  });

  it("parses exact step progress and redacts credentials", () => {
    expect(
      extractProgress(
        'CURAL_STEP_STATUS {"id":"api","status":"running"}',
        ["api", "ui"],
      ),
    ).toEqual({ api: "running", ui: "pending" });
    expect(
      redactSecrets(
        "DATABASE_URL=postgres://user:pass@ep-test/db OPENAI_API_KEY=sk-proj-abcdefghijklmnop",
      ),
    ).toBe("[REDACTED_ENV_VALUE] [REDACTED_ENV_VALUE]");
  });
});
