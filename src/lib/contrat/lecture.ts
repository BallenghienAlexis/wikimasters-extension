import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'
import { analyserVentes } from '../lectureApi'

/**
 * Entrée du contrat pour la lecture des enchères du joueur (`GET /api/marketplace/mine`, lecture déjà autorisée par
 * Alexis, 2026-11-11, relue juste avant un lot d'enchères le 2026-11-15) : même origine que l'onglet, cookies du
 * navigateur, aucun en-tête, aucun jeton. Seuls le nombre d'enchères en cours et le maximum sont retenus.
 */
export const ENTREES_LECTURE: Partial<Record<TypeAction, EntreeContrat>> = {
  lecture: {
    methode: 'GET',
    modeleChemin: '/api/marketplace/mine',
    construireChemin: () => '/api/marketplace/mine',
    construireCorps: () => null,
    sansCorps: true,
    auth: null,
    hote: 'site',
    lireVentes: analyserVentes,
    validerReponse: (statut, json) => (statut === 200 && analyserVentes(json) !== null ? 'reussie' : 'hors-contrat'),
  },
}
