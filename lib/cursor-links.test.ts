import { expect, test } from "vitest";
import {
  cursorDesktopUrl,
  cursorWebUrl,
  formatCursorChatIdea,
} from "@/lib/cursor-links";

test("formats a pasteable Cursor chat idea", () => {
  expect(
    formatCursorChatIdea({
      envName: "inds-support-agent",
      prompt: "Keep ask-a-question parity. Drop the saga bus.",
      legacyRepo: "https://github.com/acme/legacy",
      targetRepo: "https://github.com/acme/target",
    }),
  ).toBe(
    [
      "inds-support-agent",
      "",
      "Keep ask-a-question parity. Drop the saga bus.",
      "",
      "Legacy: https://github.com/acme/legacy",
      "Target: https://github.com/acme/target",
    ].join("\n"),
  );
});

test("builds Cursor agent URLs", () => {
  expect(cursorWebUrl("bc-abc")).toBe("https://cursor.com/agents/bc-abc");
  expect(cursorDesktopUrl("bc-abc")).toBe(
    "cursor://anysphere.cursor-deeplink/background-agent?bcId=bc-abc",
  );
});
