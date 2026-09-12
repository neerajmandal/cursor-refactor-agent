import { afterEach, expect, test } from "vitest";
import {
  createSessionValue,
  isPublicPath,
  verifyPassword,
  verifySessionValue,
} from "@/lib/site-auth";

afterEach(() => {
  delete process.env.APP_PASSWORD;
  delete process.env.APP_SECRET;
});

test("public paths are login-only", () => {
  expect(isPublicPath("/login")).toBe(true);
  expect(isPublicPath("/api/login")).toBe(true);
  expect(isPublicPath("/projects")).toBe(false);
  expect(isPublicPath("/api/archives")).toBe(false);
});

test("password and session cookie verify", async () => {
  process.env.APP_PASSWORD = "shared-secret";
  process.env.APP_SECRET = "signing-secret";
  expect(await verifyPassword("wrong")).toBe(false);
  expect(await verifyPassword("shared-secret")).toBe(true);
  const session = await createSessionValue();
  expect(await verifySessionValue(session)).toBe(true);
  expect(await verifySessionValue(`${session}tampered`)).toBe(false);
});
