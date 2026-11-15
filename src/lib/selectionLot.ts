/**
 * Sélection manuelle des cartes à mettre aux enchères ou à défausser (Alexis, 2026-11-14 : sans statut local,
 * le joueur choisit au lancement d’un lot ; les étiquettes « À vendre » et « Défausse » du site préremplissent le choix).
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

/** Étiquette du site qui demande la vente (« #À vendre »), casse, accents et dièse ignorés. */
export const estEtiquetteAVendre = (nom: string): boolean => /^a vendre\b/.test(sansDieseEtAccents(nom))

/** Étiquette du site qui demande la défausse (« #Défausse », « #À défausser »). */
export const estEtiquetteDefausse = (nom: string): boolean => /^(a )?defausse(r)?\b/.test(sansDieseEtAccents(nom))

export interface ChoixParCarte {
  choix: ChoixCarte
  /** Nombre d’exemplaires à défausser (1 au moins, `quantite` au plus) ; sans objet pour les autres choix. */
  exemplaires: number
}

export type Choix = ReadonlyMap<string, ChoixParCarte>

/** Choix de départ d’après les étiquettes du site ; « défausse » l’emporte si les deux sont posées. */
export function choixInitial(cartes: readonly Carte[]): Choix {
  const m = new Map<string, ChoixParCarte>()
  for (const c of cartes) {
    if (!estProposable(c)) continue
    if (c.etiquettesSite.some(estEtiquetteDefausse)) m.set(c.id, { choix: 'defausser', exemplaires: Math.min(c.quantite, c.idsSite?.length ?? 1) })
    else if (c.etiquettesSite.some(estEtiquetteAVendre)) m.set(c.id, { choix: 'vendre', exemplaires: 1 })
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
