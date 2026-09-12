import { NextResponse } from "next/server";
import { getArchiveStore } from "@/lib/archive/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const archive = await getArchiveStore().get(id);
    if (!archive) {
      return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }
    return NextResponse.json({ archive });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
