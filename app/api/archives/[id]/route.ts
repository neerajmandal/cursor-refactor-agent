import { NextResponse } from "next/server";
import { getArchiveStore } from "@/lib/archive/store";
import { deleteBoardRoom } from "@/lib/liveblocks-server";

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const removed = await getArchiveStore().remove(id);
    if (!removed) {
      return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }
    await deleteBoardRoom(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
