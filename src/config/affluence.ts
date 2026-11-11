// Réglages d’affluence à ajuster par Alexis. Après modification : npm run build, puis recharger l’extension.
// Heures locales (0 à 23). Jours : 0 = dimanche … 6 = samedi.

export interface ConfigAffluence {
  /** Valeur marchande à partir de laquelle une carte est « chère ». */
  seuilCarteChere: number;
  /** Délai conseillé (heures) pour une carte chère en heure forte. */
  delaiHeureForte: number;
  /** Délai conseillé (heures) pour une carte moins chère sur temps libre. */
  delaiTempsLibre: number;
  /** Mises en vente notées nécessaires avant de remplacer les créneaux par défaut. */
  minObservations: number;
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
  minObservations: 20,
  creneauxSemaine: [[12, 14], [19, 23]],
  creneauxWeekend: [[10, 12], [15, 23]],
  routeMarche: null,
  champsHorodatage: ['created_at', 'createdAt', 'started_at', 'start_at'],
};
