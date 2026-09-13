import { describe, expect, it } from "vitest";
import { boardViewFromParam, boardViewHref } from "@/lib/board-view";

describe("board view URLs", () => {
  it("restores a valid selected tab and rejects unknown values", () => {
    expect(boardViewFromParam("plan")).toBe("plan");
    expect(boardViewFromParam(["implement", "plan"])).toBe("implement");
    expect(boardViewFromParam("unknown")).toBe("research");
  });

  it("preserves other URL state while changing tabs", () => {
    expect(
      boardViewHref("https://cural.example/b/123?mode=live#work", "plan"),
    ).toBe("/b/123?mode=live&phase=plan#work");
    expect(
      boardViewHref(
        "https://cural.example/b/123?mode=live&phase=plan#work",
        "research",
      ),
    ).toBe("/b/123?mode=live#work");
  });
});
