/**
 * Ajoute à une enchère l’identifiant « card_id » du site, lu dans l’état de synchronisation au moment
 * d’envoyer. Logique pure. Sans identifiant connu : `null` (l’enchère reste « action non disponible »).
 */
import type { Action } from './actions'

export function avecIdCardSite(ordre: Action, cardIds: Readonly<Record<string, string>> | undefined): Action | null {
  if (ordre.type !== 'enchere') return ordre
  const idCardSite = cardIds !== undefined && Object.hasOwn(cardIds, ordre.idCarte) ? cardIds[ordre.idCarte] : undefined
  if (typeof idCardSite !== 'string' || idCardSite === '') return null
  return { ...ordre, idCardSite }
}
