import { LIBELLES_STATUT, appliquerEdition, type Carte, type Collection, type Statut } from './collection';

/**
 * Colonnes du tableau de tri (T-312, SC-023, D-15). Module pur, sans `chrome.*`.
 * Ordre de lecture ; `en-vente` n’a pas de colonne (cartes non déplaçables).
 */
export const COLONNES_TRI = ['garder', 'echanger', 'vendre', 'defausser', 'a-trier'] as const;
export type ColonneTri = (typeof COLONNES_TRI)[number];

export const estColonneTri = (statut: Statut): statut is ColonneTri => (COLONNES_TRI as readonly string[]).includes(statut);

/** Colonne voisine dans l’ordre de lecture ; `null` en bout de rangée ou pour un statut hors colonnes. */
export function colonneVoisine(statut: Statut, sens: 'gauche' | 'droite'): ColonneTri | null {
  if (!estColonneTri(statut)) return null;
  const i = COLONNES_TRI.indexOf(statut) + (sens === 'gauche' ? -1 : 1);
  return COLONNES_TRI[i] ?? null;
}

export interface RepartitionTri {
  colonnes: Record<ColonneTri, Carte[]>;
  /** Cartes `en-vente`, exclues des colonnes. */
  enVente: number;
}

/** Répartit les cartes par statut, dans l’ordre d’entrée. */
export function repartirParColonne(cartes: readonly Carte[]): RepartitionTri {
  const colonnes: Record<ColonneTri, Carte[]> = { garder: [], echanger: [], vendre: [], defausser: [], 'a-trier': [] };
  let enVente = 0;
  for (const c of cartes) {
    if (c.statut === 'en-vente') enVente += 1;
    else if (estColonneTri(c.statut)) colonnes[c.statut].push(c);
  }
  return { colonnes, enVente };
}

/** Déplace toute la carte : même écriture que l’édition de la liste (`statut` + `decidePar` « moi »). */
export const deplacerCarte = (collection: Collection, id: string, statut: Statut): Collection =>
  appliquerEdition(collection, id, { statut, decidePar: 'moi' });

export const libelleDeplacement = (titre: string, statut: Statut): string =>
  `Déplacer « ${titre} » vers ${LIBELLES_STATUT[statut]}`;

export const annonceDeplacement = (titre: string, statut: Statut): string =>
  `« ${titre} » déplacée vers ${LIBELLES_STATUT[statut]}`;
