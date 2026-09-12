import { NextResponse } from "next/server";
import { downloadAgentArtifact } from "@/lib/cursor";

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

    const { buffer, contentType } = await downloadAgentArtifact(id, path);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${path.split("/").pop() || "artifact"}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
