import { describe, expect, it } from "vitest";
import {
  PURPOSE_WORD_LIMIT,
  SPEC_DONE_WHEN_LINES,
  SPEC_FIELD_CHARS,
  SPEC_PURPOSE_CHARS,
  clampSpecForSubagent,
  formatSpecCompact,
  normalizeSpec,
  parseSpec,
} from "@/lib/spec";

const shortSpec = {
  purpose: "Resolve a HelioDrive fault code for an operator.",
  interface: "resolveFault(code) -> FaultResponse",
  owns: "src/faults/service.ts",
  dependsOn: "FaultRepository",
  portFrom: "legacy/FaultCodeService",
  outOfScope: "Device telemetry ingestion",
  doneWhen: "Known fault returns operator guidance\nUnknown fault returns not-found",
};

describe("normalizeSpec", () => {
  it("keeps a short spec intact", () => {
    expect(normalizeSpec(shortSpec)).toEqual(shortSpec);
    expect(clampSpecForSubagent(shortSpec)).toEqual(shortSpec);
    expect(parseSpec(shortSpec)).toEqual(shortSpec);
  });

  it("keeps only the lead from a purpose essay", () => {
    const spec = parseSpec({
      purpose:
        "Answers operator fault questions. Flow: (1) parse the code (2) look up guidance (3) retry the bus. Public interface: resolveFault(code).",
      interface: "resolveFault(code)",
      owns: "src/faults/service.ts",
      dependsOn: "FaultRepository",
      portFrom: "legacy/FaultCodeService",
      outOfScope: "Telemetry ingestion",
      doneWhen: "Returns guidance",
    });
    expect(spec.purpose).toBe("Answers operator fault questions.");
    expect(spec.purpose).not.toContain("Flow:");
    expect(spec.purpose).not.toContain("Public interface");
  });

  it("caps verbose fields before they inflate a custom subagent prompt", () => {
    const huge = Array.from({ length: 40 }, (_, index) => `line-${index} ${"x".repeat(80)}`).join("\n");
    const clamped = normalizeSpec({
      purpose: `${"word ".repeat(300)}end`,
      interface: huge,
      owns: huge,
      dependsOn: huge,
      portFrom: huge,
      outOfScope: huge,
      doneWhen: huge,
    });

    expect(clamped.purpose.split(/\s+/).length).toBeLessThanOrEqual(PURPOSE_WORD_LIMIT);
    expect(clamped.purpose.length).toBeLessThanOrEqual(SPEC_PURPOSE_CHARS);
    expect(clamped.interface.length).toBeLessThanOrEqual(SPEC_FIELD_CHARS);
    expect(clamped.owns.split("\n").length).toBeLessThanOrEqual(4);
    expect(clamped.doneWhen.split("\n").length).toBeLessThanOrEqual(SPEC_DONE_WHEN_LINES);
  });

  it("formats a compact target card", () => {
    expect(formatSpecCompact(shortSpec)).toBe(
      [
        "Purpose: Resolve a HelioDrive fault code for an operator.",
        "Interface: resolveFault(code) -> FaultResponse",
        "Owns: src/faults/service.ts",
        "Depends on: FaultRepository",
        "Port from: legacy/FaultCodeService",
        "Out of scope: Device telemetry ingestion",
        "Done when:",
        "  Known fault returns operator guidance",
        "  Unknown fault returns not-found",
      ].join("\n"),
    );
  });
});
