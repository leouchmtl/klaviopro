import type { Prospect, KPIMonth, ProspectSteps, EmailRecord } from "./types";
import type { EmailVariant } from "./emailGenerator";
import { withRelance } from "./utils";

const PROSPECTS_KEY = "klaviopro_prospects";
const KPI_KEY = "klaviopro_kpi";

// ── Defaults ──────────────────────────────────────────────────────────────────

export function emptySteps(): ProspectSteps {
  return {
    j0:  { done: false, date: null },
    j5:  { done: false, date: null },
    j12: { done: false, date: null },
    j21: { done: false, date: null },
    j35: { done: false, date: null },
    j60: { done: false, date: null },
  };
}

function applyDefaults(raw: Record<string, unknown>): Prospect {
  return {
    id:                  (raw.id as string)                  ?? crypto.randomUUID(),
    marque:              (raw.marque as string)              ?? "",
    secteur:             (raw.secteur as Prospect["secteur"]) ?? "Autre",
    contact:             (raw.contact as string)             ?? "",
    email:               (raw.email as string)               ?? "",
    gapCrm:              (raw.gapCrm as string)              ?? "",
    statut:              (raw.statut as Prospect["statut"])  ?? "À contacter",
    notes:               (raw.notes as string)               ?? "",
    steps:               (raw.steps as ProspectSteps)        ?? emptySteps(),
    ouverturesMultiples: (raw.ouverturesMultiples as boolean) ?? false,
    enConversation:      (raw.enConversation as boolean)     ?? false,
    dernierContact:      (raw.dernierContact as string | null) ?? null,
    prochaineRelance:    (raw.prochaineRelance as string | null) ?? null,
    relanceFaite:        (raw.relanceFaite as boolean)       ?? false,
    createdAt:           (raw.createdAt as string)           ?? new Date().toISOString(),
  };
}

// ── Prospects ────────────────────────────────────────────────────────────────

export function getProspects(): Prospect[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROSPECTS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Record<string, unknown>[]).map(applyDefaults);
  } catch {
    return [];
  }
}

export function saveProspects(prospects: Prospect[]): void {
  localStorage.setItem(PROSPECTS_KEY, JSON.stringify(prospects));
}

export function addProspect(
  p: Omit<Prospect, "id" | "createdAt" | "prochaineRelance">
): Prospect {
  const prospect: Prospect = withRelance({
    ...p,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prochaineRelance: null,
  });
  saveProspects([prospect, ...getProspects()]);
  return prospect;
}

export function updateProspect(updated: Prospect): Prospect {
  const recomputed = withRelance(updated);
  saveProspects(getProspects().map((p) => (p.id === recomputed.id ? recomputed : p)));
  return recomputed;
}

export function deleteProspect(id: string): void {
  saveProspects(getProspects().filter((p) => p.id !== id));
}

// ── KPI helpers ───────────────────────────────────────────────────────────────

export function countCheckedStepsByMonth(mois: string): number {
  let count = 0;
  for (const p of getProspects()) {
    for (const step of Object.values(p.steps)) {
      if (step.done && step.date?.startsWith(mois)) count++;
    }
  }
  return count;
}

export function countTotalCheckedSteps(): number {
  let count = 0;
  for (const p of getProspects()) {
    for (const step of Object.values(p.steps)) {
      if (step.done) count++;
    }
  }
  return count;
}

export function countProspectsChaudes(): number {
  return getProspects().filter((p) => p.ouverturesMultiples && p.enConversation).length;
}

// ── KPI months ────────────────────────────────────────────────────────────────

export function getKPI(): KPIMonth[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KPI_KEY);
    return raw ? (JSON.parse(raw) as KPIMonth[]) : [];
  } catch {
    return [];
  }
}

export function saveKPI(entries: KPIMonth[]): void {
  localStorage.setItem(KPI_KEY, JSON.stringify(entries));
}

export function upsertKPIMonth(entry: KPIMonth): void {
  const all = getKPI();
  const idx = all.findIndex((k) => k.mois === entry.mois);
  if (idx >= 0) all[idx] = entry; else all.push(entry);
  saveKPI(all);
}

export function getKPIMonth(mois: string): KPIMonth {
  return getKPI().find((k) => k.mois === mois) ?? { mois, tauxOuverture: 0, tauxReponse: 0 };
}

// ── Email records (per prospect) ──────────────────────────────────────────────

const EMAILS_PREFIX = "klaviopro_emails_";

export function getEmails(prospectId: string): EmailRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EMAILS_PREFIX + prospectId);
    return raw ? (JSON.parse(raw) as EmailRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveEmailRecord(prospectId: string, record: EmailRecord): void {
  const all = getEmails(prospectId);
  const idx = all.findIndex((e) => e.id === record.id);
  if (idx >= 0) all[idx] = record; else all.unshift(record);
  localStorage.setItem(EMAILS_PREFIX + prospectId, JSON.stringify(all));
}

export function deleteEmailRecord(prospectId: string, emailId: string): void {
  const filtered = getEmails(prospectId).filter((e) => e.id !== emailId);
  localStorage.setItem(EMAILS_PREFIX + prospectId, JSON.stringify(filtered));
}

// ── Cold email variants (per prospect) ────────────────────────────────────────

export interface ColdEmailCache {
  brand: string;
  contact: string;
  gap: string;
  variants: EmailVariant[];
}

const COLD_PREFIX = "klaviopro_cold_";

export function getColdEmails(prospectId: string): ColdEmailCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COLD_PREFIX + prospectId);
    return raw ? (JSON.parse(raw) as ColdEmailCache) : null;
  } catch {
    return null;
  }
}

export function saveColdEmails(prospectId: string, data: ColdEmailCache): void {
  localStorage.setItem(COLD_PREFIX + prospectId, JSON.stringify(data));
}
