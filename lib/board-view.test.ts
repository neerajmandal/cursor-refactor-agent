import { describe, expect, it } from "vitest";
import { boardViewFromParam, boardViewHref } from "@/lib/board-view";

describe("board view URLs", () => {
  it("restores a valid selected tab and rejects unknown values", () => {
    expect(boardViewFromParam("evidence")).toBe("evidence");
    expect(boardViewFromParam(["cursor", "evidence"])).toBe("cursor");
    expect(boardViewFromParam("unknown")).toBe("architecture");
  });

  it("preserves other URL state while changing tabs", () => {
    expect(
      boardViewHref("https://cural.example/b/123?mode=live#work", "evidence"),
    ).toBe("/b/123?mode=live&view=evidence#work");
    expect(
      boardViewHref(
        "https://cural.example/b/123?mode=live&view=evidence#work",
        "architecture",
      ),
    ).toBe("/b/123?mode=live#work");
  });
});
