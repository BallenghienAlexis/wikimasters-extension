import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'
import { analyserStats, analyserVentes } from '../lectureApi'
import { estObjet } from '../valider'

/**
 * Entrée du contrat pour la lecture des enchères du joueur (`GET /api/marketplace/mine`, lecture déjà autorisée par
 * Alexis, 2026-11-11, relue juste avant un lot d'enchères le 2026-11-15) : même origine que l'onglet, cookies du
 * navigateur, aucun en-tête, aucun jeton. Seuls le nombre d'enchères en cours et le maximum sont retenus.
 */
export const ENTREES_LECTURE: Partial<Record<TypeAction, EntreeContrat>> = {
  lecture: {
    methode: 'GET',
    modeleChemin: '/api/marketplace/mine',
    // Cible `etiquettes` (Alexis, 2026-11-23) : relecture de `my-collection/stats`, route déjà lue par la synchro, avant un lot d'étiquettes.
    construireChemin: (action) => (action.type === 'lecture' && action.cible === 'etiquettes' ? '/api/my-collection/stats?sort=added' : '/api/marketplace/mine'),
    construireCorps: () => null,
    sansCorps: true,
    auth: null,
    hote: 'site',
    lireVentes: analyserVentes,
    lireEtiquettes: (json) => {
      // Seule une liste présente (même vide) est fiable : une réponse allégée sans `tagOptions` ne dit rien des étiquettes.
      if (!estObjet(json) || !Array.isArray(json.tagOptions)) return null
      return analyserStats(json)?.etiquettes.map((e) => ({ id: e.id, nom: e.nom, nbCartes: e.nbCartes })) ?? null
    },
    validerReponse: (statut, json) => (statut === 200 && (analyserVentes(json) !== null || analyserStats(json) !== null) ? 'reussie' : 'hors-contrat'),
  },
}
