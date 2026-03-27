import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { fetchMessages } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    const messages = await fetchMessages(session.accessToken, email);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Gmail threads error:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
