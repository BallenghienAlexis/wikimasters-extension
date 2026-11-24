// Réglages d’affluence à ajuster par Alexis. Après modification : npm run build, puis recharger l’extension.
// Heures locales (0 à 23). Jours : 0 = dimanche … 6 = samedi.

export interface ConfigAffluence {
  /** Valeur marchande à partir de laquelle une carte est « chère ». */
  seuilCarteChere: number;
  /** Durée d’enchère (heures) lancée en heure forte (Alexis, 2026-11-24). Le site accepte 10 min, 30 min, 1, 3, 6 ou 12 h : toute autre valeur retombe sur 1 h. */
  delaiHeureForte: number;
  /** Durée d’enchère (heures) lancée en temps libre, c’est-à-dire en zone creuse (Alexis, 2026-11-24). Mêmes valeurs acceptées. */
  delaiTempsLibre: number;
  /** Durée (heures) d’un creux profond : créneau où les enchères terminées n’ont jamais été vendues (2026-11-24). */
  delaiCreuxProfond: number;
  /** Durée (heures) la nuit, en dehors des heures fortes (2026-11-24). */
  delaiNuit: number;
  /** Heures de nuit : [heure de début incluse, heure de fin exclue], heure locale. */
  heuresNuit: [number, number];
  /** Mises en vente notées nécessaires avant de remplacer les créneaux par défaut. */
  minObservations: number;
  /** Enchères terminées (vendues ou non) nécessaires pour que les heures fortes viennent des ventes réelles (2026-11-24). */
  minVentesConclues: number;
  /** Créneaux par défaut, en attendant les données : [heure de début incluse, heure de fin exclue]. */
  creneauxSemaine: [number, number][];
  creneauxWeekend: [number, number][];
  /** Route de listing du marché (GET, même origine), ex. '/api/marketplace?...'. `null` : relevé du site désactivé. À relever dans l’onglet Réseau de la page Marché. */
  routeMarche: string | null;
  /** Champs de chaque annonce qui portent son horodatage de création, par ordre de préférence. */
  champsHorodatage: string[];
}

export const CONFIG_AFFLUENCE: ConfigAffluence = {
  seuilCarteChere: 200,
  delaiHeureForte: 1,
  delaiTempsLibre: 3,
  delaiCreuxProfond: 6,
  delaiNuit: 12,
  heuresNuit: [0, 7],
  minObservations: 20,
  minVentesConclues: 20,
  creneauxSemaine: [[12, 14], [19, 23]],
  creneauxWeekend: [[10, 12], [15, 23]],
  // Relevée par Alexis le 2026-11-11 : répond `{ auctions: [...] }`, chaque annonce porte `created_at` (ISO, mise en vente) et `end_at`.
  // `mine=1` limite peut-être le listing à ses propres enchères : si le relevé ne reflète que ses ventes, tester sans ce paramètre.
  routeMarche: '/api/marketplace?page=1&limit=50&sort=recent&mine=1',
  champsHorodatage: ['created_at'],
};
