import { NextRequest, NextResponse } from "next/server";

function extractMeta(html: string, name: string): string {
  const m =
    html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']{0,500})["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']{0,500})["'][^>]+name=["']${name}["']`, "i"));
  return m?.[1]?.trim() ?? "";
}

function detectShopify(html: string): boolean {
  return (
    html.includes("cdn.shopify.com") ||
    html.includes("Shopify.theme") ||
    html.includes("window.Shopify") ||
    html.includes("shopify_features")
  );
}

function detectKlaviyo(html: string): boolean {
  return (
    html.includes("klaviyo.com") ||
    html.includes("klaviyo.identify") ||
    html.includes("KlaviyoSubscribeForms") ||
    html.includes("_learnq")
  );
}

async function fetchInstagram(handle: string): Promise<string> {
  if (!handle) return "Non disponible";
  try {
    const url = `https://www.instagram.com/${handle}/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    if (!res.ok) return `@${handle}`;
    const html = await res.text();
    // Meta description often contains: "X Followers, Y Following, Z Posts"
    const desc = extractMeta(html, "description");
    const m =
      desc.match(/([\d,. K]+)\s*[Ff]ollowers/i) ??
      desc.match(/([\d,. K]+)\s*abonnés/i);
    if (m) return `@${handle} · ${m[1].trim()} abonnés`;
    return `@${handle}`;
  } catch {
    return `@${handle}`;
  }
}

export async function POST(req: NextRequest) {
  let domain: string;
  let instagramHandle: string;

  try {
    const body = await req.json();
    domain = String(body.domain ?? "").trim();
    instagramHandle = String(body.instagramHandle ?? "")
      .trim()
      .replace(/^@/, "");
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!domain && !instagramHandle) {
    return NextResponse.json(
      { error: "domain or instagramHandle required" },
      { status: 400 }
    );
  }

  // Normalize URL
  let url = domain;
  if (domain) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    // Basic SSRF guard
    try {
      const parsed = new URL(url);
      const h = parsed.hostname;
      if (
        h === "localhost" ||
        h.startsWith("127.") ||
        h.startsWith("192.168.") ||
        h.startsWith("10.") ||
        h.startsWith("172.16.") ||
        h.endsWith(".local")
      ) {
        return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
    }
  }

  try {
    let html = "";
    if (domain) {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      if (res.ok) html = await res.text();
    }

    const shopify = detectShopify(html);
    const klaviyo = detectKlaviyo(html);
    const description = extractMeta(html, "description").slice(0, 250);

    // Fetch Instagram in parallel (already kicked off above)
    const instagram = await fetchInstagram(instagramHandle);

    return NextResponse.json({
      platform: domain
        ? shopify
          ? "Shopify ✅"
          : "Autre plateforme"
        : "Non analysé",
      klaviyo: domain
        ? klaviyo
          ? "Klaviyo ✅"
          : "Pas de Klaviyo ❌"
        : "Non analysé",
      klaviyoDetected: klaviyo,
      description,
      instagram,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Enrich error:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
