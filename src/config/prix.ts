// Réglages de prix à renseigner par Alexis. Après modification : npm run build, puis recharger l'extension.

export interface TranchePrix {
  // À partir de cette valeur marchande (incluse), en wikibidous.
  valeurMin: number;
  prixDepart: number;
}

export interface ConfigPrix {
  seuilDefausse: number;
  maxVentesSimultanees: number;
  matricePrixDepart: TranchePrix[];
}

/**
 * Plafond de sécurité de l'envoi réel d'une défausse (Alexis, 2026-11-11) : une carte dont la valeur
 * marchande est inconnue ou supérieure à ce plafond n'est jamais défaussée par l'extension, même décidée à la main.
 */
export const PLAFOND_VALEUR_DEFAUSSE = 5;

export const CONFIG_PRIX: ConfigPrix = {
  // Une carte qui n'intéresse personne et vaut moins que ce seuil (donc 5 ou moins) est à défausser.
  // Aligné sur PLAFOND_VALEUR_DEFAUSSE (Alexis, 2026-11-11) : l'assistant ne propose rien que l'envoi refuserait.
  seuilDefausse: PLAFOND_VALEUR_DEFAUSSE + 1,

  // Nombre d'enchères que le site autorise en même temps.
  maxVentesSimultanees: 5,

  // Matrice valeur marchande → prix de départ. La tranche la plus haute atteinte s'applique.
  // Lecture : une carte vendue au marché entre 6 et 25 se met aux enchères à 1, etc.
  // Au-delà de 200 : suite extrapolée (tranches doublées, prix toujours inférieur à la valeur du marché). À ajuster.
  matricePrixDepart: [
    { valeurMin: 6, prixDepart: 1 }, // 6 à 25 (abaissé de 15 à 6 le 2026-11-11 avec le seuil de défausse)
    { valeurMin: 26, prixDepart: 5 }, // 26 à 50
    { valeurMin: 51, prixDepart: 10 }, // 51 à 100
    { valeurMin: 101, prixDepart: 50 }, // 101 à 200
    { valeurMin: 201, prixDepart: 100 }, // 201 à 400
    { valeurMin: 401, prixDepart: 200 }, // 401 à 800
    { valeurMin: 801, prixDepart: 500 }, // 801 à 1 600
    { valeurMin: 1601, prixDepart: 1000 }, // 1 601 à 3 200
    { valeurMin: 3201, prixDepart: 2000 }, // 3 201 à 6 400
    { valeurMin: 6401, prixDepart: 5000 }, // 6 401 à 12 800
    { valeurMin: 12801, prixDepart: 10000 }, // 12 801 à 25 600
    { valeurMin: 25601, prixDepart: 20000 }, // 25 601 à 51 200
  ],
};
