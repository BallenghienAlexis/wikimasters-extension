/**
 * Modèle de progression (T-302, D-10, D-11, D-20, D-21) : barres, annonces `aria-live`, durée restante, listes
 * de tâches. Fonctions pures, horloge injectée, aucun accès à `chrome.*` ni au stockage.
 *
 * - `Barre` : `pourcent` entier arrondi à l’inférieur ; `texte` « N / M · P % » ou « N lus » si M est inconnu ;
 *   `precedent` garantit un pourcent monotone.
 * - `progressionLot`, `progressionExecution`, `progressionSynchro` : barres d’un lot, de l’exécution, de la synchro.
 * - `annoncer(precedent, courant, maintenant)` : au plus une annonce toutes les 2 s, sur changement de clé ou palier de 10 %.
 * - `secondesExecution`, `secondesSynchro`, `dureeRestante` : durée restante H4 (0,25 s par requête).
 * - `listesTaches({ statut, execution, journal })` : listes En cours, À venir, Terminées.
 */
import type { EntreeJournal, EtatExecutionV2, FamilleLot, LotExecution } from './actions'
import type { EtapeSynchro, StatutSynchroV2 } from './statutSynchro'

export interface Barre {
  valeur: number | null
  max: number | null
  pourcent: number | null
  indeterminee: boolean
  texte: string
}

export const SECONDES_PAR_ACTION = 0.25
export const INTERVALLE_ANNONCE_MS = 2000
export const ETAPES_SYNCHRO: readonly EtapeSynchro[] = ['stats', 'pages', 'prix', 'ventes']

const plafonner = (p: number): number => Math.max(0, Math.min(100, Math.floor(p)))

function monotone(pourcent: number, precedent?: Barre | null): number {
  return precedent && precedent.pourcent !== null ? Math.max(pourcent, precedent.pourcent) : pourcent
}

/** Barre « N / M · P % », ou « N lus » (indéterminée) quand M est inconnu. */
function barre(n: number, m: number | null, precedent?: Barre | null): Barre {
  const valeur = Math.max(0, n)
  if (m === null) {
    return { valeur, max: null, pourcent: null, indeterminee: true, texte: `${valeur} lus` }
  }
  const brut = m > 0 ? plafonner((100 * valeur) / m) : 0
  const pourcent = monotone(brut, precedent)
  return { valeur, max: m, pourcent, indeterminee: false, texte: `${valeur} / ${m} · ${pourcent} %` }
}

/** Progression d’un lot : N = traitées + sautées, M = total. */
export function progressionLot(lot: LotExecution, precedent?: Barre | null): Barre {
  return barre(lot.traitees + lot.sautees, lot.total, precedent)
}

/** Progression globale d’une exécution : N = traitées, M = total. */
export function progressionExecution(etat: EtatExecutionV2, precedent?: Barre | null): Barre {
  return barre(etat.traitees, etat.total, precedent)
}

export interface EtapeProgression {
  etape: EtapeSynchro
  etat: 'faite' | 'en-cours' | 'attente'
  barre: Barre
}

export interface ProgressionSynchro {
  etapeIndex: number | null
  nbEtapes: 4
  indeterminee: boolean
  pourcent: number | null
  texte: string
  etapes: EtapeProgression[]
}

function barreEtape(etape: EtapeSynchro, etat: EtapeProgression['etat'], s: StatutSynchroV2): Barre {
  if (etat === 'faite') return { valeur: 1, max: 1, pourcent: 100, indeterminee: false, texte: '1 / 1 · 100 %' }
  const courante = etat === 'en-cours'
  if (etape === 'pages') {
    const lues = courante && s.page !== null ? s.page - 1 : 0
    return barre(lues, s.pages)
  }
  if (etape === 'prix') return barre(courante ? (s.prixFaits ?? 0) : 0, s.prixPrevus)
  return barre(0, 1)
}

/** Fraction (0 à 1) de l’étape courante. */
function fraction(etape: EtapeSynchro, s: StatutSynchroV2): number {
  if (etape === 'pages' && s.page !== null && s.pages !== null && s.pages > 0) return Math.min(1, (s.page - 1) / s.pages)
  if (etape === 'prix' && s.prixPrevus !== null && s.prixPrevus > 0) return Math.min(1, (s.prixFaits ?? 0) / s.prixPrevus)
  return 0
}

/** Barre globale « Étape i / 4 · P % » (4 étapes de poids égal). */
export function progressionSynchro(statut: StatutSynchroV2, precedent?: Barre | null): ProgressionSynchro {
  const nbEtapes = 4 as const
  const termine = statut.etat === 'termine'
  if (statut.etape === null && !termine) {
    return {
      etapeIndex: null, nbEtapes, indeterminee: true, pourcent: null, texte: 'Synchronisation en cours',
      etapes: ETAPES_SYNCHRO.map((etape) => ({ etape, etat: 'attente' as const, barre: barreEtape(etape, 'attente', statut) })),
    }
  }
  const index = statut.etape === null ? 4 : ETAPES_SYNCHRO.indexOf(statut.etape) + 1
  const etapes = ETAPES_SYNCHRO.map((etape, i): EtapeProgression => {
    const etat = termine || i + 1 < index ? 'faite' : i + 1 === index ? 'en-cours' : 'attente'
    return { etape, etat, barre: barreEtape(etape, etat, statut) }
  })
  const brut = termine ? 100 : plafonner((100 * (index - 1 + fraction(statut.etape as EtapeSynchro, statut))) / nbEtapes)
  const pourcent = monotone(brut, precedent)
  return { etapeIndex: index, nbEtapes, indeterminee: false, pourcent, texte: `Étape ${index} / ${nbEtapes} · ${pourcent} %`, etapes }
}

export interface Annonce {
  le: number
  cle: string
  palier: number
}

/** Décide d’une annonce `aria-live` ; sans annonce, `suivant` est `precedent` inchangé. */
export function annoncer(
  precedent: Annonce | null,
  courant: { cle: string; pourcent: number },
  maintenant: number,
): { annoncer: boolean; suivant: Annonce } {
  const palier = Math.floor(courant.pourcent / 10)
  const nouvelle: Annonce = { le: maintenant, cle: courant.cle, palier }
  if (precedent === null) return { annoncer: true, suivant: nouvelle }
  if (maintenant - precedent.le < INTERVALLE_ANNONCE_MS) return { annoncer: false, suivant: precedent }
  if (courant.cle !== precedent.cle || palier > precedent.palier) return { annoncer: true, suivant: nouvelle }
  return { annoncer: false, suivant: precedent }
}

/** Exécution : actions restantes × 0,25 s, sans division par la concurrence (H4). */
export function secondesExecution(restantes: number): number {
  return Math.max(0, restantes) * SECONDES_PAR_ACTION
}

/** Synchro : (pages restantes + prix restants + 1) × 0,25 s (H4). */
export function secondesSynchro(statut: StatutSynchroV2): number {
  const enLecture = statut.etape === 'stats' || statut.etape === 'pages'
  const pages = enLecture && statut.page !== null && statut.pages !== null ? Math.max(0, statut.pages - statut.page + 1) : 0
  const prix = statut.prixPrevus === null ? 0 : Math.max(0, statut.prixPrevus - (statut.prixFaits ?? 0))
  return (pages + prix + 1) * SECONDES_PAR_ACTION
}

/** « moins d’une minute » sous 60 s, sinon « environ N min » (N arrondi au supérieur). */
export function dureeRestante(secondes: number): string {
  if (secondes < 60) return 'moins d’une minute'
  return `environ ${Math.ceil(secondes / 60)} min`
}

export type Tache = { genre: 'etape'; etape: EtapeSynchro } | { genre: 'lot'; famille: FamilleLot; nombre: number }

export interface ListesTaches {
  aucuneActivite: boolean
  enCours: Tache[]
  aVenir: Tache[]
  terminees: EntreeJournal[]
}

export const NB_TERMINEES = 20

/** Listes En cours / À venir / Terminées ; sans activité, `aucuneActivite` et les seules Terminées. */
export function listesTaches(entree: {
  statut: StatutSynchroV2 | null
  execution: EtatExecutionV2 | null
  journal: EntreeJournal[]
}): ListesTaches {
  const { statut, execution, journal } = entree
  const enCours: Tache[] = []
  const aVenir: Tache[] = []
  const synchroActive = statut !== null && statut.etat === 'en-cours'
  const executionActive = execution !== null && execution.etat === 'en-cours'
  if (synchroActive && statut.etape !== null) {
    const i = ETAPES_SYNCHRO.indexOf(statut.etape)
    enCours.push({ genre: 'etape', etape: statut.etape })
    for (const etape of ETAPES_SYNCHRO.slice(i + 1)) aVenir.push({ genre: 'etape', etape })
  }
  if (executionActive) {
    let premier = true
    for (const lot of execution.lots) {
      const nombre = lot.total - lot.traitees - lot.sautees
      if (nombre <= 0) continue
      const tache: Tache = { genre: 'lot', famille: lot.famille, nombre }
      if (premier) enCours.push(tache)
      else aVenir.push(tache)
      premier = false
    }
  }
  const terminees = journal
    .map((e, i) => ({ e, i, t: Date.parse(e.horodatage) }))
    .sort((a, b) => (Number.isNaN(b.t) ? 0 : b.t) - (Number.isNaN(a.t) ? 0 : a.t) || b.i - a.i)
    .slice(0, NB_TERMINEES)
    .map((x) => x.e)
  return { aucuneActivite: !synchroActive && !executionActive, enCours, aVenir, terminees }
}
