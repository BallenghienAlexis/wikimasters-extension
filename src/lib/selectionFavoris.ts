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

/** État par défaut d’une ligne : la règle des thèmes gardés est décochée, le choix manuel du joueur est coché. */
const decocheeParDefaut = (p: PropositionFavori): boolean => p.origine === 'regle'

/**
 * Lignes décochées : état par défaut inversé par les `bascules` du joueur ; une carte « Ne plus proposer »
 * (`refuses`) reste décochée pour la règle quoi qu'il arrive.
 */
export function favorisDecoches(propositions: readonly PropositionFavori[], bascules: ReadonlySet<string>, refuses: ReadonlySet<string>): Set<string> {
  const d = new Set<string>()
  for (const p of propositions) {
    if (p.origine === 'regle' && refuses.has(p.idCarte)) d.add(p.cle)
    else if (decocheeParDefaut(p) !== bascules.has(p.cle)) d.add(p.cle)
  }
  return d
}

/** Nouvelles bascules après « Tout cocher » (`cocher`) ou « Tout décocher » sur les lignes `cles`. */
export function basculesApresTout(propositions: readonly PropositionFavori[], bascules: ReadonlySet<string>, cles: readonly string[], cocher: boolean): Set<string> {
  const suite = new Set(bascules)
  const parCle = new Map(propositions.map((p) => [p.cle, p]))
  for (const c of cles) {
    const p = parCle.get(c)
    if (!p) continue
    // Une bascule est nécessaire quand l'état voulu (coché ou non) diffère de l'état par défaut.
    if (cocher === decocheeParDefaut(p)) suite.add(c)
    else suite.delete(c)
  }
  return suite
}
