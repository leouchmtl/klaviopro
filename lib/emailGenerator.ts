export interface EmailVariant {
  angle: string;
  angleKey: string;
  subject: string;
  body: string;
}

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

// ── 6 angle templates ─────────────────────────────────────────────────────────

function angle1(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Résultat chiffré",
    angleKey: "result",
    subject: `${b} — comment générer +200K€ avec votre liste email`,
    body: `Bonjour ${c},

Je travaille avec des marques e-commerce mode et beauté sur leur stratégie email Klaviyo.

Résultat concret : l'une de mes clientes a généré +200 000 € en 90 jours, avec un taux d'ouverture moyen de 44,82 %.

En analysant ${b}, j'ai remarqué ${g}. C'est souvent là que se cachent les revenus les plus faciles à activer — sans aucun budget publicitaire supplémentaire.

Seriez-vous disponible 20 minutes cette semaine pour en discuter ?

Bien à vous,
[Votre prénom]`,
  };
}

function angle2(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Gap identifié",
    angleKey: "gap",
    subject: `Ce que j'ai remarqué sur ${b}.com`,
    body: `Bonjour ${c},

En analysant votre site, j'ai identifié ${g} — ce qui représente probablement des milliers d'euros de revenus non captés chaque mois.

Je suis consultant Klaviyo spécialisé dans la mode et le lifestyle. J'aide des marques comme ${b} à combler exactement ce type de gap en quelques semaines, sans perturber vos opérations actuelles.

Une question : avez-vous déjà travaillé sur ce point en interne ?

Cordialement,
[Votre prénom]`,
  };
}

function angle3(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Preuve sociale",
    angleKey: "social",
    subject: `Ce que deux marques mode ont en commun avec ${b}`,
    body: `Bonjour ${c},

J'accompagne actuellement deux marques de mode dans leur stratégie Klaviyo. Elles partageaient le même problème : ${g}.

En 60 jours, l'une a vu son chiffre d'affaires email progresser de +38 %. L'autre a doublé son taux de conversion post-inscription.

Je pense que ${b} a exactement le même potentiel. Seriez-vous ouvert à un échange de 20 minutes cette semaine ?

Bien à vous,
[Votre prénom]`,
  };
}

function angle4(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Rapidité de mise en place",
    angleKey: "speed",
    subject: `${b} opérationnel sur Klaviyo en 2 semaines`,
    body: `Bonjour ${c},

J'ai remarqué que ${b} présente ${g}. La bonne nouvelle : c'est précisément le type de gap que je règle en 2 semaines.

Je suis consultant Klaviyo pour des marques e-commerce, et j'ai développé une méthode de mise en place rapide qui s'intègre sans friction à votre organisation actuelle.

Puis-je vous montrer concrètement ce que cela donnerait pour ${b} ?

Cordialement,
[Votre prénom]`,
  };
}

function angle5(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Audit gratuit",
    angleKey: "audit",
    subject: `Un mini-audit Klaviyo offert pour ${b}`,
    body: `Bonjour ${c},

Je propose actuellement un mini-audit Klaviyo gratuit à quelques marques sélectionnées — et ${b} m'a semblé être un excellent candidat.

En 30 minutes, je vous donne un regard extérieur sur votre setup actuel, notamment sur ${g}, et vous repartez avec 3 recommandations concrètes applicables immédiatement.

Seriez-vous intéressé ? Aucun engagement, uniquement de la valeur.

Bien à vous,
[Votre prénom]`,
  };
}

function angle6(b: string, c: string, g: string): EmailVariant {
  return {
    angle: "Direct (3 phrases)",
    angleKey: "direct",
    subject: `${b} × Klaviyo`,
    body: `Bonjour ${c},

J'ai remarqué ${g} chez ${b} — c'est un levier que je peux activer pour vous en moins de deux semaines.

Disponible pour un appel rapide de 15 minutes ?

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
    angle1(b, c, g),
    angle2(b, c, g),
    angle3(b, c, g),
    angle4(b, c, g),
    angle5(b, c, g),
    angle6(b, c, g),
  ];
}
