import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { fetchMessages } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email   = searchParams.get("email");
  const brand   = searchParams.get("brand")   ?? undefined;
  const contact = searchParams.get("contact") ?? undefined;

  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    const messages = await fetchMessages(session.accessToken, {
      prospectEmail: email,
      brandName: brand,
      contactName: contact,
    });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Gmail threads error:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
