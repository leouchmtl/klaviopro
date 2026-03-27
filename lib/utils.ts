import type { Statut, Prospect, ProspectSteps, StepEntry } from "./types";

// Days to add from dernierContact (or today) per statut (null = no follow-up)
const STATUT_DELAY: Record<Statut, number | null> = {
  "À contacter": 5,
  "Relance J+5":  7,
  "Relance J+12": 9,
  "Relance J+21": 14,
  "Relance J+35": 25,
  "Relance J+60": null, // séquence terminée
  Client:         null,
  Refus:          null,
  "Sans besoin":  null,
};

export function calcProchaineRelance(
  statut: Statut,
  dernierContact: string | null
): string | null {
  const delay = STATUT_DELAY[statut];
  if (delay === null) return null;
  const base = dernierContact ? new Date(dernierContact) : new Date();
  const result = new Date(base);
  result.setDate(result.getDate() + delay);
  return toDateStr(result);
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function formatDateFR(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function isLate(prochaineRelance: string | null): boolean {
  if (!prochaineRelance) return false;
  return prochaineRelance < today();
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === today();
}

export function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

export function endOfWeek(): string {
  return addDays(startOfWeek(), 6);
}

// ── Dynamic "Prochaine relance" from step checkboxes ─────────────────────────

export const STEP_ORDER = ["j0", "j5", "j12", "j21", "j35", "j60"] as const;
type StepKey = (typeof STEP_ORDER)[number];

export const STEP_TO_STATUT: Record<StepKey, Statut> = {
  j0:  "À contacter",
  j5:  "Relance J+5",
  j12: "Relance J+12",
  j21: "Relance J+21",
  j35: "Relance J+35",
  j60: "Relance J+60",
};

export function applyStepChange(
  steps: ProspectSteps,
  key: StepKey,
  entry: StepEntry,
): { steps: ProspectSteps; statut: Statut; dernierContact: string | null } {
  const idx = STEP_ORDER.indexOf(key);
  const newSteps = { ...steps };

  if (entry.done) {
    newSteps[key] = entry;
    const fillDate = entry.date ?? today();
    for (let i = 0; i < idx; i++) {
      if (!newSteps[STEP_ORDER[i]].done) {
        newSteps[STEP_ORDER[i]] = { done: true, date: fillDate };
      }
    }
  } else {
    newSteps[key] = { done: false, date: null };
    for (let i = idx + 1; i < STEP_ORDER.length; i++) {
      newSteps[STEP_ORDER[i]] = { done: false, date: null };
    }
  }

  let statut: Statut = "À contacter";
  let dernierContact: string | null = null;
  for (let i = STEP_ORDER.length - 1; i >= 0; i--) {
    if (newSteps[STEP_ORDER[i]].done) {
      statut = STEP_TO_STATUT[STEP_ORDER[i]];
      dernierContact = newSteps[STEP_ORDER[i]].date ?? today();
      break;
    }
  }

  return { steps: newSteps as ProspectSteps, statut, dernierContact };
}

// Days to add from each step's date to get the NEXT expected relance
const STEP_GAPS: Record<StepKey, number | null> = {
  j0: 5, j5: 7, j12: 9, j21: 14, j35: 25, j60: null,
};

/**
 * Returns:
 *   null            — all steps done (✅ Terminé)
 *   string (date)   — date of the next expected relance
 */
export function calcNextRelanceFromSteps(steps: ProspectSteps): string | null {
  let lastDoneIdx = -1;
  for (let i = 0; i < STEP_ORDER.length; i++) {
    if (steps[STEP_ORDER[i]].done) lastDoneIdx = i;
  }

  // j60 done → all done
  if (lastDoneIdx === STEP_ORDER.length - 1) return null;

  // Some step done → next = lastDone.date + gap
  if (lastDoneIdx >= 0) {
    const key = STEP_ORDER[lastDoneIdx];
    const gap = STEP_GAPS[key]!;
    const base = steps[key].date ?? today();
    return addDays(base, gap);
  }

  // No step done → use j0 date if set, else today
  return steps.j0.date ?? today();
}

// CSS color for a relance date
export function relanceDateColor(date: string | null): string {
  if (!date) return "text-slate-400";
  const t = today();
  if (date < t) return "text-red-600";
  if (date === t) return "text-orange-500";
  return "text-green-600";
}

// ── Misc ─────────────────────────────────────────────────────────────────────

// CSV → array of objects
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] ?? "").trim().replace(/^"|"$/g, "");
    });
    return obj;
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export const STATUT_COLORS: Record<Statut, { bg: string; text: string }> = {
  "À contacter":  { bg: "bg-blue-100",   text: "text-blue-800"   },
  "Relance J+5":  { bg: "bg-yellow-100", text: "text-yellow-800" },
  "Relance J+12": { bg: "bg-orange-100", text: "text-orange-800" },
  "Relance J+21": { bg: "bg-amber-100",  text: "text-amber-800"  },
  "Relance J+35": { bg: "bg-purple-100", text: "text-purple-800" },
  "Relance J+60": { bg: "bg-indigo-100", text: "text-indigo-800" },
  Client:         { bg: "bg-green-100",  text: "text-green-800"  },
  Refus:          { bg: "bg-red-100",    text: "text-red-800"    },
  "Sans besoin":  { bg: "bg-gray-100",   text: "text-gray-600"   },
};

export function withRelance(p: Prospect): Prospect {
  return {
    ...p,
    prochaineRelance: calcProchaineRelance(p.statut, p.dernierContact),
  };
}
