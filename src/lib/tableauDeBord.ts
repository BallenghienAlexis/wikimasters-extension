/**
 * Chiffres de l’onglet Tableau de bord (T-301). Logique pure : pas de `chrome.*`, horloge injectée.
 *
 * Export principal : `calculerTableauDeBord(collection, contexte, maintenant)`, importé par T-305
 * Types exportés : `ContexteTableauDeBord`, `TableauDeBord`, `PastilleSynchro`.
 *
 * Règles : plus de statut local (les étiquettes du site font foi). Valeur et part valent `null`
 * quand elles n’ont pas de sens (jamais `NaN`).
 */
import type { Collection } from './collection'
import { calculerEcarts } from './ecarts'
import type { Config } from './lot'
import { ancienneteMaxPrixMs } from './ordonnanceur'
import { themesPrincipaux } from './themes'

export type PastilleSynchro = 'a-jour' | 'en-cours' | 'arretee' | 'erreur'

export interface ContexteTableauDeBord {
  synchro: { activee: boolean; etat: PastilleSynchro; derniereTerminee: number | null }
  /** Relevés de prix par identifiant de carte (valeur éventuellement inconnue). */
  prix: Record<string, { valeur: number | null; releveLe: number }>
  /** Amis (préférences) : nécessaires aux étiquettes « #À échanger <nom> » attendues. */
  amis?: Config['amis']
  limiteParExemplaire?: Config['limiteParExemplaire']
}

export interface TableauDeBord {
  exemplaires: number
  distinctes: number
  valeur: number | null
  partSansPrix: number | null
  ecarts: number
  /** Cartes reliées au site pour lesquelles aucun thème fiable n’est encore connu (aucune étiquette de thème posée). */
  sansTheme: number
  sante: { pastille: PastilleSynchro; ageLibelle: string }
  fraicheurPrix: { releves: number; plusRecent: number | null; plusAncien: number | null }
}

const MIN = 60_000

export function ageLibelle(synchro: ContexteTableauDeBord['synchro'], maintenant: number): string {
  if (!synchro.activee) return 'synchro automatique coupée'
  if (synchro.derniereTerminee === null) return 'jamais'
  const minutes = Math.floor(Math.max(0, maintenant - synchro.derniereTerminee) / MIN)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  return `il y a ${Math.floor(heures / 24)} j`
}

export function calculerTableauDeBord(
  collection: Collection,
  contexte: ContexteTableauDeBord,
  maintenant: number,
): TableauDeBord {
  const cartes = collection.cartes
  const hors = cartes
  const exemplaires = hors.reduce((s, c) => s + c.quantite, 0)

  const connues = hors.filter((c) => c.valeurMarchande !== null)
  const valeur = connues.length === 0 ? null : connues.reduce((s, c) => s + (c.valeurMarchande ?? 0) * c.quantite, 0)
  const partSansPrix = hors.length === 0 ? null : Math.round(((hors.length - connues.length) * 100) / hors.length)

  const releves = Object.values(contexte.prix).map((p) => p.releveLe)
  return {
    exemplaires,
    distinctes: hors.length,
    valeur,
    partSansPrix,
    sansTheme: hors.filter((c) => c.idsSite !== null && themesPrincipaux(c).length === 0).length,
    ecarts: calculerEcarts(cartes, { amis: contexte.amis, limiteParExemplaire: contexte.limiteParExemplaire }).length,
    sante: { pastille: contexte.synchro.etat, ageLibelle: ageLibelle(contexte.synchro, maintenant) },
    fraicheurPrix: {
      releves: releves.length,
      plusRecent: releves.length === 0 ? null : Math.max(...releves),
      plusAncien: releves.length === 0 ? null : Math.min(...releves),
    },
  }
}

export interface LigneSante {
  symbole: string
  nom: string
  texte: string
  lien?: { libelle: string; href: string; nomAccessible: string }
}

export interface EntreeLignesSante {
  /** Exemplaires de la collection. */
  exemplaires: number
  /** Libellé d’âge de la dernière synchro terminée (« il y a 12 min »). */
  ageLibelle: string
  derniereTerminee: number | null
  /** Étiquettes lues à la dernière synchro. */
  etiquettesLues: number
  /** Dates de relevé des prix connus. */
  releves: readonly number[]
  ignorees: number
  maintenant: number
}

const accord = (n: number, singulier: string, pluriel: string): string => `${n} ${n > 1 ? pluriel : singulier}`

/** Santé de la synchro en quatre lignes (maquette) : Lecture, Étiquettes, Prix, Ignorées. Symbole et mot, jamais la couleur seule. */
export function lignesSante(e: EntreeLignesSante): LigneSante[] {
  const perimes = e.releves.filter((d) => e.maintenant - d > ancienneteMaxPrixMs).length
  return [
    e.derniereTerminee !== null
      ? { symbole: '✓', nom: 'Lecture', texte: `${accord(e.exemplaires, 'exemplaire', 'exemplaires')} · ${e.ageLibelle}` }
      : { symbole: '○', nom: 'Lecture', texte: 'Pas encore de synchro terminée' },
    e.etiquettesLues > 0
      ? { symbole: '✓', nom: 'Étiquettes', texte: `${accord(e.etiquettesLues, 'étiquette lue', 'étiquettes lues')} à la dernière synchro` }
      : { symbole: '○', nom: 'Étiquettes', texte: 'Aucune étiquette lue' },
    perimes > 0
      ? { symbole: '○', nom: 'Prix', texte: `${accord(perimes, 'prix à rafraîchir', 'prix à rafraîchir')} (plus de 7 jours)` }
      : e.releves.length > 0
        ? { symbole: '✓', nom: 'Prix', texte: `${accord(e.releves.length, 'prix relevé', 'prix relevés')}, tous récents` }
        : { symbole: '○', nom: 'Prix', texte: 'Aucun prix relevé' },
    e.ignorees > 0
      ? {
          symbole: '✕',
          nom: 'Ignorées',
          texte: `${accord(e.ignorees, 'action ignorée', 'actions ignorées')} jusqu’à la prochaine synchro`,
          lien: { libelle: 'Gérer', href: '#synchro', nomAccessible: 'Gérer les actions ignorées' },
        }
      : { symbole: '✓', nom: 'Ignorées', texte: 'Aucune action ignorée' },
  ]
}
