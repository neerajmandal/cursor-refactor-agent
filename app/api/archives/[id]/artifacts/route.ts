import { NextResponse } from "next/server";
import { getArchiveStore } from "@/lib/archive/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const path = new URL(request.url).searchParams.get("path")?.trim();
    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }
    const artifact = await getArchiveStore().getArtifact(id, path);
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(artifact.buffer), {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Length": String(artifact.buffer.byteLength),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${artifact.label}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    const status = message.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
