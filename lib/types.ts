export const STATUTS = [
  "À contacter",
  "Relance J+5",
  "Relance J+12",
  "Relance J+21",
  "Relance J+35",
  "Relance J+60",
  "Client",
  "Refus",
  "Sans besoin",
] as const;

export type Statut = (typeof STATUTS)[number];

export interface Prospect {
  id: string;
  marque: string;
  contact: string;
  email: string;
  gapCrm: string;
  statut: Statut;
  notes: string;
  dernierContact: string | null; // "YYYY-MM-DD"
  prochaineRelance: string | null; // "YYYY-MM-DD" — auto-calculated
  createdAt: string;
}

export interface KPIMonth {
  mois: string; // "YYYY-MM"
  emailsEnvoyes: number;
  tauxOuverture: number; // 0–100
  tauxReponse: number;   // 0–100
}
