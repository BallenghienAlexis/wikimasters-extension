/**
 * Validation et migration de l’état d’exécution (v1 → v2). Logique pure, sans `chrome.*`.
 * Construit champ par champ sur liste fermée : une clé inconnue n’est jamais recopiée (SC-007).
 */

import {
  CAUSES_JOURNAL, FAMILLES_LOT, TYPES_ACTION,
  type CauseJournal, type ErreurExecution, type EtatExecution, type EtatExecutionV2, type FamilleLot, type LotExecution, type TypeAction,
} from './actions'

export const VERSION_EXECUTION = 2
const ETATS: readonly string[] = ['en-cours', 'terminee', 'arretee']
const MAX_LOTS = 5
const MAX_CHAINE = 300
const MAX_ID_CARTE = 400

const entier = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const tronquer = (s: string, max: number): string => Array.from(s).slice(0, max).join('')
const dans = (liste: readonly string[], v: unknown): v is string => typeof v === 'string' && liste.includes(v)

function validerLots(brut: unknown): LotExecution[] | null {
  if (!Array.isArray(brut) || brut.length > MAX_LOTS) return null
  const sortie: LotExecution[] = []
  for (const l of brut) {
    if (!objet(l) || !dans(FAMILLES_LOT, l.famille)) return null
    if (!entier(l.total) || !entier(l.traitees) || !entier(l.sautees) || l.traitees > l.total || l.sautees > l.total) return null
    sortie.push({ famille: l.famille as FamilleLot, total: l.total, traitees: l.traitees, sautees: l.sautees })
  }
  return sortie
}

function validerErreur(brut: unknown): ErreurExecution | null {
  if (!objet(brut)) return null
  if (!dans(TYPES_ACTION, brut.type) || !dans(FAMILLES_LOT, brut.famille) || !dans(CAUSES_JOURNAL, brut.cause)) return null
  if (brut.parametre !== null && typeof brut.parametre !== 'string') return null
  if (typeof brut.idCarte !== 'string' || typeof brut.titre !== 'string') return null
  if (!entier(brut.indexLot) || !entier(brut.nbLots) || !entier(brut.rang) || !entier(brut.totalLot)) return null
  if (!entier(brut.le) || !entier(brut.reussies) || !entier(brut.autresEchecsEnVol)) return null
  const c = brut.codeHttp
  if (c !== null && !(typeof c === 'number' && Number.isInteger(c) && c >= 100 && c <= 599)) return null
  return {
    type: brut.type as TypeAction,
    parametre: brut.parametre === null ? null : tronquer(brut.parametre, MAX_CHAINE),
    idCarte: tronquer(brut.idCarte, MAX_ID_CARTE),
    titre: tronquer(brut.titre, MAX_CHAINE),
    famille: brut.famille as FamilleLot,
    indexLot: brut.indexLot,
    nbLots: brut.nbLots,
    rang: brut.rang,
    totalLot: brut.totalLot,
    codeHttp: c,
    cause: brut.cause as CauseJournal,
    le: brut.le,
    reussies: brut.reussies,
    autresEchecsEnVol: brut.autresEchecsEnVol,
  }
}

/** Valide une exécution v1 ou v2 et la rend en v2 ; `null` si version inconnue ou forme inattendue. */
export function validerExecution(brut: unknown): EtatExecutionV2 | null {
  if (!objet(brut)) return null
  if (brut.version !== 1 && brut.version !== 2) return null
  if (typeof brut.idLot !== 'string' || brut.idLot === '') return null
  if (!dans(ETATS, brut.etat)) return null
  if (!entier(brut.traitees) || !entier(brut.total) || brut.traitees > brut.total) return null
  const base = { idLot: brut.idLot, etat: brut.etat as EtatExecution['etat'], traitees: brut.traitees, total: brut.total }
  if (brut.version === 1) return { version: 2, ...base, lots: [], pauseJusqua: null, erreur: null }
  const lots = validerLots(brut.lots)
  if (lots === null) return null
  if (brut.pauseJusqua !== null && !entier(brut.pauseJusqua)) return null
  const erreur = brut.erreur === null ? null : validerErreur(brut.erreur)
  if (brut.erreur !== null && erreur === null) return null
  return { version: 2, ...base, lots, pauseJusqua: brut.pauseJusqua as number | null, erreur }
}
