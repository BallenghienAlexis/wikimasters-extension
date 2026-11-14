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
  sante: { pastille: PastilleSynchro; ageLibelle: string }
  fraicheurPrix: { releves: number; plusRecent: number | null; plusAncien: number | null }
}

const MIN = 60_000

function ageLibelle(synchro: ContexteTableauDeBord['synchro'], maintenant: number): string {
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
    ecarts: calculerEcarts(cartes, { amis: contexte.amis, limiteParExemplaire: contexte.limiteParExemplaire }).length,
    sante: { pastille: contexte.synchro.etat, ageLibelle: ageLibelle(contexte.synchro, maintenant) },
    fraicheurPrix: {
      releves: releves.length,
      plusRecent: releves.length === 0 ? null : Math.max(...releves),
      plusAncien: releves.length === 0 ? null : Math.min(...releves),
    },
  }
}
