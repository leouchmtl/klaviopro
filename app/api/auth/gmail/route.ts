import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;
  const url = buildAuthUrl(redirectUri);
  return NextResponse.redirect(url);
}
