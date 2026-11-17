// Choix carte par carte des favoris dans l’aperçu du lot (Alexis, 2026-11-17 : « je dois pouvoir choisir
// d’appliquer ou non l’application du favori carte par carte »). Logique pure, sans `chrome.*`.
import type { Action } from './actions'

export type ActionFavori = Extract<Action, { type: 'favori' }>

/** Origine d’une proposition : règle des thèmes gardés, ou choix manuel du joueur (étoile de la Collection). */
export type OrigineFavori = 'regle' | 'choix'
export type SensFavori = 'pose' | 'retrait'

/** Une ligne par carte : les retraits de tous les exemplaires d’une carte se cochent ensemble. */
export interface PropositionFavori {
  cle: string
  idCarte: string
  sens: SensFavori
  origine: OrigineFavori
  /** Nombre d’actions (exemplaires) couvertes par la ligne. */
  nbActions: number
}

const estFavori = (a: Action): a is ActionFavori => a.type === 'favori'
const sensDe = (a: ActionFavori): SensFavori => (a.valeur === false ? 'retrait' : 'pose')
const origineDe = (a: ActionFavori): OrigineFavori => (a.valeur === undefined ? 'regle' : 'choix')
export const cleFavori = (a: ActionFavori): string => `${a.idCarte}|${sensDe(a)}|${origineDe(a)}`

/** Propositions de favori du lot, regroupées par carte, dans l’ordre du lot. */
export function propositionsFavori(actions: readonly Action[]): PropositionFavori[] {
  const lignes = new Map<string, PropositionFavori>()
  for (const a of actions) {
    if (!estFavori(a)) continue
    const cle = cleFavori(a)
    const l = lignes.get(cle)
    if (l) l.nbActions++
    else lignes.set(cle, { cle, idCarte: a.idCarte, sens: sensDe(a), origine: origineDe(a), nbActions: 1 })
  }
  return [...lignes.values()]
}

/** Retire du lot les actions de favori décochées par le joueur. */
export const sansFavorisDecoches = (actions: readonly Action[], decochees: ReadonlySet<string>): Action[] =>
  decochees.size === 0 ? [...actions] : actions.filter((a) => !(estFavori(a) && decochees.has(cleFavori(a))))
