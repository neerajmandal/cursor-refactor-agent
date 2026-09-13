import { describe, expect, it } from "vitest";
import {
  annotateSubagentPromptError,
  cloudOptions,
  customSubagentPromptSizes,
  evaluationEnvVars,
} from "@/lib/cursor";

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

  it("reports each custom subagent prompt length when create fails", () => {
    const agents = {
      "chat-controller": { prompt: "a".repeat(120) },
      "chat-service": { prompt: "b".repeat(80) },
    };
    expect(customSubagentPromptSizes(agents)).toBe(
      "chat-controller=120, chat-service=80",
    );
    const error = annotateSubagentPromptError(
      new Error("[validation_error] Custom subagent prompt is too long"),
      agents,
    );
    expect(error.message).toContain("[validation_error] Custom subagent prompt is too long");
    expect(error.message).toContain("chat-controller=120");
    expect(error.message).toContain("chat-service=80");
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
