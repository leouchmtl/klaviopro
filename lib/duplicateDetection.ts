import type { Prospect } from "./types";
import { isDisqualified } from "./utils";

export type DupMatchType = "email" | "domaine" | "nom de marque" | "nom du dirigeant";

export interface DuplicateMatch {
  prospect: Prospect;
  matchType: DupMatchType;
  isDisqualified: boolean;
}

export interface NewProspectData {
  email?: string;
  website?: string;
  marque?: string;
  contact?: string;
}

// ── String helpers ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function fuzzyMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Levenshtein: allow up to 2 edits for strings >= 6 chars, 1 edit for shorter
  const minLen = Math.min(na.length, nb.length);
  const threshold = minLen <= 5 ? 1 : 2;
  return levenshtein(na, nb) <= threshold;
}

// ── Domain helpers ─────────────────────────────────────────────────────────────

const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "orange.fr", "free.fr", "sfr.fr", "laposte.net", "icloud.com",
  "protonmail.com", "proton.me", "mail.com", "yahoo.fr", "me.com",
  "msn.com", "wanadoo.fr", "bbox.fr", "numericable.fr",
]);

export function extractDomain(emailOrUrl: string): string {
  const s = (emailOrUrl ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("@")) {
    const part = s.split("@")[1] ?? "";
    return part.split("/")[0].trim();
  }
  return s
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

function domainFromProspect(p: Prospect): string {
  return extractDomain(p.email) || extractDomain(p.website);
}

// ── Main detection function ────────────────────────────────────────────────────

export function findDuplicates(
  newData: NewProspectData,
  allProspects: Prospect[],
): DuplicateMatch[] {
  const newEmail   = (newData.email   ?? "").toLowerCase().trim();
  const newRawDomain = extractDomain(newData.email ?? "") || extractDomain(newData.website ?? "");
  const newDomain  = !FREE_DOMAINS.has(newRawDomain) ? newRawDomain : "";
  const newMarque  = (newData.marque  ?? "").trim();
  const newContact = (newData.contact ?? "").trim();

  const results: DuplicateMatch[] = [];

  for (const p of allProspects) {
    let matchType: DupMatchType | null = null;

    // 1. Email exact match
    if (newEmail && p.email.toLowerCase().trim() === newEmail) {
      matchType = "email";
    }
    // 2. Domain match (non-free providers only)
    else if (newDomain) {
      const pDomain = domainFromProspect(p);
      if (pDomain && !FREE_DOMAINS.has(pDomain) && pDomain === newDomain) {
        matchType = "domaine";
      }
    }

    // 3. Brand name fuzzy match (only if no domain match)
    if (!matchType && newMarque && p.marque) {
      if (fuzzyMatch(newMarque, p.marque)) matchType = "nom de marque";
    }

    // 4. Contact/founder name fuzzy match
    if (!matchType && newContact) {
      const pContact = (p.foundersName || p.contact || "").trim();
      if (pContact && fuzzyMatch(newContact, pContact)) matchType = "nom du dirigeant";
    }

    if (matchType) {
      results.push({
        prospect: p,
        matchType,
        isDisqualified: isDisqualified(p.statut),
      });
    }
  }

  return results;
}
