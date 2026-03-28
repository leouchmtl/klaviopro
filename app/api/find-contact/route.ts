import { NextRequest, NextResponse } from "next/server";

type Source = "mentions_légales" | "hunter" | "skrapp" | "apollo" | "about_page";
type Confidence = "élevée" | "moyenne" | "faible";

interface ContactResult {
  name: string;
  email: string;
  source: Source;
  confidence: Confidence;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// French-style name: 2–4 capitalized/accented words
const NAME_RE = /[A-ZÀ-Ÿ][a-zà-ÿ]+(?:[ -][A-ZÀ-Ÿ][a-zà-ÿ]+){1,3}/g;
const BRAND_NOISE = /(?:Boutique|Collection|Maison|Studio|Atelier|Marque|Société|Livraison|Retour|Contact|Service|Client|Politique|Mentions|Légales|Conditions|Général)/i;

function extractName(text: string): string | null {
  let m: RegExpExecArray | null;
  const re = new RegExp(NAME_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const name = m[0];
    if (!BRAND_NOISE.test(name) && name.split(" ").length >= 2) return name;
  }
  return null;
}

// ── Step 1: Mentions légales ──────────────────────────────────────────────────

const ML_PATHS = [
  "/mentions-legales",
  "/mentions_legales",
  "/mentions-légales",
  "/mentions-legales.html",
  "/mentions",
  "/legal",
  "/informations-legales",
  "/cgv",
];

const ML_PATTERNS = [
  /(?:Directeur|Directrice)\s+de\s+publication[^:\n]{0,30}:\s*(.{5,50})/i,
  /Responsable\s+(?:de\s+la\s+)?(?:publication|éditorial)[^:\n]{0,30}:\s*(.{5,50})/i,
  /Gérant(?:e)?[^:\n]{0,30}:\s*(.{5,50})/i,
  /Président(?:e)?[^:\n]{0,30}:\s*(.{5,50})/i,
  /S(?:AS|ARL|EURL?|NC|CS)[^:,.\n]{0,60}représentée?\s+par\s+(.{5,50})/i,
  /représentée?\s+par\s+(?:M\.?\s+|Mme\.?\s+|Monsieur\s+|Madame\s+)?(.{5,50})/i,
  /(?:Propriétaire|Éditeur)[^:\n]{0,20}:\s*(.{5,50})/i,
];

async function findFromMentionsLegales(base: string): Promise<ContactResult | null> {
  for (const path of ML_PATHS) {
    const html = await fetchHtml(base + path, 6000);
    if (!html) continue;
    const text = htmlToText(html);
    for (const pattern of ML_PATTERNS) {
      const m = text.match(pattern);
      if (m) {
        const raw = m[1].trim().split(/[\n|,]/)[0].trim();
        const name = extractName(raw);
        if (name) return { name, email: "", source: "mentions_légales", confidence: "élevée" };
      }
    }
  }
  return null;
}

// ── Step 2: About page ────────────────────────────────────────────────────────

const ABOUT_PATHS = [
  "/a-propos",
  "/about",
  "/about-us",
  "/notre-histoire",
  "/equipe",
  "/team",
  "/qui-sommes-nous",
  "/notre-equipe",
];

const FOUNDER_KWS =
  /fondatric|fondateur|fonder|CEO|Directeur(?:\s+général)?|DG|créatric|créateur|président(?:e)?|co.?founder|cofondateur/i;

async function findFromAboutPage(base: string): Promise<ContactResult | null> {
  for (const path of ABOUT_PATHS) {
    const html = await fetchHtml(base + path, 6000);
    if (!html) continue;
    const text = htmlToText(html);

    // Search in 250-char windows around founder keywords
    let m: RegExpExecArray | null;
    const kwRe = new RegExp(FOUNDER_KWS.source, "gi");
    while ((m = kwRe.exec(text)) !== null) {
      const start = Math.max(0, m.index - 120);
      const end = Math.min(text.length, m.index + 250);
      const window = text.slice(start, end);
      const name = extractName(window);
      if (name) return { name, email: "", source: "about_page", confidence: "moyenne" };
    }
  }
  return null;
}

// ── Step 3: Hunter.io ─────────────────────────────────────────────────────────

const FOUNDER_TITLES_RE =
  /CEO|founder|fondateur|directeur|gérant|président|PDG|DG|co.?founder/i;

async function findFromHunter(domain: string): Promise<ContactResult | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();

    const emails: Array<{ first_name: string; last_name: string; value: string; position?: string; confidence?: number }> =
      data?.data?.emails ?? [];

    const match = emails.find((e) => e.position && FOUNDER_TITLES_RE.test(e.position));
    const best = match ?? emails[0];
    if (!best) return null;

    return {
      name: `${best.first_name ?? ""} ${best.last_name ?? ""}`.trim(),
      email: best.value ?? "",
      source: "hunter",
      confidence: (best.confidence ?? 0) >= 70 ? "élevée" : "moyenne",
    };
  } catch {
    return null;
  }
}

// ── Step 4: Apollo.io ────────────────────────────────────────────────────────

async function findFromApollo(domain: string): Promise<ContactResult | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        q_organization_domains: [domain],
        person_titles: ["CEO", "founder", "fondateur", "directeur général", "gérant", "président"],
        page: 1,
        per_page: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const people: Array<{ first_name: string; last_name: string; email?: string; title?: string }> =
      data?.people ?? [];

    const match = people.find((p) => p.title && FOUNDER_TITLES_RE.test(p.title));
    const best = match ?? people[0];
    if (!best) return null;

    return {
      name: `${best.first_name ?? ""} ${best.last_name ?? ""}`.trim(),
      email: best.email ?? "",
      source: "apollo",
      confidence: "moyenne",
    };
  } catch {
    return null;
  }
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let domain: string;
  try {
    const body = await req.json();
    domain = String(body.domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }

  const base = `https://${domain}`;

  // Run steps in order, stop at first success
  const steps = [
    () => findFromMentionsLegales(base),
    () => findFromAboutPage(base),
    () => findFromHunter(domain),
    () => findFromApollo(domain),
  ];

  for (const step of steps) {
    try {
      const result = await step();
      if (result?.name) return NextResponse.json(result);
    } catch {
      // continue to next step
    }
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
