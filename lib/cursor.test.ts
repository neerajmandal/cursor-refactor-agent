import { describe, expect, it } from "vitest";
import { cloudOptions, evaluationEnvVars } from "@/lib/cursor";

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
});
