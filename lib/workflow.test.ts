import { describe, expect, it } from "vitest";
import {
  canApprovePlan,
  canCreatePlan,
  defaultPhaseStatuses,
  failedImplementationGates,
  legacyPhase,
} from "@/lib/workflow";
import type {
  ImplementationPlanReport,
  ImplementationReport,
  ResearchReport,
} from "@/lib/types";

const research = {
  goal: "Goal",
  scope: "Scope",
  requestFlow: [],
  findings: [],
  questions: [
    { question: "Q1", legacyAnswer: "A1", generation: "", display: "", storage: "", evidence: [] },
    { question: "Q2", legacyAnswer: "A2", generation: "", display: "", storage: "", evidence: [] },
  ],
  risks: [],
  openQuestions: [],
} as ResearchReport;

const plan: ImplementationPlanReport = {
  architectureReasoning: "Reason",
  decisions: [],
  phases: [{
    id: "p1",
    title: "Build",
    steps: [{
      id: "s1",
      title: "Step",
      changes: "Change",
      componentIds: [],
      dependsOn: [],
      doneWhen: ["Done"],
      status: "done",
    }],
  }],
  verify: {
    questions: [{ question: "Q1", legacyAnswer: "A1" }, { question: "Q2", legacyAnswer: "A2" }],
    instructions: [],
    successCriteria: [],
  },
};

describe("workflow gates", () => {
  it("normalizes old persisted phases", () => {
    expect(legacyPhase("analyzing_target")).toBe("plan");
    expect(legacyPhase("done")).toBe("implement");
    expect(defaultPhaseStatuses("plan").implement).toBe("pending");
  });

  it("requires documents at both approval boundaries", () => {
    expect(canCreatePlan(research, "# Research")).toBe(true);
    expect(canCreatePlan(research, "")).toBe(false);
    expect(canApprovePlan(plan, research, "# Plan")).toBe(true);
  });

  it("does not include a legacy-answer equality gate", () => {
    const report: ImplementationReport = {
      status: "passed",
      summary: "Works",
      testCycles: 1,
      observations: [
        { question: "Q1", legacyAnswer: "A1", modernAnswer: "Different 1", evidence: ["proof.mp4"] },
        { question: "Q2", legacyAnswer: "A2", modernAnswer: "Different 2", evidence: ["proof.mp4"] },
      ],
      openAiEvidence: ["response id resp_one", "response id resp_two"],
      neonEvidence: ["endpoint ep-example", "Q1", "Q2"],
      recording: { path: "proof.mp4", label: "Proof" },
      targetBranch: {
        name: "cural/exec-test",
        commit: "abcdef1234567",
        pushed: true,
      },
    };
    expect(failedImplementationGates(report, plan)).toEqual([]);
  });
});
