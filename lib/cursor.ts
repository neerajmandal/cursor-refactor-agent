import { Agent, Cursor, type AgentDefinition, type CloudAgentOptions } from "@cursor/sdk";
import { extractGraph, flattenAgentText, inferNodeStatus, layoutGraph, slugAgentName } from "@/lib/graph";
import { asIsPrompt, executePrompt, subagentPrompt, toBePrompt } from "@/lib/prompts";
import { isCloudAgentId, type Graph, type GraphNode, type NodeStatus } from "@/lib/types";

const MODEL = { id: "composer-2.5" } as const;

export function requireApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) {
    throw new Error("CURSOR_API_KEY is not set");
  }
  return key;
}

export function cloudOptions(envName: string, repos: string[]): CloudAgentOptions {
  const named = envName.trim();
  if (named) {
    return { env: { type: "cloud", name: named } };
  }
  return {
    env: { type: "cloud" },
    repos: repos.filter(Boolean).map((url) => ({ url })),
  };
}

export async function listRepos(): Promise<string[]> {
  const apiKey = requireApiKey();
  const repos = await Cursor.repositories.list({ apiKey });
  return repos.map((repo) => repo.url).filter(Boolean);
}

export async function startAnalyze(input: {
  phase: "as-is" | "to-be";
  envName: string;
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
  agentId?: string;
  regenerate?: boolean;
}): Promise<{ agentId: string; runId: string }> {
  const apiKey = requireApiKey();
  const message =
    input.phase === "as-is"
      ? asIsPrompt(input.legacyRepo, { redraw: Boolean(input.regenerate) })
      : toBePrompt(input.legacyRepo, input.targetRepo, input.prompt);

  if (isCloudAgentId(input.agentId)) {
    try {
      const agent = await Agent.resume(input.agentId!, { apiKey, model: MODEL });
      try {
        const run = await agent.send(message);
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
    cloud: cloudOptions(input.envName, [input.legacyRepo]),
  });
  try {
    const run = await agent.send(message);
    return { agentId: agent.agentId, runId: run.id };
  } finally {
    agent.close();
  }
}

export async function startExecute(input: {
  envName: string;
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
  components: GraphNode[];
}): Promise<{ agentId: string; runId: string }> {
  const apiKey = requireApiKey();
  const agents: Record<string, AgentDefinition> = {};
  const used = new Set<string>();

  input.components.forEach((node, index) => {
    let name = slugAgentName(node.id, index);
    if (used.has(name)) name = `${name}_${index + 1}`;
    used.add(name);
    agents[name] = {
      description: `Implement target component ${node.label} (${node.id}).`,
      prompt: subagentPrompt(node, input),
    };
  });

  const repos = [input.legacyRepo, input.targetRepo].filter(Boolean);
  const agent = await Agent.create({
    apiKey,
    model: MODEL,
    name: "Cural migration execute",
    cloud: {
      ...cloudOptions(input.envName, repos),
      autoCreatePR: true,
    },
    agents,
  });

  try {
    const run = await agent.send(executePrompt(input));
    return { agentId: agent.agentId, runId: run.id };
  } finally {
    agent.close();
  }
}

export async function pollRun(input: {
  agentId: string;
  runId: string;
  componentIds?: string[];
}): Promise<{
  status: string;
  result?: string;
  graph?: Graph;
  error?: string;
  nodeStatus?: Record<string, NodeStatus>;
}> {
  const apiKey = requireApiKey();
  const run = await Agent.getRun(input.runId, {
    runtime: "cloud",
    agentId: input.agentId,
    apiKey,
  });

  let conversation: unknown;
  if (run.supports("conversation")) {
    try {
      conversation = await run.conversation();
    } catch {
      conversation = undefined;
    }
  }

  const text = [run.result, flattenAgentText(conversation)].filter(Boolean).join("\n");
  const nodeStatus = input.componentIds?.length
    ? inferNodeStatus(conversation ?? text, input.componentIds)
    : undefined;

  if (run.status === "running") {
    return { status: run.status, result: text, nodeStatus };
  }

  if (run.status === "error" || run.status === "cancelled") {
    return {
      status: run.status,
      result: text,
      error: run.error?.message ?? `Run ${run.status}`,
      nodeStatus,
    };
  }

  let graph: Graph | undefined;
  try {
    if (text.trim()) {
      graph = layoutGraph(extractGraph(text));
    }
  } catch (error) {
    if (!input.componentIds) {
      return {
        status: "error",
        result: text,
        error: error instanceof Error ? error.message : "Failed to parse architecture JSON",
      };
    }
  }

  if (nodeStatus && run.status === "finished") {
    for (const id of input.componentIds ?? []) {
      if (nodeStatus[id] === "pending" || nodeStatus[id] === "running") {
        nodeStatus[id] = "done";
      }
    }
  }

  return { status: run.status, result: text, graph, nodeStatus };
}
