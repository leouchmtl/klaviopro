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

export const SECTEURS = [
  "Mode",
  "Lingerie",
  "Cosmétiques",
  "Bijoux",
  "Lifestyle",
  "Enfant",
  "Autre",
] as const;

export type Secteur = (typeof SECTEURS)[number];

export interface StepEntry {
  done: boolean;
  date: string | null; // "YYYY-MM-DD"
}

export interface ProspectSteps {
  j0:  StepEntry;
  j5:  StepEntry;
  j12: StepEntry;
  j21: StepEntry;
  j35: StepEntry;
  j60: StepEntry;
}

export interface Prospect {
  id: string;
  marque: string;
  secteur: Secteur;
  contact: string;
  email: string;
  gapCrm: string;
  statut: Statut;
  notes: string;
  steps: ProspectSteps;
  ouverturesMultiples: boolean; // opened your email multiple times
  enConversation: boolean;      // active exchange ongoing
  dernierContact: string | null;
  prochaineRelance: string | null; // auto-calculated
  relanceFaite: boolean;
  createdAt: string;
}

export interface KPIMonth {
  mois: string;
  tauxOuverture: number;
  tauxReponse: number;
}
