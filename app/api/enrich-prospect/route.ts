import { NextRequest, NextResponse } from "next/server";

// ── HTML helpers ──────────────────────────────────────────────────────────────

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

// ── DuckDuckGo search (server-side) ──────────────────────────────────────────

async function ddgSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=fr-fr`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        Referer: "https://duckduckgo.com/",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function decodeUddg(html: string): string[] {
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  const re = /uddg=([^"&\s]+)/g;
  while ((m = re.exec(html)) !== null) {
    try { urls.push(decodeURIComponent(m[1])); } catch {}
  }
  return urls;
}

// ── Website auto-find ─────────────────────────────────────────────────────────

const SOCIAL = [
  "instagram.com","facebook.com","twitter.com","x.com","linkedin.com",
  "pinterest.com","tiktok.com","youtube.com","amazon.","etsy.com",
  "duckduckgo.com","google.com","bing.com","wikipedia.org",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function probeUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
    });
    if (r.ok || r.status === 405 || r.status === 403) {
      return new URL(r.url).hostname;
    }
  } catch {}
  return "";
}

async function autoFindWebsite(brandName: string): Promise<string> {
  const slug = normalize(brandName);
  if (!slug) return "";

  // 1. Guess common domains (fast)
  const candidates = [
    `https://${slug}.com`,
    `https://${slug}.fr`,
    `https://www.${slug}.com`,
    `https://www.${slug}.fr`,
    `https://${slug}.co`,
  ];
  for (const c of candidates) {
    const found = await probeUrl(c);
    if (found) return found;
  }

  // 2. DuckDuckGo fallback
  const html = await ddgSearch(`"${brandName}" boutique officielle -site:instagram.com -site:facebook.com`);
  for (const url of decodeUddg(html)) {
    try {
      const host = new URL(url).hostname;
      if (!SOCIAL.some((s) => host.includes(s))) return host;
    } catch {}
  }
  return "";
}

// ── Instagram auto-find ───────────────────────────────────────────────────────

const IG_SKIP = ["p", "explore", "accounts", "stories", "reels", "tv", "about", "directory", "legal"];

async function autoFindInstagram(brandName: string): Promise<string> {
  const html = await ddgSearch(`"${brandName}" site:instagram.com`);
  if (!html) return "";

  // Prefer decoded UDDG URLs (most reliable)
  for (const url of decodeUddg(html)) {
    const m = url.match(/instagram\.com\/([A-Za-z0-9_.]{2,40})\/?(?:$|\?)/);
    if (m && !IG_SKIP.includes(m[1].toLowerCase())) return m[1];
  }
  // Fallback: scan raw HTML for instagram.com/handle patterns
  let igm: RegExpExecArray | null;
  const igRe = /instagram\.com\/([A-Za-z0-9_.]{2,40})(?:\/|"|'|\s|&)/g;
  while ((igm = igRe.exec(html)) !== null) {
    if (!IG_SKIP.includes(igm[1].toLowerCase())) return igm[1];
  }
  return "";
}

// ── Instagram followers fetch ─────────────────────────────────────────────────

async function fetchInstagramFollowers(handle: string): Promise<string> {
  if (!handle) return "Non disponible";
  try {
    const res = await fetch(`https://www.instagram.com/${handle}/`, {
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
    const desc = extractMeta(html, "description");
    const m =
      desc.match(/([\d,.KkMm ]+)\s*[Ff]ollowers/i) ??
      desc.match(/([\d,.KkMm ]+)\s*abonnés/i);
    return m ? `@${handle} · ${m[1].trim()} abonnés` : `@${handle}`;
  } catch {
    return `@${handle}`;
  }
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let brandName: string;
  let domain: string;
  let instagramHandle: string;

  try {
    const body = await req.json();
    brandName       = String(body.brandName       ?? "").trim();
    domain          = String(body.domain          ?? "").trim();
    instagramHandle = String(body.instagramHandle ?? "").trim().replace(/^@/, "");
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!brandName && !domain && !instagramHandle) {
    return NextResponse.json({ error: "at least one param required" }, { status: 400 });
  }

  // Basic SSRF guard
  function isSafeHost(host: string): boolean {
    return (
      host !== "localhost" &&
      !host.startsWith("127.") &&
      !host.startsWith("192.168.") &&
      !host.startsWith("10.") &&
      !host.startsWith("172.16.") &&
      !host.endsWith(".local")
    );
  }

  // ── Auto-find missing fields ───────────────────────────────────────────────

  let websiteFound = "";
  let instagramHandleFound = "";

  const [autoWebsite, autoHandle] = await Promise.all([
    domain || !brandName ? Promise.resolve("") : autoFindWebsite(brandName),
    instagramHandle || !brandName ? Promise.resolve("") : autoFindInstagram(brandName),
  ]);

  if (!domain && autoWebsite) {
    domain = autoWebsite;
    websiteFound = autoWebsite;
  }
  if (!instagramHandle && autoHandle) {
    instagramHandle = autoHandle;
    instagramHandleFound = autoHandle;
  }

  // ── Fetch homepage ─────────────────────────────────────────────────────────

  let html = "";
  if (domain) {
    let url = domain.startsWith("http") ? domain : `https://${domain}`;
    try {
      const parsed = new URL(url);
      if (!isSafeHost(parsed.hostname)) {
        return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
      }
      url = parsed.toString();
    } catch {
      return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
    }
    try {
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
    } catch {
      // non-fatal: continue with empty html
    }
  }

  const shopify = detectShopify(html);
  const klaviyo = detectKlaviyo(html);
  const description = extractMeta(html, "description").slice(0, 250);

  const instagram = await fetchInstagramFollowers(instagramHandle);

  return NextResponse.json({
    platform: domain ? (shopify ? "Shopify ✅" : "Autre plateforme") : "Non analysé",
    klaviyo:  domain ? (klaviyo ? "Klaviyo ✅" : "Pas de Klaviyo ❌") : "Non analysé",
    klaviyoDetected: klaviyo,
    shopifyDetected: shopify,
    description,
    instagram,
    updatedAt: new Date().toISOString(),
    websiteFound,
    instagramHandleFound,
  });
}
