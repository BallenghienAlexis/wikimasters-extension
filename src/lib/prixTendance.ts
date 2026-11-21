/**
 * Prix de départ d'une mise aux enchères selon la tendance du marché (Alexis, 2026-11-21). Logique pure : aucune requête,
 * aucun accès à `chrome.*`. La tendance vient de `price-history` (voir `lectureApi.ts`) et est relue juste avant chaque mise
 * en vente par `reseau.ts` ; l'aperçu d'un lot n'en donne qu'une estimation fondée sur la dernière tendance mémorisée.
 */
import { REGLE_PRIX } from '../config/prix'
import type { TendancePrix } from './lectureApi'

export type MotifPrix = 'normal' | 'hausse' | 'baisse' | 'peu-de-ventes'

export interface PrixDepart {
  prix: number
  motif: MotifPrix
}

/**
 * `valeur` : prix moyen de la dernière semaine. `tendance` : absente (jamais relevée) = règle de base sans ajustement.
 * `null` : valeur sous le minimum de vente, ou prix qui ne tiendrait pas sous la valeur du marché.
 */
export function prixDepartSelonTendance(valeur: number, tendance: TendancePrix | null | undefined): PrixDepart | null {
  if (!Number.isFinite(valeur) || valeur < REGLE_PRIX.valeurMinVente) return null
  let reference = valeur
  let coef: number = REGLE_PRIX.coefDepart
  let motif: MotifPrix = 'normal'
  if (tendance) {
    if (tendance.ventes4 < REGLE_PRIX.minVentes) {
      reference = Math.min(reference, Math.round((tendance.min4 + reference) / 2))
      motif = 'peu-de-ventes'
    }
    const v = tendance.variationPct
    if (v !== null) {
      if (v >= REGLE_PRIX.seuilVariation) {
        const precedente = valeur / (1 + v / 100)
        reference = Math.min(reference, Math.round((valeur + precedente) / 2))
        motif = 'hausse'
      } else if (v <= -REGLE_PRIX.seuilVariation) {
        coef = REGLE_PRIX.coefBaisse
        motif = 'baisse'
      }
    }
  }
  const prix = Math.max(1, Math.floor(reference * coef))
  if (!Number.isSafeInteger(prix) || prix >= valeur) return null
  return { prix, motif }
}
