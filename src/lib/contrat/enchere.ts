import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'

/**
 * Entrée du contrat pour l’enchère (relevé du 2026-11-11, `contrat-api.md`) : même origine que l’onglet,
 * cookies du navigateur, un seul en-tête (`Content-Type`), aucun jeton. La réponse est `201` avec `{ auction_id }`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DUREE_MINUTES = 60
const PRIX_MAX = 1_000_000

export const ENTREES_ENCHERE: Partial<Record<TypeAction, EntreeContrat>> = {
  enchere: {
    methode: 'POST',
    modeleChemin: '/api/marketplace',
    construireChemin: () => '/api/marketplace',
    construireCorps: (action) => {
      if (action.type !== 'enchere') return null
      // Malgré son nom, le champ `card_id` du corps reçoit l’identifiant de l’exemplaire possédé (`id` de
      // `my-collection`, le même que pour la défausse) : relevé du 2026-11-11 sur la mise aux enchères manuelle
      // d’Ouzbékistan (201) ; avec le `card_id` de la carte, l’extension avait reçu un 409.
      const { idExemplaire, prix } = action
      if (!UUID.test(idExemplaire)) return null
      if (!Number.isSafeInteger(prix) || prix < 1 || prix > PRIX_MAX) return null
      return { card_id: idExemplaire, base_amount: prix, duration_minutes: DUREE_MINUTES }
    },
    auth: null,
    hote: 'site',
    validerReponse: (statut, json) =>
      statut === 201 && typeof json === 'object' && json !== null && typeof (json as { auction_id?: unknown }).auction_id === 'string'
        ? 'reussie'
        : 'hors-contrat',
  },
}
