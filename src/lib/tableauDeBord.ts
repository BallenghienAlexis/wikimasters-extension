/**
 * Chiffres de l’onglet Tableau de bord (T-301). Logique pure : pas de `chrome.*`, horloge injectée.
 *
 * Export principal : `calculerTableauDeBord(collection, contexte, maintenant)`, importé par T-305
 * (et T-318 pour les places). Types exportés : `ContexteTableauDeBord`, `TableauDeBord`,
 * `LigneRepartition`, `PastilleSynchro`.
 *
 * Règles : `en-vente` est exclu des totaux (exemplaires, distinctes, valeur, part sans prix) mais
 * présent dans la répartition (H6). Valeur et part valent `null` quand elles n’ont pas de sens
 * (jamais `NaN`). Parts de la répartition arrondies par plus forts restes (somme = 100).
 */
import type { Collection, Statut } from './collection'
import { calculerEcarts } from './ecarts'
import { placesEncheres, type Config } from './lot'
import { valeurParDecision } from './analyses'

export type PastilleSynchro = 'a-jour' | 'en-cours' | 'arretee' | 'erreur'

export interface ContexteTableauDeBord {
  maxVentesSimultanees: number
  ventesSite: Config['ventesSite'] | null
  synchro: { activee: boolean; etat: PastilleSynchro; derniereTerminee: number | null }
  /** Relevés de prix par identifiant de carte (valeur éventuellement inconnue). */
  prix: Record<string, { valeur: number | null; releveLe: number }>
  /** Amis (préférences) : nécessaires aux étiquettes « #À échanger <nom> » attendues. */
  amis?: Config['amis']
  limiteParExemplaire?: Config['limiteParExemplaire']
}

export interface LigneRepartition {
  statut: Statut
  exemplaires: number
  valeur: number | null
  /** Pourcentage entier des exemplaires (toutes lignes confondues, en-vente compris). */
  part: number
  /** Trois titres au plus, dans l’ordre de la collection. */
  exemples: string[]
}

export interface TableauDeBord {
  exemplaires: number
  distinctes: number
  enVente: number
  valeur: number | null
  partSansPrix: number | null
  places: { occupees: number; max: number }
  ecarts: number
  repartition: LigneRepartition[]
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

/** Plus forts restes ; égalité départagée par l’ordre d’entrée. Somme = 100 si total > 0. */
function partsEntieres(nombres: readonly number[]): number[] {
  const total = nombres.reduce((s, n) => s + n, 0)
  if (total <= 0) return nombres.map(() => 0)
  const base = nombres.map((n) => Math.floor((n * 100) / total))
  const restes = nombres.map((n, i) => ({ i, reste: (n * 100) % total }))
  restes.sort((a, b) => b.reste - a.reste || a.i - b.i)
  let manque = 100 - base.reduce((s, n) => s + n, 0)
  for (const { i } of restes) {
    if (manque <= 0) break
    base[i] = (base[i] ?? 0) + 1
    manque--
  }
  return base
}

export function calculerTableauDeBord(
  collection: Collection,
  contexte: ContexteTableauDeBord,
  maintenant: number,
): TableauDeBord {
  const cartes = collection.cartes
  const hors = cartes.filter((c) => c.statut !== 'en-vente')
  const enVente = cartes.length - hors.length
  const exemplaires = hors.reduce((s, c) => s + c.quantite, 0)

  const connues = hors.filter((c) => c.valeurMarchande !== null)
  const valeur = connues.length === 0 ? null : connues.reduce((s, c) => s + (c.valeurMarchande ?? 0) * c.quantite, 0)
  const partSansPrix = hors.length === 0 ? null : Math.round(((hors.length - connues.length) * 100) / hors.length)

  const lignes = valeurParDecision(cartes).map((l) => ({
    ...l,
    exemples: cartes.filter((c) => c.statut === l.statut).slice(0, 3).map((c) => c.titre),
  }))
  const parts = partsEntieres(lignes.map((l) => l.exemplaires))
  const repartition = lignes.map((l, i) => ({ ...l, part: parts[i] ?? 0 }))

  const releves = Object.values(contexte.prix).map((p) => p.releveLe)
  return {
    exemplaires,
    distinctes: hors.length,
    enVente,
    valeur,
    partSansPrix,
    places: placesEncheres(contexte, enVente),
    ecarts: calculerEcarts(cartes, { amis: contexte.amis, limiteParExemplaire: contexte.limiteParExemplaire }).length,
    repartition,
    sante: { pastille: contexte.synchro.etat, ageLibelle: ageLibelle(contexte.synchro, maintenant) },
    fraicheurPrix: {
      releves: releves.length,
      plusRecent: releves.length === 0 ? null : Math.max(...releves),
      plusAncien: releves.length === 0 ? null : Math.min(...releves),
    },
  }
}
