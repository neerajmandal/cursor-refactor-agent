import { NextResponse } from "next/server";
import { listRepos } from "@/lib/cursor";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repos = await listRepos();
    return NextResponse.json({ repos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list repos";
    return NextResponse.json({ error: message, repos: [] }, { status: 200 });
  }
}
