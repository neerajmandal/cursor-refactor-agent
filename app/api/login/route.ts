import { NextResponse } from "next/server";
import {
  createSessionValue,
  sessionCookieName,
  sessionCookieOptions,
  sitePasswordConfigured,
  verifyPassword,
} from "@/lib/site-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sitePasswordConfigured()) {
    return NextResponse.json({ ok: true });
  }
  const body = (await request.json()) as { password?: string };
  if (!(await verifyPassword(body.password ?? ""))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), await createSessionValue(), sessionCookieOptions());
  return response;
}
