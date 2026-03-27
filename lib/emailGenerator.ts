export interface EmailVariant {
  angle: string;
  angleKey: string; // matches step key: "j0" | "j5" | "j12" | "j21" | "j35" | "j60"
  subject: string;
  body: string;
}

export type RelanceStep = "J0" | "J+5" | "J+12" | "J+21" | "J+35" | "J+60";

export const GAP_LABELS: Record<string, string> = {
  welcome_flow:    "l'absence de séquence de bienvenue",
  signup_form:     "l'absence de formulaire d'inscription",
  abandoned_cart:  "l'absence de flow abandon panier",
  post_purchase:   "l'absence de flow post-achat",
  no_segmentation: "l'absence de segmentation",
  low_open_rates:  "des taux d'ouverture faibles",
};

export function resolveGap(gap: string): string {
  return GAP_LABELS[gap] ?? gap;
}

// Maps RelanceStep → variant array index
const STEP_INDICES: Record<RelanceStep, number> = {
  "J0":  0,
  "J+5": 1,
  "J+12": 2,
  "J+21": 3,
  "J+35": 4,
  "J+60": 5,
};

export function suggestVariantIndex(step: RelanceStep): number {
  return STEP_INDICES[step];
}

// ── Step-aware templates ───────────────────────────────────────────────────────

// J0 — Première prise de contact (Découverte)
function templateJ0(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Premier contact (J0)",
    angleKey: "j0",
    subject: `J'ai remarqué quelque chose sur ${b}.com`,
    body: `Bonjour ${c},

En parcourant votre site, j'ai identifié ${g} chez ${b}. C'est souvent ce type de gap qui représente le potentiel de revenus email le plus immédiat, sans aucun budget publicitaire supplémentaire.

Je suis consultant Klaviyo spécialisé dans la mode et le lifestyle. Mon approche est simple : identifier les automatisations manquantes, les mettre en place rapidement, et mesurer les résultats.

Seriez-vous disponible 20 minutes cette semaine pour en discuter ?

Bien à vous,
[Votre prénom]`,
  };
}

// J+5 — Rebond léger sur le premier message
function templateJ5(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Relance légère (J+5)",
    angleKey: "j5",
    subject: `Suite à mon message — ${b}`,
    body: `Bonjour ${c},

Je me permets de revenir vers vous suite à mon message de la semaine dernière, au sujet de ${g} chez ${b}.

Je sais que les priorités s'accumulent et que ma proposition a peut-être été noyée dans votre boîte. C'est pourquoi je reviens simplement pour savoir si vous avez eu l'occasion d'y réfléchir.

Avez-vous réfléchi à votre stratégie email Klaviyo récemment ?

Cordialement,
[Votre prénom]`,
  };
}

// J+12 — Apporter de la valeur avec un exemple concret
function templateJ12(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Résultat concret (J+12)",
    angleKey: "j12",
    subject: `Un exemple concret pour ${b}`,
    body: `Bonjour ${c},

Pour vous donner un exemple tangible : j'ai récemment aidé une marque mode à générer 10 560 € supplémentaires en 2 mois, en comblant exactement le même type de gap que j'ai identifié chez ${b}, à savoir ${g}.

L'intervention avait duré deux semaines. La mise en place est simple, non invasive, et les premiers résultats sont visibles dès le premier mois.

Seriez-vous intéressé par une présentation rapide de ce que cela donnerait pour ${b} ?

Bien à vous,
[Votre prénom]`,
  };
}

// J+21 — Question directe, chercher à comprendre le besoin
function templateJ21(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Question directe (J+21)",
    angleKey: "j21",
    subject: `${b} — une question directe`,
    body: `Bonjour ${c},

Je ne souhaite pas vous importuner, aussi je me permets une question directe : l'email marketing est-il actuellement une priorité pour ${b} ?

Si ce n'est pas le bon moment, je le comprends totalement. Si en revanche vous réfléchissez à optimiser votre canal email, notamment à ${g}, je serais heureux d'en discuter quelques minutes.

Un simple retour de votre part me suffira.

Cordialement,
[Votre prénom]`,
  };
}

// J+35 — Dernier essai avant pause, ton détendu
function templateJ35(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Dernier message (J+35)",
    angleKey: "j35",
    subject: `Mon dernier message avant une pause, ${b}`,
    body: `Bonjour ${c},

Ce sera mon dernier message avant une longue pause. Je ne veux surtout pas alourdir votre boîte de réception.

Si ${b} décide un jour de travailler sur ${g} et d'explorer ce que Klaviyo peut apporter concrètement, n'hésitez pas à me contacter directement. Je serai toujours disponible pour en discuter.

Je vous souhaite une très belle continuation.

Bien à vous,
[Votre prénom]`,
  };
}

// J+60 — Réactivation après silence, approche fraîche
function templateJ60(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Réactivation (J+60)",
    angleKey: "j60",
    subject: `On reprend, ${b} ?`,
    body: `Bonjour ${c},

Cela fait quelques mois que nous ne nous sommes pas croisés. Je me permets de reprendre contact, car j'ai eu de nouveaux résultats intéressants sur des projets similaires à ${b}.

Côté ${g}, avez-vous eu l'occasion d'avancer depuis notre dernier échange ? Si le sujet est de nouveau d'actualité, je suis disponible cette semaine pour un appel rapide.

Bien à vous,
[Votre prénom]`,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateEmailVariants(
  brand: string,
  contact: string,
  gap: string,
): EmailVariant[] {
  const b = brand.trim()   || "votre marque";
  const c = contact.trim() || "là";
  const g = resolveGap(gap.trim() || "l'absence d'automatisations email");

  return [
    templateJ0(b, c, g),
    templateJ5(b, c, g),
    templateJ12(b, c, g),
    templateJ21(b, c, g),
    templateJ35(b, c, g),
    templateJ60(b, c, g),
  ];
}
