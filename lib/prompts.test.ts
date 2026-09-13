import { describe, expect, it } from "vitest";
import {
  implementPrompt,
  planPrompt,
  researchPrompt,
} from "@/lib/prompts";
import type {
  ImplementationPlanReport,
  ResearchReport,
} from "@/lib/types";

const research: ResearchReport = {
  goal: "Modernize support",
  scope: "Question flow",
  requestFlow: ["UI", "API"],
  findings: [],
  questions: [
    {
      question: "Exact question one?",
      legacyAnswer: "Legacy answer one",
      generation: "Worker",
      display: "Panel",
      storage: "History",
      evidence: ["proof.png"],
    },
    {
      question: "Exact question two?",
      legacyAnswer: "Legacy answer two",
      generation: "Worker",
      display: "Panel",
      storage: "History",
      evidence: ["proof.png"],
    },
  ],
  risks: [],
  openQuestions: [],
};

const plan: ImplementationPlanReport = {
  architectureReasoning: "Direct request flow",
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
      doneWhen: ["Route works"],
      status: "pending",
    }],
  }],
  verify: {
    questions: research.questions.map(({ question, legacyAnswer }) => ({
      question,
      legacyAnswer,
    })) as ImplementationPlanReport["verify"]["questions"],
    instructions: ["Use the modern UI"],
    successCriteria: ["Works"],
  },
};

describe("phase prompts", () => {
  it("requires research through the legacy UI and a research document", () => {
    const value = researchPrompt({
      legacyRepo: "https://github.com/acme/legacy",
      legacyBaseUrl: "https://legacy.example",
      prompt: "Modernize it",
    });
    expect(value).toContain("visible browser UI");
    expect(value).toContain("exactly two representative questions");
    expect(value).toContain("artifacts/research-plan.md");
    expect(value).toContain("CURAL_RESEARCH_REPORT");
    expect(value).toContain("artifacts/cural-research-report.json");
    expect(value).toContain("Do not create a branch");
  });

  it("copies both exact legacy observations into planning", () => {
    const value = planPrompt({
      legacyRepo: "legacy",
      targetRepo: "target",
      prompt: "Modernize it",
      research,
      researchDocument: "# Research",
    });
    for (const item of research.questions) {
      expect(value).toContain(item.question);
      expect(value).toContain(item.legacyAnswer);
    }
    expect(value).toContain("context only");
    expect(value).toContain("artifacts/implementation-plan.md");
    expect(value).toContain("CURAL_PLAN_REPORT");
    expect(value).toContain("artifacts/cural-plan-report.json");
  });

  it("verifies only the modern UI while retaining OpenAI and Neon gates", () => {
    const value = implementPrompt({
      legacyRepo: "legacy",
      targetRepo: "target",
      executionBranch: "cural/exec-test",
      prompt: "Modernize it",
      plan,
      planDocument: "# Implementation plan",
      components: [],
    });
    expect(value).toContain("visible modern UI");
    expect(value).toContain("Do not reopen or test the legacy UI");
    expect(value).toContain("Do not compare modern answers");
    expect(value).toContain("OPENAI_API_KEY");
    expect(value).toContain("Neon Postgres");
    expect(value).toContain("modern-ui-verification.mp4");
    expect(value).toContain("git ls-remote");
    expect(value).toContain("CURAL_IMPLEMENTATION_REPORT");
  });
});
