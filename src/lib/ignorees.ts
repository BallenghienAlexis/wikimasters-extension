/**
 * Actions ignorées jusqu’à la prochaine synchro (clé `ignorees`) : logique pure, sans `chrome.*`.
 * Aucun identifiant d’exemplaire du site n’est conservé (SC-007).
 */

import { TYPES_ACTION, type Action, type TypeAction } from './actions'
import type { StatutSynchro } from './statutSynchro'

export interface Ignoree {
  type: TypeAction
  idCarte: string
  parametre: string | null
  portee: 'synchro'
  date: number
}

export const MAX_IGNOREES = 500
const MAX_JOURS_MS = 30 * 86_400_000
const MAX_ID_CARTE = 400
const MAX_PARAMETRE = 300

const meme = (a: Ignoree, b: Ignoree): boolean =>
  a.type === b.type && a.idCarte === b.idCarte && a.parametre === b.parametre

/** Valide l’enveloppe `{version:1, entrees}` ; `null` si version inconnue ou forme inattendue. */
export function validerIgnorees(brut: unknown): Ignoree[] | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const o = brut as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.entrees) || o.entrees.length > MAX_IGNOREES) return null
  const sortie: Ignoree[] = []
  for (const e of o.entrees) {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return null
    const { type, idCarte, parametre, portee, date } = e as Record<string, unknown>
    if (typeof type !== 'string' || !(TYPES_ACTION as readonly string[]).includes(type)) return null
    if (typeof idCarte !== 'string' || Array.from(idCarte).length > MAX_ID_CARTE) return null
    if (parametre !== null && (typeof parametre !== 'string' || Array.from(parametre).length > MAX_PARAMETRE)) return null
    if (portee !== 'synchro') return null
    if (typeof date !== 'number' || !Number.isSafeInteger(date) || date < 0) return null
    sortie.push({ type: type as TypeAction, idCarte, parametre, portee: 'synchro', date })
  }
  return sortie
}

/** Ajoute une ignorée (sans doublon), en gardant les 500 plus récentes. */
export function ajouterIgnoree(liste: readonly Ignoree[], i: Ignoree): Ignoree[] {
  if (liste.some((x) => meme(x, i))) return [...liste]
  return [...liste, i].slice(-MAX_IGNOREES)
}

/** « Reprendre » : retire l’ignorée correspondante. */
export function retirerIgnoree(liste: readonly Ignoree[], i: Ignoree): Ignoree[] {
  return liste.filter((x) => !meme(x, i))
}

export interface ContextePurge {
  maintenant: number
  statutSynchro: StatutSynchro | null
  cartes: ReadonlySet<string>
}

/** Retire les ignorées après une synchro complète commencée plus tard, si la carte a disparu, ou après 30 jours. */
export function purger(liste: readonly Ignoree[], ctx: ContextePurge): Ignoree[] {
  const s = ctx.statutSynchro
  return liste.filter((i) => {
    if (ctx.maintenant - i.date > MAX_JOURS_MS) return false
    if (!ctx.cartes.has(i.idCarte) && i.idCarte !== 'etiquettes') return false
    if (s !== null && s.etat === 'termine' && s.debut != null && s.debut > i.date) return false
    return true
  })
}

const parametreDe = (a: Action): string | null =>
  a.type === 'creation-etiquette' || a.type === 'pose-etiquette' || a.type === 'retrait-etiquette' || a.type === 'suppression-etiquette'
    ? a.nomEtiquette
    : a.type === 'enchere'
      ? String(a.prix)
      : null

/** Écarte du lot les actions ignorées ; une création ignorée écarte aussi les poses de la même étiquette. */
export function filtrerLotIgnore(
  actions: readonly Action[],
  ignorees: readonly Ignoree[],
): { actions: Action[]; ecartees: Array<{ action: Action; raison: string }> } {
  const creationsIgnorees = new Set(ignorees.filter((i) => i.type === 'creation-etiquette').map((i) => i.parametre))
  const gardees: Action[] = []
  const ecartees: Array<{ action: Action; raison: string }> = []
  for (const a of actions) {
    const p = parametreDe(a)
    if (ignorees.some((i) => i.type === a.type && i.idCarte === a.idCarte && i.parametre === p)) {
      ecartees.push({ action: a, raison: a.type === 'creation-etiquette' ? 'création ignorée' : 'action ignorée' })
    } else if (a.type === 'pose-etiquette' && creationsIgnorees.has(a.nomEtiquette)) {
      ecartees.push({ action: a, raison: 'création ignorée' })
    } else gardees.push(a)
  }
  return { actions: gardees, ecartees }
}
