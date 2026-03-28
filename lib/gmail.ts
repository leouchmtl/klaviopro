// Gmail API helpers — pure functions, no Next.js dependencies

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_URL  = "https://oauth2.googleapis.com/token";
const AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function buildAuthUrl(redirectUri: string): string {
  return `${AUTH_URL}?${new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         GMAIL_SCOPES,
    access_type:   "offline",
    prompt:        "consent",
  })}`;
}

export interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Token exchange failed");
  return res.json();
}

export async function refreshToken(
  refreshTok: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token:  refreshTok,
      client_id:      process.env.GOOGLE_CLIENT_ID!,
      client_secret:  process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:     "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function gFetch(path: string, accessToken: string, opts?: RequestInit) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface GmailMsg {
  id:        string;
  date:      string;       // YYYY-MM-DD
  subject:   string;
  from:      string;
  snippet:   string;
  body:      string;       // decoded plain-text body
  direction: "envoyé" | "reçu";
}

function hdr(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch { return ""; }
}

function extractBody(payload: Record<string, unknown>): string {
  const body = payload.body as { data?: string } | undefined;
  if (body?.data) return decodeBase64url(body.data);

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    // Prefer text/plain
    for (const part of parts) {
      if (part.mimeType === "text/plain") {
        const pb = part.body as { data?: string } | undefined;
        if (pb?.data) return decodeBase64url(pb.data);
      }
    }
    // Recurse into nested multipart
    for (const part of parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return "";
}

function toDateStr(s: string): string {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch { return ""; }
}

export async function fetchMessages(
  accessToken: string,
  prospectEmail: string,
  maxResults = 20
): Promise<GmailMsg[]> {
  const q = `from:${prospectEmail} OR to:${prospectEmail}`;
  const list = await gFetch(
    `/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
    accessToken
  );
  if (!list.messages?.length) return [];

  const msgs: GmailMsg[] = await Promise.all(
    (list.messages as { id: string }[]).map(async ({ id }) => {
      const msg = await gFetch(
        `/users/me/messages/${id}?format=full`,
        accessToken
      );
      const h: { name: string; value: string }[] = msg.payload?.headers ?? [];
      const from = hdr(h, "From");
      const body = extractBody(msg.payload ?? {});
      return {
        id,
        date:      toDateStr(hdr(h, "Date")),
        subject:   hdr(h, "Subject"),
        from,
        snippet:   (msg.snippet as string) ?? "",
        body:      body.slice(0, 4000), // cap to avoid huge payloads
        direction: from.toLowerCase().includes(prospectEmail.toLowerCase())
          ? ("reçu" as const)
          : ("envoyé" as const),
      };
    })
  );

  return msgs.sort((a, b) => b.date.localeCompare(a.date));
}

function encodeSubject(subject: string): string {
  // RFC 2047: encode if non-ASCII characters are present
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

export async function sendMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string }> {
  // Fetch sender address so the From header is valid
  const profile = await getProfile(accessToken);
  const from = profile.emailAddress;

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gFetch("/users/me/messages/send", accessToken, {
    method: "POST",
    body: JSON.stringify({ raw: encoded }),
  });
}

export async function getProfile(
  accessToken: string
): Promise<{ emailAddress: string }> {
  return gFetch("/users/me/profile", accessToken);
}
