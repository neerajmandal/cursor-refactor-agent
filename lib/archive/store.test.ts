import { afterEach, expect, test } from "vitest";
import { getArchiveStore } from "@/lib/archive/store";

afterEach(() => {
  delete process.env.VERCEL;
  delete process.env.DATABASE_URL;
});

test("refuses the local disk store on Vercel without DATABASE_URL", () => {
  process.env.VERCEL = "1";
  delete process.env.DATABASE_URL;
  expect(() => getArchiveStore()).toThrow(/DATABASE_URL is not set/);
});
