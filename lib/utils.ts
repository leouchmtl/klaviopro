import type { Statut, Prospect } from "./types";

// Days to add per statut (null = no follow-up needed)
const STATUT_DELAY: Record<Statut, number | null> = {
  "À contacter": 0,
  "Relance J+5": 5,
  "Relance J+12": 12,
  "Relance J+21": 21,
  "Relance J+35": 35,
  "Relance J+60": 60,
  Client: null,
  Refus: null,
  "Sans besoin": null,
};

export function calcProchaineRelance(
  statut: Statut,
  dernierContact: string | null
): string | null {
  const delay = STATUT_DELAY[statut];
  if (delay === null) return null;

  const base = dernierContact ? new Date(dernierContact) : new Date();
  // "À contacter" with no last contact → today
  if (delay === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return toDateStr(today);
  }

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
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

export function endOfWeek(): string {
  return addDays(startOfWeek(), 6);
}

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

// Recompute prochaineRelance on a prospect
export function withRelance(p: Prospect): Prospect {
  return {
    ...p,
    prochaineRelance: calcProchaineRelance(p.statut, p.dernierContact),
  };
}
