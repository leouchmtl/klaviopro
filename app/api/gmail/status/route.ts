import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const connected = Boolean(session?.accessToken && session.error !== "RefreshAccessTokenError");
  return NextResponse.json({
    connected,
    email: session?.user?.email ?? "",
  });
}
