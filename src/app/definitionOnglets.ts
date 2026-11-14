/** Les six onglets de la page de gestion, dans l’ordre d’affichage (D-02, D-12). Le fragment d’URL est l’identifiant. */

export const ONGLETS = [
  { id: 'tableau-de-bord', nom: 'Tableau de bord' },
  { id: 'synchro', nom: 'Synchro' },
  { id: 'lots', nom: 'Lots' },
  { id: 'collection', nom: 'Collection' },
  { id: 'ventes', nom: 'Ventes' },
  { id: 'reglages', nom: 'Réglages' },
] as const;

export type IdOnglet = (typeof ONGLETS)[number]['id'];

export const ONGLET_DEFAUT: IdOnglet = 'tableau-de-bord';

export const idOnglet = (id: IdOnglet): string => `onglet-${id}`;
export const idPanneau = (id: IdOnglet): string => `panneau-${id}`;

/** Onglet désigné par un fragment d’URL (`#synchro`) ; Tableau de bord si le fragment est absent ou inconnu. */
export function ongletDepuisHash(hash: string): IdOnglet {
  const brut = hash.startsWith('#') ? hash.slice(1) : hash;
  return ONGLETS.find((o) => o.id === brut)?.id ?? ONGLET_DEFAUT;
}
