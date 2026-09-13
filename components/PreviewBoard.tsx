"use client";

import { useMemo, useState } from "react";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { ArtifactDrawer } from "@/components/ArtifactDrawer";
import { BoardChrome, type BoardView } from "@/components/BoardChrome";
import { WorkflowDocumentPanel } from "@/components/WorkflowDocumentPanel";
import { SAMPLE_AS_IS, SAMPLE_TO_BE } from "@/lib/sample-board";
import type {
  ImplementationPlanReport,
  ImplementationReport,
  PhaseStatuses,
  ResearchReport,
  WorkflowDocument,
} from "@/lib/types";

const RESEARCH: ResearchReport = {
  goal: "Replace the distributed support pipeline with a direct modern question flow.",
  scope: "Legacy question submission, generation, display, and history persistence.",
  requestFlow: [
    "Operator submits a question",
    "ChatController creates a correlated request",
    "Workers classify, retrieve, and generate",
    "ResultHandler displays and stores the answer",
  ],
  findings: [{
    id: "queue-overhead",
    title: "Synchronous work crosses a distributed queue",
    summary: "The HTTP request waits while three workers exchange messages.",
    componentIds: ["saga", "generation"],
    evidence: ["legacy/chat/saga.py:ChatRequestSaga"],
  }],
  questions: [
    {
      question: "What does HelloDrive fault code FO48 mean?",
      legacyAnswer: "FO48 indicates an overcurrent fault.",
      generation: "GenerationConsumer combines retrieved fault documentation.",
      display: "Chat response panel",
      storage: "ChatMessage history row",
      evidence: ["artifacts/legacy-question-one.png"],
    },
    {
      question: "How do I clear a HelloDrive FO48 fault and get the line running again?",
      legacyAnswer: "Inspect the motor and reset the drive after correcting the cause.",
      generation: "GenerationConsumer produces operator guidance.",
      display: "Chat response panel",
      storage: "ChatMessage history row",
      evidence: ["artifacts/legacy-question-two.png"],
    },
  ],
  risks: ["Safety guidance must remain explicit."],
  openQuestions: ["Which document set becomes the modern retrieval source?"],
};

const PLAN: ImplementationPlanReport = {
  architectureReasoning:
    "A direct ChatService preserves the user wait while removing queue orchestration.",
  decisions: [
    { componentId: "controller", action: "retain", rationale: "Keep the public request boundary." },
    { componentId: "service", action: "introduce", rationale: "Own the synchronous question flow." },
    { componentId: "generation", action: "replace", rationale: "Call OpenAI behind one adapter." },
  ],
  phases: [
    {
      id: "foundation",
      title: "Foundation",
      steps: [
        {
          id: "chat-service",
          title: "Create the ChatService flow",
          changes: "Add the modern API orchestration and contracts.",
          componentIds: ["controller", "service"],
          dependsOn: [],
          doneWhen: ["UI question reaches the service"],
          status: "pending",
        },
        {
          id: "openai-store",
          title: "Connect OpenAI and Neon",
          changes: "Generate answers and persist question/answer rows.",
          componentIds: ["generation", "service"],
          dependsOn: ["chat-service"],
          doneWhen: ["Provider IDs and persisted rows are observable"],
          status: "pending",
        },
      ],
    },
    {
      id: "verify",
      title: "Verify",
      steps: [
        {
          id: "ui-proof",
          title: "Record modern UI verification",
          changes: "Submit both frozen questions with computer use.",
          componentIds: ["controller", "service", "generation"],
          dependsOn: ["openai-store"],
          doneWhen: ["Both answers visible and recording saved"],
          status: "pending",
        },
      ],
    },
  ],
  verify: {
    questions: RESEARCH.questions.map(({ question, legacyAnswer }) => ({
      question,
      legacyAnswer,
    })) as ImplementationPlanReport["verify"]["questions"],
    instructions: ["Submit both questions through the modern UI and record the session."],
    successCriteria: ["Visible answers", "Two OpenAI responses", "Two Neon rows", "Recording saved"],
  },
};

const IMPLEMENTATION: ImplementationReport = {
  status: "passed",
  summary: "The modern UI, API, OpenAI generation, and Neon persistence work as approved.",
  testCycles: 1,
  observations: [
    {
      question: RESEARCH.questions[0].question,
      legacyAnswer: RESEARCH.questions[0].legacyAnswer,
      modernAnswer: "FO48 is an overcurrent trip. Stop the line and inspect the motor circuit.",
      evidence: ["artifacts/modern-ui-verification.mp4"],
    },
    {
      question: RESEARCH.questions[1].question,
      legacyAnswer: RESEARCH.questions[1].legacyAnswer,
      modernAnswer: "Isolate power, correct the overload, then reset the drive according to the manual.",
      evidence: ["artifacts/modern-ui-verification.mp4"],
    },
  ],
  openAiEvidence: ["response id resp_preview_1", "response id resp_preview_2"],
  neonEvidence: [
    "Neon endpoint ep-preview",
    `row: ${RESEARCH.questions[0].question}`,
    `row: ${RESEARCH.questions[1].question}`,
  ],
  recording: {
    path: "artifacts/modern-ui-verification.mp4",
    label: "Modern UI verification",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  targetBranch: {
    name: "cural/exec-preview",
    commit: "abcdef1234567",
    pushed: true,
  },
};

const CONTENT = {
  research: `# Research plan\n\n## Goal and scope\n${RESEARCH.goal}\n\n## Legacy request flow\n${RESEARCH.requestFlow.map((item) => `- ${item}`).join("\n")}\n\n## Questions and answers\n1. ${RESEARCH.questions[0].question}\n- Legacy answer: ${RESEARCH.questions[0].legacyAnswer}\n\n2. ${RESEARCH.questions[1].question}\n- Legacy answer: ${RESEARCH.questions[1].legacyAnswer}\n\n## Risks\n- ${RESEARCH.risks[0]}`,
  plan: `# Implementation plan\n\n## Intended architecture\n${PLAN.architectureReasoning}\n\n## Foundation\n1. Create the ChatService flow\n2. Connect OpenAI and Neon\n\n## Verify\n- Submit: ${RESEARCH.questions[0].question}\n- Legacy context: ${RESEARCH.questions[0].legacyAnswer}\n- Submit: ${RESEARCH.questions[1].question}\n- Legacy context: ${RESEARCH.questions[1].legacyAnswer}\n- Verify modern behavior; do not compare answers.`,
  summary: `# Implementation summary\n\nAll approved target components were implemented on \`cural/exec-preview\`.\n\n- Direct modern API flow\n- OpenAI answer generation\n- Neon question and answer persistence`,
  verification: `# Verification report\n\n## Result\nVerification passed through the modern UI.\n\n## New responses\n1. ${IMPLEMENTATION.observations[0].modernAnswer}\n2. ${IMPLEMENTATION.observations[1].modernAnswer}\n\n## Evidence\n- Two OpenAI response IDs\n- Both rows in Neon\n- Computer-use recording saved`,
};

export function PreviewBoard() {
  const [view, setView] = useState<BoardView>("research");
  const [stage, setStage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState("research-plan.md");
  const [artifactsOpen, setArtifactsOpen] = useState(false);

  const statuses: PhaseStatuses =
    stage === 0
      ? { research: "ready", plan: "pending", implement: "pending" }
      : stage === 1
        ? { research: "complete", plan: "ready", implement: "pending" }
        : stage === 2
          ? { research: "complete", plan: "complete", implement: "running" }
          : { research: "complete", plan: "complete", implement: "complete" };
  const plan = useMemo(
    () => ({
      ...PLAN,
      phases: PLAN.phases.map((phase) => ({
        ...phase,
        steps: phase.steps.map((step) => ({
          ...step,
          status: stage >= 3 ? ("done" as const) : stage === 2 ? ("running" as const) : step.status,
        })),
      })),
    }),
    [stage],
  );
  const documents = useMemo(() => {
    const values: Record<string, WorkflowDocument> = {
      "research-plan.md": workflowDocument("research-plan.md", CONTENT.research),
    };
    if (stage >= 1) {
      values["implementation-plan.md"] = workflowDocument("implementation-plan.md", CONTENT.plan);
    }
    if (stage >= 3) {
      values["implementation-summary.md"] = workflowDocument(
        "implementation-summary.md",
        CONTENT.summary,
      );
      values["verification-report.md"] = workflowDocument(
        "verification-report.md",
        CONTENT.verification,
      );
    }
    return values;
  }, [stage]);

  function advance() {
    if (stage === 0) {
      setStage(1);
      setView("plan");
      setSelectedFilename("implementation-plan.md");
    } else if (stage === 1) {
      setStage(2);
      setView("implement");
      window.setTimeout(() => {
        setStage(3);
        setSelectedFilename("verification-report.md");
      }, 650);
    } else {
      setSelectedFilename("verification-report.md");
    }
    setSelectedId(null);
  }

  const graph = view === "research" ? SAMPLE_AS_IS : SAMPLE_TO_BE;
  const implementation = stage >= 3 ? IMPLEMENTATION : null;

  return (
    <div className="relative flex h-svh min-h-0 flex-col bg-paper">
      <BoardChrome
        view={view}
        onViewChange={(next) => {
          setView(next);
          setSelectedId(null);
          const filename =
            next === "research" ? "research-plan.md" : next === "plan" ? "implementation-plan.md" : "verification-report.md";
          if (documents[filename]) setSelectedFilename(filename);
        }}
        phaseStatuses={statuses}
        status={<span className="hidden text-[11px] text-muted md:inline">Preview workspace</span>}
        primaryAction={
          <button
            type="button"
            onClick={advance}
            disabled={stage === 2}
            className="rounded-md bg-cta px-3.5 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {stage === 0
              ? "Create implementation plan →"
              : stage === 1
                ? "Approve and implement →"
                : stage === 2
                  ? "Implementing…"
                  : "Review implementation →"}
          </button>
        }
        overflow={
          <button type="button" onClick={() => setArtifactsOpen(true)} className="px-3 py-2 text-left text-[13px]">
            Saved artifacts
          </button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ArchitecturePane
          pane={view === "research" ? "asIs" : "toBe"}
          title={view === "research" ? "Legacy component diagram" : "Target component diagram"}
          subtitle={view === "implement" ? "Implementation progress" : "Select a component for linked context"}
          graph={graph}
          selectable
          selectedId={selectedId}
          nodeStatus={
            view === "implement"
              ? Object.fromEntries(graph.nodes.map((node) => [node.id, stage >= 3 ? "done" : "running"]))
              : {}
          }
          onSelect={setSelectedId}
          onMove={() => undefined}
        />
        <WorkflowDocumentPanel
          phase={view}
          documents={documents}
          selectedFilename={selectedFilename}
          onSelectDocument={setSelectedFilename}
          selectedComponentId={selectedId}
          graph={graph}
          research={RESEARCH}
          plan={plan}
          implementation={implementation}
          blockers={[]}
          artifactUrl={(path) =>
            path === IMPLEMENTATION.recording?.path
              ? IMPLEMENTATION.recording.url ?? null
              : null
          }
        />
      </div>
      <ArtifactDrawer
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        documents={documents}
        implementation={implementation}
        branches={[{ repoUrl: "https://github.com/acme/target", branch: "cural/exec-preview" }]}
        urlFor={(path) =>
          path === IMPLEMENTATION.recording?.path
            ? IMPLEMENTATION.recording.url ?? null
            : null
        }
      />
    </div>
  );
}

function workflowDocument(filename: string, content: string): WorkflowDocument {
  return {
    filename,
    content,
    artifactPath: `artifacts/${filename}`,
    agentId: "bc-preview",
    runId: "run-preview",
    updatedAt: "2026-09-13T00:00:00.000Z",
  };
}
