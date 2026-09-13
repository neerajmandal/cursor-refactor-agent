const COOKIE_NAME = "cural_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function encoder() {
  return new TextEncoder();
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function appSecret(): string {
  return process.env.APP_SECRET?.trim() || process.env.APP_PASSWORD?.trim() || "cural-dev-secret";
}

export function sitePasswordConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/icon"
  );
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder().encode(appSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder().encode(value));
  return toHex(signature);
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = fromHex(left.length % 2 === 0 ? left : `${left}0`);
  const b = fromHex(right.length % 2 === 0 ? right : `${right}0`);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0 && left.length === right.length;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  const [left, right] = await Promise.all([hmac(`pw:${password}`), hmac(`pw:${expected}`)]);
  return timingSafeEqual(left, right);
}

export async function createSessionValue(): Promise<string> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionValue(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const match = value.match(/^(v1\.\d+)\.([a-f0-9]+)$/);
  if (!match) return false;
  const [, payload, signature] = match;
  const expires = Number(payload.slice(3));
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmac(payload);
  return timingSafeEqual(signature, expected);
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
