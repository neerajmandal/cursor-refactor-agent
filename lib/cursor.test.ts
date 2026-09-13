import { describe, expect, it } from "vitest";
import {
  cloudOptions,
  evaluationEnvVars,
} from "@/lib/cursor";
import { modernNeonTarget } from "@/lib/prompts";

describe("Cursor cloud environment options", () => {
  it("does not combine a named environment with explicit repos", () => {
    expect(
      cloudOptions("team-migration", [
        { url: "https://github.com/acme/legacy", startingRef: "main" },
      ]),
    ).toEqual({
      env: { type: "cloud", name: "team-migration" },
    });
  });

  it("uses explicit pinned repos when no environment is named", () => {
    expect(
      cloudOptions("", [
        { url: "https://github.com/acme/legacy", startingRef: "legacy-sha" },
        { url: "https://github.com/acme/target", startingRef: "target-sha" },
      ]),
    ).toEqual({
      env: { type: "cloud" },
      repos: [
        { url: "https://github.com/acme/legacy", startingRef: "legacy-sha" },
        { url: "https://github.com/acme/target", startingRef: "target-sha" },
      ],
    });
  });

  it("omits blank evaluation environment variables", () => {
    expect(
      evaluationEnvVars({
        legacyBaseUrl: "",
        targetBaseUrl: " https://target.example.com ",
      }),
    ).toEqual({
      CURAL_TARGET_BASE_URL: "https://target.example.com",
    });
  });

  it("injects only non-secret Neon branch expectations", () => {
    expect(
      evaluationEnvVars({
        legacyBaseUrl: "",
        targetBaseUrl: "",
        neonBranchName: " modern ",
        neonBranchId: " br-modern ",
        neonEndpointId: " ep-modern ",
      }),
    ).toEqual({
      CURAL_EXPECTED_NEON_BRANCH: "modern",
      CURAL_EXPECTED_NEON_BRANCH_ID: "br-modern",
      CURAL_EXPECTED_NEON_ENDPOINT_ID: "ep-modern",
    });
  });

  it("resolves the configured modern Neon target without credentials", () => {
    expect(
      modernNeonTarget({
        CURAL_MODERN_NEON_BRANCH: "modern-preview",
        CURAL_MODERN_NEON_BRANCH_ID: "br-preview",
        CURAL_MODERN_NEON_ENDPOINT_ID: "ep-preview",
      }),
    ).toEqual({
      branchName: "modern-preview",
      branchId: "br-preview",
      endpointId: "ep-preview",
    });
  });
});
