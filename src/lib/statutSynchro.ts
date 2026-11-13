/**
 * Statut détaillé de la synchronisation automatique (v2) : validation et migration v1 → v2.
 * Logique pure, sans `chrome.*`. Uniquement des nombres et des codes fixes (aucun secret).
 */

import type { RaisonArretSynchro } from './ordonnanceur'

export type EtapeSynchro = 'stats' | 'pages' | 'prix' | 'ventes'

interface StatutBase {
  etat: 'en-cours' | 'termine' | 'arret'
  /** Page en cours de lecture (à partir de 1), ou `null` tant qu’elle n’est pas connue. */
  page: number | null
  pages: number | null
  raison: RaisonArretSynchro | null
  /** Code HTTP de l’arrêt (100 à 599), ou `null`. */
  codeHttp: number | null
  /** Horodatage de la dernière mise à jour. */
  le: number
  ajoutees: number
  etiquettes: number
  prix: number
}

/**
 * Statut accepté en entrée : version 1 ou 2 (les champs v2 sont facultatifs en v1). Le content script
 * passe en v2 dans la tâche T-314 ; la lecture rend toujours une v2 complète (`StatutSynchroV2`).
 */
export interface StatutSynchro extends StatutBase {
  version: 1 | 2
  etape?: EtapeSynchro | null
  prixFaits?: number | null
  prixPrevus?: number | null
  /** Horodatage de début de la synchro (décision 1 de tasks.md). */
  debut?: number | null
}

/** Statut lu : toujours en v2, champs v2 à `null` pour une v1. */
export interface StatutSynchroV2 extends StatutBase {
  version: 2
  etape: EtapeSynchro | null
  prixFaits: number | null
  prixPrevus: number | null
  debut: number | null
}

const ETATS = ['en-cours', 'termine', 'arret']
const RAISONS = ['manuel', 'code-http', 'echecs']
const ETAPES = ['stats', 'pages', 'prix', 'ventes']

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const entier = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const nullOuEntier = (v: unknown): v is number | null => v === null || entier(v)

/** Valide un statut v1 ou v2 et le rend en v2 ; `null` si version inconnue ou forme inattendue. */
export function validerStatutSynchro(brut: unknown): StatutSynchroV2 | null {
  if (!objet(brut) || (brut.version !== 1 && brut.version !== 2)) return null
  const { etat, page, pages, raison, codeHttp, le, ajoutees, etiquettes, prix } = brut
  if (typeof etat !== 'string' || !ETATS.includes(etat)) return null
  if (!nullOuEntier(page) || !nullOuEntier(pages)) return null
  if (raison !== null && (typeof raison !== 'string' || !RAISONS.includes(raison))) return null
  if (codeHttp !== null && !(typeof codeHttp === 'number' && Number.isSafeInteger(codeHttp) && codeHttp >= 100 && codeHttp <= 599)) return null
  if (!entier(le) || !entier(ajoutees) || !entier(etiquettes) || !entier(prix)) return null
  let etape: EtapeSynchro | null = null
  let prixFaits: number | null = null
  let prixPrevus: number | null = null
  let debut: number | null = null
  if (brut.version === 2) {
    if (brut.etape !== null && (typeof brut.etape !== 'string' || !ETAPES.includes(brut.etape))) return null
    if (!nullOuEntier(brut.prixFaits) || !nullOuEntier(brut.prixPrevus) || !nullOuEntier(brut.debut)) return null
    etape = brut.etape as EtapeSynchro | null
    prixFaits = brut.prixFaits
    prixPrevus = brut.prixPrevus
    debut = brut.debut
  }
  return {
    version: 2,
    etat: etat as StatutBase['etat'],
    page,
    pages,
    raison: raison as RaisonArretSynchro | null,
    codeHttp,
    le,
    ajoutees,
    etiquettes,
    prix,
    etape,
    prixFaits,
    prixPrevus,
    debut,
  }
}
