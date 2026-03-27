import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sendMessage } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const { to, subject, body } = (await request.json()) as {
    to: string; subject: string; body: string;
  };
  if (!to || !subject) {
    return NextResponse.json({ error: "to and subject required" }, { status: 400 });
  }

  try {
    const result = await sendMessage(session.accessToken, to, subject, body ?? "");
    return NextResponse.json({ id: result.id });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
