import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const del = { path: "/", maxAge: 0 };
  response.cookies.set("gmail_refresh_token", "", del);
  response.cookies.set("gmail_access_token",  "", del);
  response.cookies.set("gmail_token_expiry",  "", del);
  response.cookies.set("gmail_user_email",    "", del);
  return response;
}
