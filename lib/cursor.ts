import { Agent, type CloudAgentOptions } from "@cursor/sdk";
import { executionBranchName } from "@/lib/branch";
import { layoutGraph } from "@/lib/graph";
import {
  implementPrompt,
  planPrompt,
  researchPrompt,
} from "@/lib/prompts";
import {
  extractImplementationResult,
  extractPlanResult,
  extractProgress,
  extractResearchResult,
  isStubPlanDocument,
  isStubResearchDocument,
  redactSecrets,
  runBranches,
  videoContentType,
  type ImplementRunResult,
  type PlanRunResult,
  type ResearchRunResult,
} from "@/lib/reports";
import type {
  ImplementationPlanReport,
  MigrationSnapshot,
  NodeStatus,
  ResearchReport,
  RunBranch,
} from "@/lib/types";
import { isCloudAgentId, RECOVER_RUN_ID } from "@/lib/types";

const MODEL = { id: "composer-2.5" } as const;

function artifactBasename(path: string): string {
  return path.replace(/^\/opt\/cursor\//, "").replace(/^\/+/, "");
}

export function requireApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) throw new Error("CURSOR_API_KEY is not set");
  return key;
}

type RepoInput = string | { url: string; startingRef?: string };

export function cloudOptions(
  envName: string,
  repos: RepoInput[],
): CloudAgentOptions {
  const named = envName.trim();
  const checkedOutRepos = repos.flatMap((repo) =>
    typeof repo === "string"
      ? repo
        ? [{ url: repo }]
        : []
      : repo.url
        ? [repo]
        : [],
  );
  return named
    ? { env: { type: "cloud", name: named } }
    : { env: { type: "cloud" }, repos: checkedOutRepos };
}

function urlEnvVars(input: {
  legacyBaseUrl?: string;
  targetBaseUrl?: string;
}): Record<string, string> {
  return Object.fromEntries(
    [
      ["CURAL_LEGACY_BASE_URL", input.legacyBaseUrl?.trim()],
      ["CURAL_TARGET_BASE_URL", input.targetBaseUrl?.trim()],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

async function startCloudRun(input: {
  name: string;
  envName: string;
  repos: RepoInput[];
  prompt: string;
  requestKey?: string;
  envVars?: Record<string, string>;
  metadata: Record<string, string>;
}): Promise<{ agentId: string; runId: string }> {
  const agent = await Agent.create({
    apiKey: requireApiKey(),
    model: MODEL,
    name: input.name,
    cloud: {
      ...cloudOptions(input.envName, input.repos),
      metadata: input.metadata,
      autoCreatePR: false,
      ...(input.envVars && Object.keys(input.envVars).length
        ? { envVars: input.envVars }
        : {}),
    },
  });
  try {
    const run = await agent.send(input.prompt, {
      idempotencyKey: input.requestKey,
    });
    return { agentId: agent.agentId, runId: run.id };
  } finally {
    agent.close();
  }
}

export function startResearch(input: {
  envName: string;
  legacyRepo: string;
  legacyRef: string;
  legacyBaseUrl: string;
  prompt: string;
  requestKey?: string;
}) {
  return startCloudRun({
    name: "Cural research",
    envName: input.envName,
    repos: [{
      url: input.legacyRepo,
      startingRef: input.legacyRef || undefined,
    }],
    prompt: researchPrompt(input),
    requestKey: input.requestKey,
    envVars: urlEnvVars(input),
    metadata: { workflow: "research" },
  });
}

export function startPlan(input: {
  envName: string;
  legacyRepo: string;
  legacyRef: string;
  targetRepo: string;
  targetRef: string;
  prompt: string;
  research: ResearchReport;
  researchDocument: string;
  requestKey?: string;
}) {
  return startCloudRun({
    name: "Cural implementation plan",
    envName: input.envName,
    repos: [
      { url: input.legacyRepo, startingRef: input.legacyRef || undefined },
      { url: input.targetRepo, startingRef: input.targetRef || undefined },
    ],
    prompt: planPrompt(input),
    requestKey: input.requestKey,
    metadata: { workflow: "plan" },
  });
}

export function startImplement(input: {
  envName: string;
  legacyRepo: string;
  legacyRef: string;
  targetRepo: string;
  targetRef: string;
  targetBaseUrl: string;
  fixtureCommand: string;
  prompt: string;
  plan: ImplementationPlanReport;
  planDocument: string;
  snapshot: MigrationSnapshot;
  requestKey?: string;
}) {
  const executionBranch =
    input.snapshot.executionBranch || executionBranchName(input.snapshot.id);
  return startCloudRun({
    name: "Cural implement and verify",
    envName: input.envName,
    repos: [
      { url: input.legacyRepo, startingRef: input.legacyRef || undefined },
      { url: input.targetRepo, startingRef: input.targetRef || undefined },
    ],
    prompt: implementPrompt({
      ...input,
      executionBranch,
      components: input.snapshot.toBe.nodes,
    }),
    requestKey: input.requestKey,
    envVars: urlEnvVars(input),
    metadata: {
      workflow: "implement",
      snapshotId: input.snapshot.id,
    },
  });
}

export async function listAgentArtifacts(agentId: string) {
  if (!isCloudAgentId(agentId)) return [];
  const agent = await Agent.resume(agentId, { apiKey: requireApiKey() });
  try {
    return (await agent.listArtifacts()).map((artifact) => ({
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
  const relative = artifactBasename(path);
  if (!relative || relative.includes("..") || relative.startsWith("/")) {
    throw new Error("Invalid artifact path");
  }
  const agent = await Agent.resume(agentId, { apiKey: requireApiKey() });
  try {
    const artifacts = await agent.listArtifacts();
    const listed = artifacts.find(
      (artifact) =>
        artifact.path === path ||
        artifact.path === relative ||
        artifactBasename(artifact.path) === relative,
    );
    if (!listed) {
      throw new Error("Artifact not found on agent");
    }
    const buffer = await agent.downloadArtifact(listed.path);
    const lower = path.toLowerCase();
    const contentType = lower.endsWith(".md")
      ? "text/markdown; charset=utf-8"
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : /\.(mp4|webm|mov|m4v)$/i.test(path)
            ? videoContentType(path)
            : "application/octet-stream";
    return { buffer, contentType };
  } finally {
    agent.close();
  }
}

async function readAgentArtifactText(agentId: string, path: string) {
  const { buffer } = await downloadAgentArtifact(agentId, path);
  return buffer.toString("utf8");
}

async function hydrateResearchDocument(
  agentId: string,
  artifacts: Awaited<ReturnType<typeof listAgentArtifacts>>,
  result: ResearchRunResult,
): Promise<ResearchRunResult> {
  if (!isStubResearchDocument(result.document.content)) return result;
  const plan = artifacts.find((artifact) =>
    artifactBasename(artifact.path).endsWith("research-plan.md"),
  );
  if (!plan) return result;
  try {
    const content = redactSecrets(await readAgentArtifactText(agentId, plan.path));
    return content.trim()
      ? { ...result, document: { ...result.document, content } }
      : result;
  } catch {
    return result;
  }
}

async function extractResearchFromArtifacts(
  agentId: string,
  artifacts: Awaited<ReturnType<typeof listAgentArtifacts>>,
): Promise<ResearchRunResult | null> {
  const reports = artifacts.filter((artifact) =>
    artifactBasename(artifact.path).endsWith("cural-research-report.json"),
  );
  for (const artifact of reports) {
    try {
      const extracted = extractResearchResult(
        await readAgentArtifactText(agentId, artifact.path),
      );
      if (extracted) {
        return hydrateResearchDocument(agentId, artifacts, extracted);
      }
    } catch {
      // Try the next matching report artifact.
    }
  }
  return null;
}

async function hydratePlanDocument(
  agentId: string,
  artifacts: Awaited<ReturnType<typeof listAgentArtifacts>>,
  result: PlanRunResult,
): Promise<PlanRunResult> {
  if (!isStubPlanDocument(result.document.content)) return result;
  const plan = artifacts.find((artifact) =>
    artifactBasename(artifact.path).endsWith("implementation-plan.md"),
  );
  if (!plan) return result;
  try {
    const content = redactSecrets(await readAgentArtifactText(agentId, plan.path));
    return content.trim()
      ? { ...result, document: { ...result.document, content } }
      : result;
  } catch {
    return result;
  }
}

async function extractPlanFromArtifacts(
  agentId: string,
  artifacts: Awaited<ReturnType<typeof listAgentArtifacts>>,
  research: ResearchReport,
): Promise<PlanRunResult | null> {
  const reports = artifacts.filter((artifact) =>
    artifactBasename(artifact.path).endsWith("cural-plan-report.json"),
  );
  for (const artifact of reports) {
    try {
      const extracted = extractPlanResult(
        await readAgentArtifactText(agentId, artifact.path),
        research,
      );
      if (extracted) {
        return hydratePlanDocument(agentId, artifacts, extracted);
      }
    } catch {
      // Try the next matching report artifact.
    }
  }
  return null;
}

export async function pollRun(input: {
  agentId: string;
  runId: string;
  kind: "research" | "plan" | "implement";
  research?: ResearchReport;
  plan?: ImplementationPlanReport;
}): Promise<{
  status: string;
  result?: string;
  error?: string;
  researchResult?: ResearchRunResult;
  planResult?: PlanRunResult;
  implementationResult?: ImplementRunResult;
  nodeStatus?: Record<string, NodeStatus>;
  artifacts?: Awaited<ReturnType<typeof listAgentArtifacts>>;
  branches?: RunBranch[];
}> {
  const artifacts = await listAgentArtifacts(input.agentId);
  if (input.kind === "research" && input.runId === RECOVER_RUN_ID) {
    const researchResult = await extractResearchFromArtifacts(
      input.agentId,
      artifacts,
    );
    if (!researchResult) {
      return { status: "error", error: "Research finished without a valid report" };
    }
    return {
      status: "FINISHED",
      researchResult: {
        ...researchResult,
        graph: layoutGraph(researchResult.graph),
      },
      artifacts,
      branches: [],
    };
  }
  if (input.kind === "plan" && input.runId === RECOVER_RUN_ID) {
    if (!input.research) {
      return { status: "error", error: "Research context is required to parse the plan" };
    }
    const planResult = await extractPlanFromArtifacts(
      input.agentId,
      artifacts,
      input.research,
    );
    if (!planResult) {
      return { status: "error", error: "Plan finished without a valid report" };
    }
    return {
      status: "FINISHED",
      planResult: { ...planResult, graph: layoutGraph(planResult.graph) },
      artifacts,
      branches: [],
    };
  }

  const run = await Agent.getRun(input.runId, {
    runtime: "cloud",
    agentId: input.agentId,
    apiKey: requireApiKey(),
  });
  const text = run.result ?? "";
  const result = redactSecrets(text);
  const branches = runBranches(run.git);
  const stepIds =
    input.plan?.phases.flatMap((phase) => phase.steps.map((step) => step.id)) ??
    [];
  const nodeStatus =
    input.kind === "implement" ? extractProgress(text, stepIds) : undefined;

  if (run.status === "running") {
    return { status: "running", result, nodeStatus, branches };
  }
  if (run.status === "error" || run.status === "cancelled") {
    return {
      status: run.status,
      result,
      error: run.error?.message ?? `Run ${run.status}`,
      nodeStatus,
      branches,
    };
  }

  if (input.kind === "research") {
    const researchResult =
      extractResearchResult(text) ??
      (await extractResearchFromArtifacts(input.agentId, artifacts));
    const hydrated = researchResult
      ? await hydrateResearchDocument(input.agentId, artifacts, researchResult)
      : null;
    if (!hydrated) {
      return { status: "error", error: "Research finished without a valid report" };
    }
    return {
      status: run.status,
      result,
      researchResult: {
        ...hydrated,
        graph: layoutGraph(hydrated.graph),
      },
      artifacts,
      branches,
    };
  }
  if (input.kind === "plan") {
    if (!input.research) {
      return { status: "error", error: "Research context is required to parse the plan" };
    }
    const planResult =
      extractPlanResult(text, input.research) ??
      (await extractPlanFromArtifacts(input.agentId, artifacts, input.research));
    const hydrated = planResult
      ? await hydratePlanDocument(input.agentId, artifacts, planResult)
      : null;
    if (!hydrated) {
      return { status: "error", error: "Plan finished without a valid report" };
    }
    return {
      status: run.status,
      result,
      planResult: { ...hydrated, graph: layoutGraph(hydrated.graph) },
      artifacts,
      branches,
    };
  }
  if (!input.plan) {
    return { status: "error", error: "Approved plan is required to parse implementation" };
  }
  const implementationResult = extractImplementationResult(text, input.plan);
  if (!implementationResult) {
    return {
      status: "error",
      error: "Implementation finished without a valid report",
      artifacts,
      branches,
    };
  }
  const recordingPath = implementationResult.report.recording?.path;
  if (
    implementationResult.report.status === "passed" &&
    (!recordingPath ||
      !artifacts.some((artifact) => artifact.path === recordingPath))
  ) {
    implementationResult.report.status = "failed";
    return {
      status: "error",
      error: "Implementation report referenced a missing recording artifact",
      implementationResult,
      artifacts,
      branches,
    };
  }
  return {
    status:
      implementationResult.report.status === "passed" ? run.status : "error",
    result,
    error:
      implementationResult.report.status === "passed"
        ? undefined
        : "Modern verification gates did not pass",
    implementationResult,
    nodeStatus,
    artifacts,
    branches,
  };
}

// Backwards-compatible export used by older tests.
export const evaluationEnvVars = urlEnvVars;
