import { layoutGraph } from "@/lib/graph";
import type { Graph } from "@/lib/types";

export const SAMPLE_AS_IS: Graph = layoutGraph({
  caption: "HTTP waits on correlation_id. Every hop publishes an event.",
  nodes: [
    {
      id: "controller",
      label: "ChatController",
      kind: "controller",
      spec: {
        purpose: "Accepts the HTTP question and waits for the saga to finish.",
        interface: "POST /chat",
        owns: "ChatController",
        dependsOn: "In-process bus",
        portFrom: "chat/controller.py",
        outOfScope: "Domain routing and generation",
        doneWhen: "n/a",
      },
    },
    { id: "bus", label: "In-process bus", kind: "messaging" },
    {
      id: "saga",
      label: "ChatRequestSaga",
      kind: "orchestration",
      spec: {
        purpose: "Orchestrates domain, retrieval, and generation over the bus.",
        interface: "ChatRequestSaga.handle(event)",
        owns: "ChatRequestSaga",
        dependsOn: "Domain, retrieval, and generation consumers",
        portFrom: "chat/saga.py",
        outOfScope: "HTTP and persistence details",
        doneWhen: "n/a",
      },
    },
    { id: "domain", label: "DomainConsumer", kind: "consumer" },
    { id: "retrieval", label: "RetrievalConsumer", kind: "consumer" },
    { id: "generation", label: "GenerationConsumer", kind: "consumer" },
  ],
  edges: [
    { from: "controller", to: "bus" },
    { from: "bus", to: "saga" },
    { from: "saga", to: "domain" },
    { from: "saga", to: "retrieval" },
    { from: "saga", to: "generation" },
  ],
});

export const SAMPLE_TO_BE: Graph = layoutGraph({
  caption: "One ChatService call. No bus.",
  nodes: [
    {
      id: "controller",
      label: "ChatController",
      kind: "controller",
      spec: {
        purpose: "HTTP entry. Delegates to ChatService and returns ChatResponse.",
        interface: "POST /chat",
        owns: "api/chat_controller.py",
        dependsOn: "ChatService.ask",
        portFrom: "legacy ChatController",
        outOfScope: "Domain routing and generation",
        doneWhen: "Request returns ChatResponse without a bus",
      },
    },
    {
      id: "service",
      label: "ChatService",
      kind: "service",
      spec: {
        purpose:
          "Synchronous ChatService replacing ChatRequestSaga. ask() runs domain, retrieval, and generation in one call.",
        interface: "ask(question, domain_hint=None) -> ChatResponse",
        owns: "chat/service.py",
        dependsOn: "DomainRouter, Retriever, AnswerGenerator",
        portFrom: "ChatRequestSaga plus domain/retrieval/generation consumers",
        outOfScope: "HTTP, bus, SOAP",
        doneWhen:
          "ask() returns ChatResponse\nErrors set generation_status=failed\nHistory is persisted",
      },
    },
    {
      id: "domain",
      label: "DomainRouter",
      kind: "router",
      spec: {
        purpose: "Pick a domain for the question.",
        interface: "resolve(question, domain_hint) -> domain_id",
        owns: "chat/domain.py",
        dependsOn: "None",
        portFrom: "DomainConsumer",
        outOfScope: "Retrieval and generation",
        doneWhen: "Returns a domain_id for a known hint or classified question",
      },
    },
    {
      id: "retrieval",
      label: "Retriever",
      kind: "service",
      spec: {
        purpose: "Fetch documents for the domain.",
        interface: "retrieve(domain_id, question) -> documents",
        owns: "chat/retriever.py",
        dependsOn: "None",
        portFrom: "RetrievalConsumer",
        outOfScope: "Generation",
        doneWhen: "Returns documents for a domain_id",
      },
    },
    {
      id: "generation",
      label: "AnswerGenerator",
      kind: "service",
      spec: {
        purpose: "Write the answer with retry.",
        interface: "generate(question, documents) -> answer",
        owns: "chat/generator.py",
        dependsOn: "None",
        portFrom: "GenerationConsumer and ExponentialBackoffRetryPolicy",
        outOfScope: "HTTP and persistence",
        doneWhen: "generate() returns text or a typed failure",
      },
    },
  ],
  edges: [
    { from: "controller", to: "service" },
    { from: "service", to: "domain" },
    { from: "service", to: "retrieval" },
    { from: "service", to: "generation" },
  ],
});
