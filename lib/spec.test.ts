import { describe, expect, it } from "vitest";
import {
  SUBAGENT_SPEC_FIELD_CHARS,
  SUBAGENT_SPEC_PURPOSE_CHARS,
  clampSpecForSubagent,
} from "@/lib/spec";

describe("clampSpecForSubagent", () => {
  it("keeps a short spec intact", () => {
    const spec = {
      purpose: "Resolve a HelioDrive fault code for an operator.",
      interface: "resolveFault(code) -> FaultResponse",
      owns: "src/faults/service.ts",
      dependsOn: "FaultRepository",
      portFrom: "legacy/FaultCodeService",
      outOfScope: "Device telemetry ingestion",
      doneWhen: "Known fault returns operator guidance\nUnknown fault returns not-found",
    };
    expect(clampSpecForSubagent(spec)).toEqual(spec);
  });

  it("caps verbose fields before they inflate a custom subagent prompt", () => {
    const huge = Array.from({ length: 40 }, (_, index) => `line-${index} ${"x".repeat(80)}`).join("\n");
    const clamped = clampSpecForSubagent({
      purpose: `${"word ".repeat(300)}end`,
      interface: huge,
      owns: huge,
      dependsOn: huge,
      portFrom: huge,
      outOfScope: huge,
      doneWhen: huge,
    });

    expect(clamped.purpose.split(/\s+/).length).toBeLessThanOrEqual(200);
    expect(clamped.purpose.length).toBeLessThanOrEqual(SUBAGENT_SPEC_PURPOSE_CHARS);
    expect(clamped.interface.length).toBeLessThanOrEqual(SUBAGENT_SPEC_FIELD_CHARS);
    expect(clamped.owns.split("\n").length).toBeLessThanOrEqual(4);
    expect(clamped.doneWhen.split("\n").length).toBeLessThanOrEqual(6);
  });
});
