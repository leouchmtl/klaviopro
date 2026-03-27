import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getProfile } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?error=gmail_denied`);
  }

  try {
    const redirectUri = `${origin}/api/auth/callback`;
    const tokens = await exchangeCode(code, redirectUri);

    // Get user email for display
    let email = "";
    try {
      const profile = await getProfile(tokens.access_token);
      email = profile.emailAddress;
    } catch { /* non-fatal */ }

    const expiry = Date.now() + tokens.expires_in * 1000;
    const response = NextResponse.redirect(`${origin}/settings?connected=1`);

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
    };

    if (tokens.refresh_token) {
      response.cookies.set("gmail_refresh_token", tokens.refresh_token, {
        ...cookieOpts,
        maxAge: 60 * 60 * 24 * 90, // 90 days
      });
    }
    response.cookies.set("gmail_access_token", tokens.access_token, {
      ...cookieOpts,
      maxAge: tokens.expires_in,
    });
    response.cookies.set("gmail_token_expiry", String(expiry), {
      ...cookieOpts,
      maxAge: tokens.expires_in,
    });
    response.cookies.set("gmail_user_email", email, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 90,
    });

    return response;
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(`${origin}/settings?error=gmail_failed`);
  }
}
