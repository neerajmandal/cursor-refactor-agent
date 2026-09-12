import { layoutGraph } from "@/lib/graph";
import type { Graph } from "@/lib/types";

/** Clean story diagrams — talk slides, not inventories. */
export const VISION_AS_IS: Graph = layoutGraph({
  caption: "HTTP waits on correlation_id. Every hop publishes an event.",
  nodes: [
    { id: "api", label: "ChatController", kind: "controller" },
    { id: "orchestrator", label: "ChatOrchestrator", kind: "orchestration" },
    { id: "domain-worker", label: "DomainWorker", kind: "consumer" },
    { id: "retrieval-worker", label: "RetrievalWorker", kind: "consumer" },
    { id: "generation-worker", label: "GenerationWorker", kind: "consumer" },
    { id: "result", label: "ResultHandler", kind: "service" },
  ],
  edges: [
    { from: "api", to: "orchestrator" },
    { from: "orchestrator", to: "domain-worker" },
    { from: "orchestrator", to: "retrieval-worker" },
    { from: "orchestrator", to: "generation-worker" },
    { from: "generation-worker", to: "result" },
  ],
});

export const VISION_TO_BE: Graph = layoutGraph({
  caption: "One ChatService call. No bus, no saga.",
  nodes: [
    { id: "api", label: "ChatController", kind: "controller" },
    { id: "service", label: "ChatService", kind: "service" },
    { id: "domain", label: "DomainRouter", kind: "router" },
    { id: "retrieval", label: "Retriever", kind: "service" },
    { id: "generation", label: "AnswerGenerator", kind: "service" },
  ],
  edges: [
    { from: "api", to: "service" },
    { from: "service", to: "domain" },
    { from: "service", to: "retrieval" },
    { from: "service", to: "generation" },
  ],
});

export type SystemAsset = {
  id: string;
  name: string;
  category:
    | "entrypoint"
    | "service"
    | "queue"
    | "database"
    | "external"
    | "auth"
    | "job"
    | "config";
  role: string;
  diagramNodeIds: string[];
};

export type RuntimeFlow = {
  id: string;
  title: string;
  path: string[];
  primary: boolean;
};

export type StructuralFinding = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  kind: "structural" | "cosmetic";
  status: "accepted" | "deferred" | "ignored";
  summary: string;
  evidence: string[];
  asIsNodeIds: string[];
  toBeImplication: string;
};

export type BaselineCheck = {
  id: string;
  label: string;
  status: "captured" | "missing" | "weak";
  detail: string;
};

/** Off-canvas truth — full inventory the clean diagram projects from. */
export const VISION_SYSTEM_ASSETS: SystemAsset[] = [
  {
    id: "chat-api",
    name: "ChatController",
    category: "entrypoint",
    role: "POST /chat — accepts question, waits on correlation_id",
    diagramNodeIds: ["api"],
  },
  {
    id: "masstransit",
    name: "MassTransit",
    category: "queue",
    role: "In-process bus publishing domain events",
    diagramNodeIds: ["orchestrator"],
  },
  {
    id: "service-bus",
    name: "Azure Service Bus",
    category: "queue",
    role: "Cross-worker transport for saga steps",
    diagramNodeIds: ["orchestrator", "domain-worker", "retrieval-worker", "generation-worker"],
  },
  {
    id: "orchestrator",
    name: "ChatOrchestrator",
    category: "service",
    role: "Saga coordinator; fans out to three workers",
    diagramNodeIds: ["orchestrator"],
  },
  {
    id: "domain-worker",
    name: "DomainWorker",
    category: "job",
    role: "Classifies question domain from bus message",
    diagramNodeIds: ["domain-worker"],
  },
  {
    id: "retrieval-worker",
    name: "RetrievalWorker",
    category: "job",
    role: "Loads documents for domain from SQL + blob",
    diagramNodeIds: ["retrieval-worker"],
  },
  {
    id: "generation-worker",
    name: "GenerationWorker",
    category: "job",
    role: "Calls OpenAI; publishes result event",
    diagramNodeIds: ["generation-worker"],
  },
  {
    id: "result-queue",
    name: "Result Queue",
    category: "queue",
    role: "Correlation completion topic for HTTP waiter",
    diagramNodeIds: ["result"],
  },
  {
    id: "sql",
    name: "SQL Server",
    category: "database",
    role: "Chat history, domain metadata, document index rows",
    diagramNodeIds: ["domain-worker", "retrieval-worker", "result"],
  },
  {
    id: "redis",
    name: "Redis",
    category: "database",
    role: "Saga state + correlation_id TTL",
    diagramNodeIds: ["orchestrator"],
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "external",
    role: "Answer generation API",
    diagramNodeIds: ["generation-worker"],
  },
  {
    id: "aad",
    name: "Entra ID",
    category: "auth",
    role: "Bearer validation on ChatController",
    diagramNodeIds: ["api"],
  },
  {
    id: "appsettings",
    name: "appsettings + Key Vault",
    category: "config",
    role: "Bus connection, model name, SQL creds",
    diagramNodeIds: [],
  },
];

export const VISION_FLOWS: RuntimeFlow[] = [
  {
    id: "ask-question",
    title: "Ask a question",
    primary: true,
    path: [
      "User",
      "ChatController",
      "MassTransit",
      "Service Bus",
      "Orchestrator",
      "DomainWorker",
      "RetrievalWorker",
      "GenerationWorker",
      "Result Queue",
      "HTTP response",
    ],
  },
  {
    id: "retry-generation",
    title: "Generation failure retry",
    primary: false,
    path: [
      "GenerationWorker",
      "OpenAI error",
      "Service Bus retry",
      "Result Queue (failed)",
      "HTTP 200 + generation_status=failed",
    ],
  },
];

export const VISION_FINDINGS: StructuralFinding[] = [
  {
    id: "unnecessary-pipeline",
    title: "Distributed queue pipeline for a sync request",
    severity: "high",
    kind: "structural",
    status: "accepted",
    summary:
      "Ask-a-question is a single user wait. MassTransit → Service Bus → three workers → result queue adds hops without an async product requirement.",
    evidence: [
      "ChatController blocks on correlation_id",
      "P95 latency dominated by queue wait, not model time",
      "No competing consumers beyond this saga",
    ],
    asIsNodeIds: ["orchestrator", "domain-worker", "retrieval-worker", "generation-worker", "result"],
    toBeImplication: "Collapse into ChatService.ask() on the request thread.",
  },
  {
    id: "scattered-sql",
    title: "SQL access scattered across workers",
    severity: "medium",
    kind: "structural",
    status: "accepted",
    summary:
      "Domain, retrieval, and result paths each open SQL with overlapping chat-history writes.",
    evidence: [
      "DomainWorker writes ChatSession",
      "RetrievalWorker reads DocumentIndex",
      "ResultHandler writes ChatMessage",
    ],
    asIsNodeIds: ["domain-worker", "retrieval-worker", "result"],
    toBeImplication: "Own persistence behind ChatService / store module.",
  },
  {
    id: "openai-coupling",
    title: "OpenAI calls inside GenerationWorker",
    severity: "medium",
    kind: "structural",
    status: "deferred",
    summary:
      "Vendor SDK and retry policy live in the worker, so swapping models requires touching saga wiring.",
    evidence: ["GenerationWorker constructs OpenAI client", "Retry policy duplicated from HTTP layer"],
    asIsNodeIds: ["generation-worker"],
    toBeImplication: "Isolate AnswerGenerator behind an interface (later PR).",
  },
  {
    id: "naming-noise",
    title: "Inconsistent consumer naming",
    severity: "low",
    kind: "cosmetic",
    status: "ignored",
    summary: "DomainConsumer vs DomainWorker labels — rename-only, does not drive target shape.",
    evidence: ["Folder naming drift in workers/"],
    asIsNodeIds: [],
    toBeImplication: "Do not block migration on renames.",
  },
];

export const VISION_BASELINE: BaselineCheck[] = [
  {
    id: "unit-suite",
    label: "Existing unit suite",
    status: "captured",
    detail: "142 passed · 0 failed on legacy main@a3f2c1",
  },
  {
    id: "journey-ask",
    label: "Journey: Ask a question",
    status: "captured",
    detail: "Fixtures + normalization frozen · POST /chat golden pair stored",
  },
  {
    id: "journey-fail",
    label: "Journey: Generation failure",
    status: "captured",
    detail: "Observes generation_status=failed without 5xx",
  },
  {
    id: "perf",
    label: "Latency baseline",
    status: "captured",
    detail: "P50 1.8s · P95 4.1s · error rate 0.4% (staging, n=200)",
  },
  {
    id: "coverage",
    label: "Characterization around saga",
    status: "weak",
    detail: "No direct tests for correlation timeout path — added sketch test",
  },
];

export const CATEGORY_LABEL: Record<SystemAsset["category"], string> = {
  entrypoint: "Entry points",
  service: "Services",
  queue: "Queues & buses",
  database: "Data stores",
  external: "External APIs",
  auth: "Auth",
  job: "Background jobs",
  config: "Configuration",
};
