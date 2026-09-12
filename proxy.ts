import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  sessionCookieName,
  sitePasswordConfigured,
  verifySessionValue,
} from "@/lib/site-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    !sitePasswordConfigured() ||
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const allowed = await verifySessionValue(request.cookies.get(sessionCookieName())?.value);
  if (allowed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
