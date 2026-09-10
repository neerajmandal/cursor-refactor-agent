export type SpecFieldKey =
  | "purpose"
  | "interface"
  | "owns"
  | "dependsOn"
  | "portFrom"
  | "outOfScope"
  | "doneWhen";

export type ComponentSpec = Record<SpecFieldKey, string>;

export const SPEC_FIELDS: { key: SpecFieldKey; label: string }[] = [
  { key: "purpose", label: "Purpose" },
  { key: "interface", label: "Interface" },
  { key: "owns", label: "Owns" },
  { key: "dependsOn", label: "Depends on" },
  { key: "portFrom", label: "Port from" },
  { key: "outOfScope", label: "Out of scope" },
  { key: "doneWhen", label: "Done when" },
];

export const EMPTY_SPEC: ComponentSpec = {
  purpose: "",
  interface: "",
  owns: "",
  dependsOn: "",
  portFrom: "",
  outOfScope: "",
  doneWhen: "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function parseSpec(value: unknown): ComponentSpec {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ...EMPTY_SPEC };
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (asRecord(parsed)) return parseSpec(parsed);
    } catch {
      // Keep as a single purpose block for older freeform specs.
    }
    return { ...EMPTY_SPEC, purpose: clampWords(trimmed) };
  }

  const record = asRecord(value);
  if (!record) return { ...EMPTY_SPEC };

  return {
    purpose: clampWords(stringField(record, ["purpose", "summary", "goal"])),
    interface: stringField(record, ["interface", "publicInterface", "api"]),
    owns: stringField(record, ["owns", "ownership"]),
    dependsOn: stringField(record, ["dependsOn", "depends_on", "dependencies"]),
    portFrom: stringField(record, ["portFrom", "port_from", "legacy"]),
    outOfScope: stringField(record, ["outOfScope", "out_of_scope", "not"]),
    doneWhen: stringField(record, ["doneWhen", "done_when", "acceptance"]),
  };
}

function stringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const lines = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      if (lines.length) return lines.join("\n");
    }
  }
  return "";
}

export const PURPOSE_WORD_LIMIT = 200;

export function wordCount(text: string): number {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.length;
}

export function clampWords(text: string, max = PURPOSE_WORD_LIMIT): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length <= max) return trimmed;
  return words.slice(0, max).join(" ");
}

export function skimLines(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) =>
      line.includes(";")
        ? line.split(";").map((part) => part.trim())
        : [line],
    )
    .map((line) => line.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);
}

function splitNumbered(text: string): string[] {
  const chunks = text
    .split(/\(\d+\)\s*/)
    .map((chunk) => chunk.replace(/[;.\s]+$/, "").trim())
    .filter(Boolean);
  return chunks.length >= 2 ? chunks : [];
}

function indexOfLabel(text: string, label: string): number {
  return text.toLowerCase().indexOf(label.toLowerCase());
}

function sentencesOf(text: string): string[] {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\.\s+(?=[A-Z])/)
    .map((part) => {
      const sentence = part.trim();
      if (!sentence) return "";
      return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    })
    .filter(Boolean);
}

export function skimPurpose(text: string): {
  lead: string;
  steps: string[];
  notes: string[];
} {
  const clamped = clampWords(text);
  if (!clamped) return { lead: "", steps: [], notes: [] };

  const flowAt = indexOfLabel(clamped, "Flow:");
  const interfaceAt = indexOfLabel(clamped, "Public interface:");
  const cutAt = [interfaceAt, flowAt].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  const intro = (cutAt === undefined ? clamped : clamped.slice(0, cutAt)).trim();

  let flowBody = "";
  let afterFlow = "";
  if (flowAt >= 0) {
    const rest = clamped.slice(flowAt + "Flow:".length).trim();
    const stop = rest.search(/\s+(?=On |Does not |Port |Enforce )/i);
    if (stop === -1) {
      flowBody = rest;
    } else {
      flowBody = rest.slice(0, stop).trim();
      afterFlow = rest.slice(stop).trim();
    }
  }

  const steps = splitNumbered(flowBody);
  const introSentences = sentencesOf(intro);
  return {
    lead: introSentences[0] ?? intro,
    steps,
    notes: [...introSentences.slice(1), ...sentencesOf(afterFlow)],
  };
}

export function formatSpec(spec: ComponentSpec): string {
  return SPEC_FIELDS.filter((field) => spec[field.key].trim())
    .map((field) => `${field.label}\n${spec[field.key].trim()}`)
    .join("\n\n");
}

export function specEquals(a: ComponentSpec, b: ComponentSpec): boolean {
  return SPEC_FIELDS.every((field) => a[field.key] === b[field.key]);
}
