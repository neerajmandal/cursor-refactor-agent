export type DisplayType =
  | "Controller"
  | "Messaging"
  | "Orchestration"
  | "Consumer"
  | "Service"
  | "Router"
  | "Database"
  | "Job"
  | "Library"
  | "Component";

export type DisplayIcon =
  | "cube"
  | "list"
  | "branch"
  | "database"
  | "layers"
  | "search"
  | "sparkles"
  | "box";

const KIND_TYPE: Record<string, DisplayType> = {
  app: "Controller",
  lib: "Library",
  service: "Service",
  db: "Database",
  job: "Job",
  controller: "Controller",
  messaging: "Messaging",
  orchestration: "Orchestration",
  consumer: "Consumer",
  router: "Router",
};

export function displayTypeFor(label: string, kind?: string): DisplayType {
  const name = label.toLowerCase();
  if (name.includes("controller")) return "Controller";
  if (name.includes("bus") || name.includes("queue") || name.includes("broker")) {
    return "Messaging";
  }
  if (name.includes("saga") || name.includes("orchestr")) return "Orchestration";
  if (name.includes("consumer")) return "Consumer";
  if (name.includes("router")) return "Router";
  if (name.includes("retriev")) return "Service";
  if (name.includes("generat") || name.includes("answer")) return "Service";

  const mapped = kind ? KIND_TYPE[kind.toLowerCase()] : undefined;
  if (mapped) return mapped;
  return "Component";
}

export function displayIconFor(label: string, kind?: string): DisplayIcon {
  const name = label.toLowerCase();
  const type = displayTypeFor(label, kind);

  if (type === "Controller") return "cube";
  if (type === "Messaging") return "list";
  if (type === "Orchestration" || type === "Router") return "branch";
  if (type === "Consumer" || type === "Database") return "database";
  if (name.includes("retriev") || name.includes("search")) return "search";
  if (name.includes("generat") || name.includes("answer")) return "sparkles";
  if (type === "Service") return "layers";
  if (type === "Job") return "box";
  return "layers";
}
