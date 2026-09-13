import { describe, expect, it } from "vitest";
import { executionPlan, formatExecutionTree } from "@/lib/execution";

const graph = {
  caption: "HTTP waits on ChatService.",
  nodes: [
    {
      id: "chat-controller",
      label: "ChatController",
      kind: "app",
      spec: { purpose: "HTTP entry", interface: "POST /ask", owns: "app/api", dependsOn: "ChatService", portFrom: "", outOfScope: "LLM", doneWhen: "Routes ask" },
    },
    {
      id: "chat-service",
      label: "ChatService",
      kind: "service",
      spec: { purpose: "Ask flow", interface: "ask()", owns: "chat/service.ts", dependsOn: "Store", portFrom: "", outOfScope: "HTTP", doneWhen: "Returns answer" },
    },
    {
      id: "chat-store",
      label: "ChatStore",
      kind: "lib",
      spec: { purpose: "Persist turns", interface: "saveTurn()", owns: "chat/store.ts", dependsOn: "", portFrom: "", outOfScope: "UI", doneWhen: "Writes Neon row" },
    },
  ],
  edges: [
    { from: "chat-controller", to: "chat-service" },
    { from: "chat-service", to: "chat-store" },
  ],
};

describe("executionPlan", () => {
  it("attaches target specs and parent/child links from the architecture tree", () => {
    const plan = executionPlan(graph);
    const controller = plan.components.find((item) => item.ref.id === "chat-controller");
    const service = plan.components.find((item) => item.ref.id === "chat-service");
    const store = plan.components.find((item) => item.ref.id === "chat-store");

    expect(plan.roots.map((item) => item.ref.id)).toEqual(["chat-controller"]);
    expect(controller?.childIds).toEqual(["chat-service"]);
    expect(service?.parentId).toBe("chat-controller");
    expect(service?.childIds).toEqual(["chat-store"]);
    expect(store?.parentId).toBe("chat-service");
    expect(store?.spec.interface).toBe("saveTurn()");
    expect(formatExecutionTree(plan)).toContain("ChatController [chat-controller] (root)");
    expect(formatExecutionTree(plan)).toContain("ChatStore [chat-store] (child)");
  });
});
