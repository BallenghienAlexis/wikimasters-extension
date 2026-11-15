/**
 * Sélection manuelle des cartes à mettre aux enchères ou à défausser (Alexis, 2026-11-14 : sans statut local,
 * le joueur choisit au lancement d’un lot ; l’étiquette « Statut · Vendre » du site préremplit la mise aux enchères).
 *
 * Logique pure, sans `chrome.*`. Rien n’est stocké : la sélection vit le temps de l’aperçu.
 */
import { normaliser, type Carte } from './collection'
import type { SelectionLot } from './lot'

/** Choix possibles pour une carte. */
export type ChoixCarte = 'aucun' | 'vendre' | 'defausser'

/** Une carte est proposable si elle est reliée au site et n’est pas un favori (verrouillé sur le site). */
export const estProposable = (c: Carte): boolean => !c.favori && c.idsSite !== null && c.idsSite.length > 0 && c.quantite > 0

const sansDieseEtAccents = (nom: string): string => normaliser(nom).replace(/^#\s*/, '').trim()

/**
 * Étiquette du site qui demande la vente : « Statut · Vendre » (relevé du compte d’Alexis, 2026-11-15) ou « À vendre ».
 * Lecture seule : l’extension ne pose jamais ces étiquettes. « Statut · En vente » (déjà aux enchères), « Échanger » et « Garder » ne préchoisissent rien.
 */
export const estEtiquetteAVendre = (nom: string): boolean => /^(statut[^a-z]*vendre|a vendre)$/.test(sansDieseEtAccents(nom))

export interface ChoixParCarte {
  choix: ChoixCarte
  /** Nombre d’exemplaires à défausser (1 au moins, `quantite` au plus) ; sans objet pour les autres choix. */
  exemplaires: number
}

export type Choix = ReadonlyMap<string, ChoixParCarte>

/** Choix de départ d’après les étiquettes du site (mise aux enchères seulement). */
export function choixInitial(cartes: readonly Carte[]): Choix {
  const m = new Map<string, ChoixParCarte>()
  for (const c of cartes) {
    if (!estProposable(c)) continue
    // La défausse reste un choix manuel : le compte n’a pas d’étiquette de défausse.
    if (c.etiquettesSite.some(estEtiquetteAVendre)) m.set(c.id, { choix: 'vendre', exemplaires: 1 })
  }
  return m
}

/** Convertit les choix en sélection du lot ; une carte non proposable ou sans choix est ignorée. */
export function versSelection(cartes: readonly Carte[], choix: Choix): SelectionLot {
  const vendre: string[] = []
  const defausser: Record<string, number> = {}
  for (const c of cartes) {
    const x = choix.get(c.id)
    if (!x || !estProposable(c)) continue
    if (x.choix === 'vendre') vendre.push(c.id)
    else if (x.choix === 'defausser') defausser[c.id] = Math.max(1, Math.min(x.exemplaires, c.quantite, c.idsSite?.length ?? 0))
  }
  return { vendre, defausser }
}
