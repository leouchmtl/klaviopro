import type { Prospect, KPIMonth } from "./types";
import { withRelance } from "./utils";

const PROSPECTS_KEY = "klaviopro_prospects";
const KPI_KEY = "klaviopro_kpi";

// ── Prospects ────────────────────────────────────────────────────────────────

export function getProspects(): Prospect[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROSPECTS_KEY);
    return raw ? (JSON.parse(raw) as Prospect[]) : [];
  } catch {
    return [];
  }
}

export function saveProspects(prospects: Prospect[]): void {
  localStorage.setItem(PROSPECTS_KEY, JSON.stringify(prospects));
}

export function addProspect(p: Omit<Prospect, "id" | "createdAt" | "prochaineRelance">): Prospect {
  const prospect: Prospect = withRelance({
    ...p,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prochaineRelance: null,
  });
  const all = getProspects();
  saveProspects([prospect, ...all]);
  return prospect;
}

export function updateProspect(updated: Prospect): Prospect {
  const recomputed = withRelance(updated);
  const all = getProspects().map((p) => (p.id === recomputed.id ? recomputed : p));
  saveProspects(all);
  return recomputed;
}

export function deleteProspect(id: string): void {
  saveProspects(getProspects().filter((p) => p.id !== id));
}

// ── KPI ──────────────────────────────────────────────────────────────────────

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
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  saveKPI(all);
}

export function getKPIMonth(mois: string): KPIMonth {
  const all = getKPI();
  return (
    all.find((k) => k.mois === mois) ?? {
      mois,
      emailsEnvoyes: 0,
      tauxOuverture: 0,
      tauxReponse: 0,
    }
  );
}
