import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'
import { analyserStats, analyserVentes } from '../lectureApi'
import { estObjet } from '../valider'
import { MAX_ETIQUETTES_SITE } from '../etiquettesPreexistantes'

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
      // Liste tronquée ou option illisible écartée : elle passerait pour complète et ferait recréer des doublons.
      const stats = analyserStats(json)
      if (!stats || stats.etiquettes.length !== json.tagOptions.length || json.tagOptions.length >= MAX_ETIQUETTES_SITE) return null
      return stats.etiquettes.map((e) => ({ id: e.id, nom: e.nom, nbCartes: e.nbCartes }))
    },
    validerReponse: (statut, json, action) => {
      if (statut !== 200) return 'hors-contrat'
      // Chaque cible n'accepte que sa propre forme de réponse.
      const lue = action?.type === 'lecture' && action.cible === 'etiquettes' ? analyserStats(json) : analyserVentes(json)
      return lue !== null ? 'reussie' : 'hors-contrat'
    },
  },
}
