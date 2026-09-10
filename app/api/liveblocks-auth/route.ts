import { NextResponse } from "next/server";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("not set") ? 500 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { Liveblocks } = await import("@liveblocks/node");
  const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "LIVEBLOCKS_SECRET_KEY is not set" },
      { status: 500 },
    );
  }

  try {
    const { room, userId, name, color } = (await request.json()) as {
      room?: string;
      userId?: string;
      name?: string;
      color?: string;
    };
    if (!room) {
      return NextResponse.json({ error: "Missing room" }, { status: 400 });
    }

    const liveblocks = new Liveblocks({ secret });
    const session = liveblocks.prepareSession(userId || "anonymous", {
      userInfo: {
        name: name?.trim() || "Guest",
        color: color || "#c45c26",
      },
    });
    session.allow(room, session.FULL_ACCESS);
    const { status, body } = await session.authorize();
    return new NextResponse(body, { status });
  } catch (error) {
    return errorResponse(error, "Liveblocks auth failed");
  }
}
