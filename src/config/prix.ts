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
  // Exemple de ligne : { valeurMin: 15, prixDepart: 20 },
  matricePrixDepart: [],
};
