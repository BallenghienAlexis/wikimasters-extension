/**
 * Familles de lots et découpage d’une exécution (T-302, D-20).
 *
 * - `familleDe(action)` : famille d’une action (création, retrait et pose d’étiquette = `etiquettes`) ;
 * - `decouperEnLots(actions)` : un lot par famille présente, dans l’ordre de première apparition ; l’appartenance
 *   à la famille décide, pas la position (un retrait ajouté en fin de file rejoint le lot Étiquettes).
 *
 * Fonctions pures : aucun accès à `chrome.*` ni au stockage.
 */
import type { Action, FamilleLot, TypeAction } from './actions'

const FAMILLE_PAR_TYPE: Record<TypeAction, FamilleLot> = {
  lecture: 'lectures',
  'creation-etiquette': 'etiquettes',
  'retrait-etiquette': 'etiquettes',
  'pose-etiquette': 'etiquettes',
  enchere: 'encheres',
  defausse: 'defausses',
  'suppression-etiquette': 'suppressions',
}

/** Famille d’une action (ou de tout objet portant son type). */
export function familleDe(action: Action | { type: TypeAction }): FamilleLot {
  return FAMILLE_PAR_TYPE[action.type]
}

export interface LotDActions {
  famille: FamilleLot
  actions: Action[]
}

/** Découpe les actions en lots par famille, dans l’ordre de première apparition. */
export function decouperEnLots(actions: Action[]): LotDActions[] {
  const lots = new Map<FamilleLot, LotDActions>()
  for (const action of actions) {
    const famille = familleDe(action)
    let lot = lots.get(famille)
    if (!lot) {
      lot = { famille, actions: [] }
      lots.set(famille, lot)
    }
    lot.actions.push(action)
  }
  return [...lots.values()]
}
