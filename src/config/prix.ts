// Réglages de prix à renseigner par Alexis. Après modification : npm run build, puis recharger l'extension.

export interface TranchePrix {
  // À partir de cette valeur marchande (incluse), en wikibidous.
  valeurMin: number;
  prixDepart: number;
}

export interface ConfigPrix {
  seuilDefausse: number;
  maxVentesSimultanees: number;
  valeurParRarete: Record<string, number | null>;
  matricePrixDepart: TranchePrix[];
}

export const CONFIG_PRIX: ConfigPrix = {
  // Une carte qui n'intéresse personne et vaut moins que ce seuil est à défausser.
  seuilDefausse: 15,

  // Nombre d'enchères que le site autorise en même temps.
  maxVentesSimultanees: 5,

  // Valeur de repli par rareté, pour une carte dont la moyenne du marché n'a pas encore été relevée.
  // null : valeur inconnue, la carte reste « À trier » et n'est ni vendue ni défaussée.
  valeurParRarete: {
    L: null,
    UR: null,
    SR: null,
    R: null,
    PC: null,
    C: null,
  },

  // Matrice valeur marchande → prix de départ. La tranche la plus haute atteinte s'applique.
  // Lecture : une carte vendue au marché entre 15 et 25 se met aux enchères à 1, etc.
  // Au-delà de 200 : suite extrapolée (tranches doublées, prix toujours inférieur à la valeur du marché). À ajuster.
  matricePrixDepart: [
    { valeurMin: 15, prixDepart: 1 }, // 15 à 25
    { valeurMin: 26, prixDepart: 5 }, // 26 à 50
    { valeurMin: 51, prixDepart: 10 }, // 51 à 100
    { valeurMin: 101, prixDepart: 50 }, // 101 à 200
    { valeurMin: 201, prixDepart: 100 }, // 201 à 400
    { valeurMin: 401, prixDepart: 200 }, // 401 à 800
    { valeurMin: 801, prixDepart: 500 }, // 801 à 1 600
    { valeurMin: 1601, prixDepart: 1000 }, // 1 601 à 3 200
  ],
};
