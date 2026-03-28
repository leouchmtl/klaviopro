export const STATUTS = [
  "À contacter",
  "Contacté J0",
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

export type FoundersSource = "mentions_légales" | "hunter" | "apollo" | "about_page" | "";
export type FoundersConfidence = "élevée" | "moyenne" | "faible" | "";

export interface Prospect {
  id: string;
  marque: string;
  secteur: Secteur;
  contact: string;
  email: string;
  website: string;           // brand website / domain for enrichment
  instagramHandle: string;   // without @
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
  // Contact dirigeant
  foundersName: string;
  foundersEmail: string;
  foundersSource: FoundersSource;
  foundersConfidence: FoundersConfidence;
}

export interface EnrichmentData {
  platform: string;              // "Shopify ✅" | "Autre plateforme"
  klaviyo: string;               // "Klaviyo ✅" | "Pas de Klaviyo ❌"
  klaviyoDetected: boolean;
  shopifyDetected: boolean;
  description: string;
  instagram: string;             // "@handle · X abonnés" | "Non disponible"
  updatedAt: string;             // ISO date
  websiteFound?: string;         // auto-found domain (to persist back to prospect)
  instagramHandleFound?: string; // auto-found handle
}

export interface KPIMonth {
  mois: string;
  tauxOuverture: number;
  tauxReponse: number;
}

export interface EmailRecord {
  id: string;
  date: string;           // "YYYY-MM-DD"
  subject: string;
  body: string;
  direction: "envoyé" | "reçu";
}
