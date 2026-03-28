import { NextRequest, NextResponse } from "next/server";

// ── Shared browser headers ─────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":  "fr-FR,fr;q=0.9,en;q=0.8",
  "Accept-Encoding":  "gzip, deflate, br",
  "Cache-Control":    "no-cache",
  "Pragma":           "no-cache",
};

// ── Error classification ───────────────────────────────────────────────────────

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("CERT") || msg.includes("SSL") || msg.includes("certificate") || msg.includes("self_signed"))
    return "Erreur certificat SSL";
  if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo") || msg.includes("EAI_AGAIN"))
    return "Domaine introuvable";
  if (msg.includes("TimeoutError") || msg.includes("AbortError") || msg.includes("timeout") || msg.includes("UND_ERR_CONNECT_TIMEOUT"))
    return "Site trop lent (timeout)";
  return `Erreur: ${msg.slice(0, 80)}`;
}

// ── Homepage fetch with fallbacks ─────────────────────────────────────────────

async function fetchHomepage(domain: string): Promise<{ html: string; error: string }> {
  const urls = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];
  let lastError = "";
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      if (res.status === 403 || res.status === 401) {
        lastError = "Site protégé contre le scan";
        continue;
      }
      if (res.ok) return { html: await res.text(), error: "" };
      lastError = `Erreur: HTTP ${res.status}`;
    } catch (err) {
      lastError = classifyError(err);
      if (lastError === "Domaine introuvable") break;
    }
  }
  return { html: "", error: lastError };
}

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
        ...BROWSER_HEADERS,
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
      headers: BROWSER_HEADERS,
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

  for (const url of decodeUddg(html)) {
    const m = url.match(/instagram\.com\/([A-Za-z0-9_.]{2,40})\/?(?:$|\?)/);
    if (m && !IG_SKIP.includes(m[1].toLowerCase())) return m[1];
  }
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
        "User-Agent":  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept":      "text/html,application/xhtml+xml",
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

// ── CA scraping ───────────────────────────────────────────────────────────────

type RevenueSource = "societe.com" | "manageo" | "pappers" | "estimé";

interface CaResult {
  amount: number;
  source: RevenueSource;
  year: string;
  raw: string;
}

async function fetchHtmlCA(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// Extract a euro amount from a raw text snippet
function parseEuroAmount(text: string): number | null {
  // "X,X M€" or "X M€"
  const mM = text.match(/(\d+[,.]?\d*)\s*M\s*[€EUReuro]/i);
  if (mM) return Math.round(parseFloat(mM[1].replace(",", ".")) * 1_000_000);
  // "X K€"
  const kM = text.match(/(\d+[,.]?\d*)\s*K\s*[€EUReuro]/i);
  if (kM) return Math.round(parseFloat(kM[1].replace(",", ".")) * 1_000);
  // Plain number with spaces/dots as thousand separator followed by €
  const plain = text.match(/([\d\s]{2,15})\s*€/);
  if (plain) {
    const n = parseInt(plain[1].replace(/[\s.]/g, ""));
    if (!isNaN(n) && n >= 1000) return n;
  }
  return null;
}

// Find a CA value near a keyword in a block of text
function extractCaFromText(text: string): { amount: number; year: string; raw: string } | null {
  // Look for "chiffre d'affaires", "ca :", "ca annuel" near a euro value
  const caRe = /chiffre\s+d['']affaires|(?:^|\s)CA\s*[:=]?(?:\s|$)/gim;
  let m: RegExpExecArray | null;
  while ((m = caRe.exec(text)) !== null) {
    const ctx = text.slice(m.index, m.index + 200);
    const amount = parseEuroAmount(ctx);
    if (amount && amount >= 10000) {
      const yearM = ctx.match(/20\d\d/);
      return { amount, year: yearM?.[0] ?? "", raw: ctx.replace(/\s+/g, " ").slice(0, 80) };
    }
  }
  return null;
}

function toBrandSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchCaFromSociete(brandName: string): Promise<CaResult | null> {
  const slug = toBrandSlug(brandName);
  const urls = [
    `https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(brandName)}`,
    `https://www.societe.com/societe/${slug}/`,
  ];
  for (const url of urls) {
    const html = await fetchHtmlCA(url);
    if (!html) continue;
    // Strip tags for easier parsing
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");
    const found = extractCaFromText(text);
    if (found) return { ...found, source: "societe.com" };
  }
  return null;
}

async function fetchCaFromManageo(brandName: string): Promise<CaResult | null> {
  const url = `https://www.manageo.fr/recherche?q=${encodeURIComponent(brandName)}`;
  const html = await fetchHtmlCA(url);
  if (!html) return null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const found = extractCaFromText(text);
  return found ? { ...found, source: "manageo" } : null;
}

async function fetchCaFromPappers(brandName: string): Promise<CaResult | null> {
  const url = `https://www.pappers.fr/recherche?q=${encodeURIComponent(brandName)}`;
  const html = await fetchHtmlCA(url);
  if (!html) return null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const found = extractCaFromText(text);
  return found ? { ...found, source: "pappers" } : null;
}

function parseIgFollowers(igStr: string): number {
  if (!igStr) return 0;
  const m = igStr.match(/([\d,.]+)\s*([KkMm]?)\s*abonnés/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, "."));
  const u = m[2].toLowerCase();
  if (u === "k") return n * 1000;
  if (u === "m") return n * 1_000_000;
  return n;
}

function estimateCaFromFollowers(igStr: string): CaResult | null {
  const followers = parseIgFollowers(igStr);
  if (followers <= 0) return null;
  let raw: string;
  let midpoint: number;
  if (followers < 5_000)        { raw = "< 150K€ estimé";         midpoint = 75_000;     }
  else if (followers < 20_000)  { raw = "150K€ - 500K€ estimé";   midpoint = 325_000;    }
  else if (followers < 100_000) { raw = "500K€ - 2M€ estimé";     midpoint = 1_250_000;  }
  else if (followers < 500_000) { raw = "2M€ - 10M€ estimé";      midpoint = 6_000_000;  }
  else                          { raw = "> 10M€ estimé";           midpoint = 15_000_000; }
  return { amount: midpoint, source: "estimé", year: "", raw };
}

async function fetchAnnualRevenue(brandName: string): Promise<CaResult | null> {
  if (!brandName) return null;
  for (const fetcher of [fetchCaFromSociete, fetchCaFromManageo, fetchCaFromPappers]) {
    try {
      const result = await fetcher(brandName);
      if (result) return result;
    } catch {}
  }
  return null;
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

  // ── Fetch homepage with fallbacks ──────────────────────────────────────────

  let html = "";
  let scanError = "";

  if (domain) {
    // Strip scheme if user pasted a full URL
    const rawDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    try {
      const parsed = new URL(`https://${rawDomain}`);
      if (!isSafeHost(parsed.hostname)) {
        return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
    }

    const result = await fetchHomepage(rawDomain);
    html = result.html;
    scanError = result.error;
  }

  const shopify = detectShopify(html);
  const klaviyo = detectKlaviyo(html);
  const description = extractMeta(html, "description").slice(0, 250);

  // Run Instagram fetch + CA scraping in parallel
  const [instagram, caFromScrape] = await Promise.all([
    fetchInstagramFollowers(instagramHandle),
    brandName ? fetchAnnualRevenue(brandName) : Promise.resolve(null),
  ]);

  // Fall back to follower-based estimation if scraping found nothing
  const ca = caFromScrape ?? (instagramHandle ? estimateCaFromFollowers(instagram) : null);

  // Partial success: if homepage blocked but other data was found, return what we have
  const homepageBlocked = !html && !!scanError;

  return NextResponse.json({
    platform:        domain
      ? (homepageBlocked ? "Non scannable" : shopify ? "Shopify ✅" : "Autre plateforme")
      : "Non analysé",
    klaviyo:         domain
      ? (homepageBlocked ? "Non scannable" : klaviyo ? "Klaviyo ✅" : "Pas de Klaviyo ❌")
      : "Non analysé",
    klaviyoDetected: klaviyo,
    shopifyDetected: shopify,
    description,
    instagram,
    updatedAt:       new Date().toISOString(),
    websiteFound,
    instagramHandleFound,
    annualRevenue:   ca?.amount    ?? null,
    revenueSource:   ca?.source    ?? "",
    revenueYear:     ca?.year      ?? "",
    revenueRaw:      ca?.raw       ?? "",
    ...(scanError ? { scanError } : {}),
  });
}
