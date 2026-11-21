// Réglages de prix à renseigner par Alexis. Après modification : npm run build, puis recharger l'extension.

export interface ConfigPrix {
  seuilDefausse: number;
  maxVentesSimultanees: number;
}

/**
 * Règle du prix de départ selon la tendance du marché (Alexis, 2026-11-21 : « prix variable selon la tendance du marché à
 * réexaminer juste avant de mettre une carte en vente »). Elle remplace la matrice de tranches.
 * - Référence = prix moyen de la dernière semaine (`price-history`), jamais le prix de départ lui-même.
 * - Prix de départ = référence × `coefDepart` (25 %), arrondi par défaut, au moins 1, toujours sous la valeur du marché.
 * - Hausse (variation ≥ `seuilVariation` %) : on ne poursuit pas la hausse, la référence est la moyenne entre le prix actuel
 *   et celui de la semaine d'avant.
 * - Baisse (variation ≤ −`seuilVariation` %) : départ plus bas, `coefBaisse` (15 %), pour attirer des mises.
 * - Peu de ventes (moins de `minVentes` sur 4 semaines) : la moyenne est peu fiable, la référence est à mi-chemin entre le plus
 *   bas de la fourchette et la moyenne.
 */
export const REGLE_PRIX = {
  coefDepart: 0.25,
  coefBaisse: 0.15,
  seuilVariation: 25,
  minVentes: 3,
  /** Sous cette valeur marchande, aucune mise aux enchères (ancienne première tranche, alignée sur le plafond de défausse + 1). */
  valeurMinVente: 6,
} as const;

/**
 * Plafond de sécurité de l'envoi réel d'une défausse (Alexis, 2026-11-11) : une carte dont la valeur
 * marchande est inconnue ou supérieure à ce plafond n'est jamais défaussée par l'extension, même décidée à la main.
 */
export const PLAFOND_VALEUR_DEFAUSSE = 5;

/** Bornes du plafond réglable depuis la page de gestion (Alexis, 2026-11-12). Au-dessus de la valeur par défaut : avertissement. */
export const PLAFOND_DEFAUSSE_MIN = 1;
export const PLAFOND_DEFAUSSE_MAX = 20;

export const CONFIG_PRIX: ConfigPrix = {
  // Une carte qui n'intéresse personne et vaut moins que ce seuil (donc 5 ou moins) est à défausser.
  // Aligné sur PLAFOND_VALEUR_DEFAUSSE (Alexis, 2026-11-11) : l'assistant ne propose rien que l'envoi refuserait.
  seuilDefausse: PLAFOND_VALEUR_DEFAUSSE + 1,

  // Nombre d'enchères que le site autorise en même temps.
  maxVentesSimultanees: 5,
};
