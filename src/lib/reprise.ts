/**
 * Règles de reprise après un arrêt (T-313, D-30, D-33) : pause de 30 min des lots, états des choix du panneau d’erreur.
 *
 * Logique pure : aucun accès à `chrome.*`, l’horloge murale (`Date.now`) est toujours passée en argument.
 * `pauseJusqua` est une heure **murale** (jamais l’horloge monotone de la file), si bien qu’elle survit à un
 * rechargement et vaut pour tous les onglets.
 *
 * Exports : `PAUSE_LOTS_MS`, `calculerPauseJusqua`, `pauseActive`, `heureReprise`, `raisonPause`,
 * `RAISON_RESULTAT_INCONNU`, `resultatInconnu`, `choixPanneau` (types `ChoixPanneau`, `EtatChoix`).
 */

import type { EntreeJournal, TypeAction } from './actions'
import type { RaisonArret } from './file'

/** Pause imposée aux lots après un refus du site : 30 minutes. */
export const PAUSE_LOTS_MS = 30 * 60_000

/** Codes qui arrêtent la file et déclenchent la pause : session refusée, trop de requêtes, refus hors exemplaire ou seuil de refus par carte. */
const CODES_PAUSE: readonly number[] = [401, 403, 429]

/**
 * Heure de fin de pause (ms, murale) selon la cause de l’arrêt, ou `null` s’il n’y en a pas.
 * Pause après 401, 429, 403 (refus hors exemplaire, ou seuil de refus par carte atteint : décision 3) et 3 échecs.
 * Aucune pause pour 409, résultat inattendu, transport, écriture, vérification, arrêt manuel : « Réessayer » reste immédiat.
 */
export function calculerPauseJusqua(arret: { raison: RaisonArret; codeHttp: number | null; seuilRefus?: boolean }, maintenant: number): number | null {
  if (arret.seuilRefus === true) return maintenant + PAUSE_LOTS_MS
  if (arret.raison === 'echecs') return maintenant + PAUSE_LOTS_MS
  if (arret.raison === 'code-http' && arret.codeHttp !== null && CODES_PAUSE.includes(arret.codeHttp)) return maintenant + PAUSE_LOTS_MS
  return null
}

/** Vrai tant que `maintenant` est avant l’heure de fin (exclue). */
export function pauseActive(pauseJusqua: number | null, maintenant: number): boolean {
  return pauseJusqua !== null && maintenant < pauseJusqua
}

const deuxChiffres = (n: number): string => String(n).padStart(2, '0')

/** « HH:MM » en heure locale. */
export function heureReprise(pauseJusqua: number): string {
  const d = new Date(pauseJusqua)
  return `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`
}

/** Raison d’un bouton désactivé pendant la pause ; `null` hors pause. */
export function raisonPause(pauseJusqua: number | null, maintenant: number): string | null {
  return pauseJusqua !== null && pauseActive(pauseJusqua, maintenant) ? `Reprise possible à ${heureReprise(pauseJusqua)}` : null
}

/** Raison écrite quand « Réessayer » est refusé parce que le résultat de l’action est inconnu (décision 2). */
export const RAISON_RESULTAT_INCONNU = 'Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action'

/** Vrai si la dernière entrée de journal de l’action, dans l’exécution, a le résultat `inconnu`. */
export function resultatInconnu(
  journal: readonly EntreeJournal[],
  action: { type: TypeAction; parametre: string | null; idCarte: string },
  idLot: string,
): boolean {
  for (let i = journal.length - 1; i >= 0; i--) {
    const e = journal[i]!
    if (e.idLot === idLot && e.idCarte === action.idCarte && e.type === action.type && e.parametre === action.parametre) return e.resultat === 'inconnu'
  }
  return false
}

export interface EtatChoix {
  visible: boolean
  actif: boolean
  /** Raison écrite d’un choix désactivé ; `null` sinon. */
  raison: string | null
}

export interface ChoixPanneau {
  reessayer: EtatChoix
  sauterAction: EtatChoix
  sauterLot: EtatChoix
  ignorer: EtatChoix
  arreterTout: EtatChoix
  fermer: EtatChoix
  preparerNouveauLot: EtatChoix
}

const ACTIF: EtatChoix = { visible: true, actif: true, raison: null }
const MASQUE: EtatChoix = { visible: false, actif: false, raison: null }

/**
 * États des choix du panneau d’erreur (D-33). Reprise impossible (restantes perdues après un rechargement) : plus de
 * Réessayer, Sauter ni Ignorer ; « Fermer » et « Préparer un nouveau lot » remplacent « Arrêter tout ». Sinon,
 * « Réessayer » est désactivé pendant la pause (raison datée), puis après un résultat inconnu ; le reste reste actif.
 */
export function choixPanneau(p: {
  pauseJusqua: number | null
  maintenant: number
  repriseImpossible: boolean
  resultatInconnu: boolean
}): ChoixPanneau {
  if (p.repriseImpossible) {
    return {
      reessayer: MASQUE,
      sauterAction: MASQUE,
      sauterLot: MASQUE,
      ignorer: MASQUE,
      arreterTout: MASQUE,
      fermer: ACTIF,
      preparerNouveauLot: ACTIF,
    }
  }
  const pause = raisonPause(p.pauseJusqua, p.maintenant)
  const raison = pause ?? (p.resultatInconnu ? RAISON_RESULTAT_INCONNU : null)
  return {
    reessayer: raison === null ? ACTIF : { visible: true, actif: false, raison },
    sauterAction: ACTIF,
    sauterLot: ACTIF,
    ignorer: ACTIF,
    arreterTout: ACTIF,
    fermer: MASQUE,
    preparerNouveauLot: MASQUE,
  }
}
