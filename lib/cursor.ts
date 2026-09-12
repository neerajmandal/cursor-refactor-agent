import { Agent, Cursor, type AgentDefinition, type CloudAgentOptions } from "@cursor/sdk";
import { evaluationTargetRef, executionBranchName } from "@/lib/branch";
import { componentRefs, layoutGraph } from "@/lib/graph";
import { extractAnalysis } from "@/lib/journey";
import {
  asIsPrompt,
  evaluationPrompt,
  executePrompt,
  subagentPrompt,
  toBePrompt,
} from "@/lib/prompts";
import {
  extractEvaluationReport,
  extractExecutionReport,
  extractProgress,
  isVideoArtifactPath,
  mergeEvaluationVideos,
  runBranches,
  videoContentType,
} from "@/lib/reports";
import {
  isCloudAgentId,
  type EvaluationReport,
  type EvaluationVideo,
  type ExecutionReport,
  type Graph,
  type Journey,
  type MigrationSnapshot,
  type NodeStatus,
  type RunBranch,
} from "@/lib/types";

const MODEL = { id: "composer-2.5" } as const;

export function requireApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) {
    throw new Error("CURSOR_API_KEY is not set");
  }
  return key;
}

type RepoInput = string | { url: string; startingRef?: string };

export function cloudOptions(envName: string, repos: RepoInput[]): CloudAgentOptions {
  const named = envName.trim();
  const checkedOutRepos = repos.flatMap((repo) => {
    if (typeof repo === "string") return repo ? [{ url: repo }] : [];
    return repo.url ? [repo] : [];
  });
  if (named) {
    return { env: { type: "cloud", name: named } };
  }
  return {
    env: { type: "cloud" },
    repos: checkedOutRepos,
  };
}

export async function listRepos(): Promise<string[]> {
  const apiKey = requireApiKey();
  const repos = await Cursor.repositories.list({ apiKey });
  return repos.map((repo) => repo.url).filter(Boolean);
}

export function evaluationEnvVars(input: {
  legacyBaseUrl: string;
  targetBaseUrl: string;
}): Record<string, string> {
  return Object.fromEntries(
    [
      ["CURAL_LEGACY_BASE_URL", input.legacyBaseUrl.trim()],
      ["CURAL_TARGET_BASE_URL", input.targetBaseUrl.trim()],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export async function startAnalyze(input: {
  phase: "as-is" | "to-be";
  envName: string;
  legacyRepo: string;
  legacyRef: string;
  targetRepo: string;
  prompt: string;
  journeys?: Journey[];
  agentId?: string;
  regenerate?: boolean;
  requestKey?: string;
}): Promise<{ agentId: string; runId: string }> {
  const apiKey = requireApiKey();
  const message =
    input.phase === "as-is"
      ? asIsPrompt(input.legacyRepo, { redraw: Boolean(input.regenerate) })
      : toBePrompt(
          input.legacyRepo,
          input.targetRepo,
          input.prompt,
          input.journeys,
        );

  if (isCloudAgentId(input.agentId)) {
    try {
      const agent = await Agent.resume(input.agentId!, { apiKey, model: MODEL });
      try {
        const run = await agent.send(message, {
          idempotencyKey: input.requestKey,
        });
        return { agentId: agent.agentId, runId: run.id };
      } finally {
        agent.close();
      }
    } catch {
      // Agent may have expired; start a fresh one below.
    }
  }

  const agent = await Agent.create({
    apiKey,
    model: MODEL,
    name: "Cural as-is architecture",
    cloud: cloudOptions(input.envName, [{
      url: input.legacyRepo,
      startingRef: input.legacyRef || undefined,
    }]),
  });
  try {
    const run = await agent.send(message, {
      idempotencyKey: input.requestKey,
    });
    return { agentId: agent.agentId, runId: run.id };
  } finally {
    agent.close();
  }
}

export async function startExecute(input: {
  envName: string;
  legacyRepo: string;
  legacyRef: string;
  targetRepo: string;
  targetRef: string;
  prompt: string;
  snapshot: MigrationSnapshot;
  requestKey?: string;
}): Promise<{ agentId: string; runId: string }> {
  const apiKey = requireApiKey();
  const agents: Record<string, AgentDefinition> = {};
  const components = input.snapshot.toBe.nodes;
  const refs = componentRefs(components);

  const executionBranch =
    input.snapshot.executionBranch?.trim() ||
    executionBranchName(input.snapshot.id);
  refs.forEach((ref, index) => {
    const node = components[index];
    agents[ref.slug] = {
      description: `Implement target component ${ref.label} (${ref.id}).`,
      prompt: subagentPrompt(node, { ...input, executionBranch }),
    };
  });

  const repos = [
    { url: input.legacyRepo, startingRef: input.legacyRef || undefined },
    { url: input.targetRepo, startingRef: input.targetRef || undefined },
  ];
  const agent = await Agent.create({
    apiKey,
    model: MODEL,
    name: "Cural migration execute",
    cloud: {
      ...cloudOptions(input.envName, repos),
      autoCreatePR: true,
      metadata: {
        workflow: "migration-execute",
        snapshotId: input.snapshot.id,
      },
    },
    agents,
  });

  try {
    const run = await agent.send(
      executePrompt({ ...input, components, refs, executionBranch }),
      { idempotencyKey: input.requestKey },
    );
    return { agentId: agent.agentId, runId: run.id };
  } finally {
    agent.close();
  }
}

export async function startEvaluation(input: {
  envName: string;
  legacyRepo: string;
  legacyRef: string;
  targetRepo: string;
  targetRef: string;
  legacyBaseUrl: string;
  targetBaseUrl: string;
  fixtureCommand: string;
  snapshot: MigrationSnapshot;
  requestKey?: string;
}): Promise<{ agentId: string; runId: string }> {
  const apiKey = requireApiKey();
  const envVars = evaluationEnvVars(input);
  const agent = await Agent.create({
    apiKey,
    model: MODEL,
    name: "Cural end-to-end user testing",
    cloud: {
      ...cloudOptions(input.envName, [
        { url: input.legacyRepo, startingRef: input.legacyRef || undefined },
        {
          url: input.targetRepo,
          startingRef:
            evaluationTargetRef(input.snapshot, input.targetRef) || undefined,
        },
      ]),
      skipReviewerRequest: true,
      metadata: {
        workflow: "e2e-user-testing",
        snapshotId: input.snapshot.id,
      },
      ...(Object.keys(envVars).length ? { envVars } : {}),
    },
  });
  try {
    const run = await agent.send(evaluationPrompt(input), {
      idempotencyKey: input.requestKey,
    });
    return { agentId: agent.agentId, runId: run.id };
  } finally {
    agent.close();
  }
}

export async function listVideoArtifacts(agentId: string): Promise<EvaluationVideo[]> {
  if (!isCloudAgentId(agentId)) return [];
  const apiKey = requireApiKey();
  const agent = await Agent.resume(agentId, { apiKey });
  try {
    const artifacts = await agent.listArtifacts();
    return artifacts
      .filter((artifact) => isVideoArtifactPath(artifact.path))
      .map((artifact) => ({
        path: artifact.path,
        label: artifact.path.split("/").pop() || artifact.path,
        sizeBytes: artifact.sizeBytes,
        updatedAt: artifact.updatedAt,
      }));
  } catch {
    return [];
  } finally {
    agent.close();
  }
}

export async function downloadAgentArtifact(
  agentId: string,
  path: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!isCloudAgentId(agentId)) {
    throw new Error("Only cloud agent artifacts can be downloaded");
  }
  if (!path || path.includes("..") || path.startsWith("/")) {
    throw new Error("Invalid artifact path");
  }
  const apiKey = requireApiKey();
  const agent = await Agent.resume(agentId, { apiKey });
  try {
    const artifacts = await agent.listArtifacts();
    const match = artifacts.find((artifact) => artifact.path === path);
    if (!match) {
      throw new Error("Artifact not found on agent");
    }
    const buffer = await agent.downloadArtifact(path);
    return {
      buffer,
      contentType: isVideoArtifactPath(path)
        ? videoContentType(path)
        : "application/octet-stream",
    };
  } finally {
    agent.close();
  }
}

export async function pollRun(input: {
  agentId: string;
  runId: string;
  kind?: "analyze" | "execute" | "evaluate";
  componentIds?: string[];
  components?: { id: string; label: string }[];
}): Promise<{
  status: string;
  result?: string;
  graph?: Graph;
  journeys?: Journey[];
  error?: string;
  nodeStatus?: Record<string, NodeStatus>;
  executionReport?: ExecutionReport;
  evaluationReport?: EvaluationReport;
  evaluationVideos?: EvaluationVideo[];
  branches?: RunBranch[];
}> {
  const apiKey = requireApiKey();
  const run = await Agent.getRun(input.runId, {
    runtime: "cloud",
    agentId: input.agentId,
    apiKey,
  });

  // Rehydrated cloud runs do not guarantee that their original stream remains
  // available. Status and terminal result metadata are durable; conversation
  // streams are not, so polling must never depend on run.conversation().
  const text = run.result ?? "";
  const refs = input.components?.length
    ? componentRefs(input.components)
    : input.componentIds?.length
      ? componentRefs(input.componentIds.map((id) => ({ id, label: id })))
      : undefined;
  const nodeStatus = refs?.length
    ? extractProgress(text, refs.map((ref) => ref.id))
    : undefined;
  const branches = runBranches(run.git);

  if (run.status === "running") {
    return { status: run.status, result: text, nodeStatus, branches };
  }

  if (run.status === "error" || run.status === "cancelled") {
    return {
      status: run.status,
      result: text,
      error: run.error?.message ?? `Run ${run.status}`,
      nodeStatus,
      branches,
    };
  }

  if (input.kind === "execute" || refs?.length) {
    const executionReport = extractExecutionReport(text);
    if (!executionReport) {
      return {
        status: "error",
        result: text,
        error: "Execution finished without a valid CURAL_EXECUTION_REPORT",
        nodeStatus,
        branches,
      };
    }
    const finalStatus = Object.fromEntries(
      refs?.map((ref) => {
        const reported = executionReport.components.find(
          (component) => component.id === ref.id,
        );
        return [ref.id, reported?.status === "done" ? "done" : "error"];
      }) ?? [],
    ) as Record<string, NodeStatus>;
    if (
      executionReport.status !== "passed" ||
      Object.values(finalStatus).some((status) => status === "error")
    ) {
      return {
        status: "error",
        result: text,
        error: "One or more components did not complete successfully",
        nodeStatus: finalStatus,
        executionReport,
        branches,
      };
    }
    return {
      status: run.status,
      result: text,
      nodeStatus: finalStatus,
      executionReport,
      branches,
    };
  }

  if (input.kind === "evaluate") {
    const evaluationReport = extractEvaluationReport(text);
    if (!evaluationReport) {
      return {
        status: "error",
        result: text,
        error: "Evaluation finished without a valid CURAL_EVALUATION_REPORT",
        branches,
      };
    }
    const listed = await listVideoArtifacts(input.agentId);
    const evaluationVideos = mergeEvaluationVideos(
      evaluationReport.videos,
      listed,
    );
    return {
      status: run.status,
      result: text,
      evaluationReport: { ...evaluationReport, videos: evaluationVideos },
      evaluationVideos,
      branches,
    };
  }

  try {
    const analysis = extractAnalysis(text);
    return {
      status: run.status,
      result: text,
      graph: layoutGraph(analysis.graph),
      journeys: analysis.journeys,
      branches,
    };
  } catch (error) {
    return {
      status: "error",
      result: text,
      error: error instanceof Error ? error.message : "Failed to parse architecture JSON",
      branches,
    };
  }
}
