import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'

/**
 * Entrée du contrat pour la défausse (capture d’Alexis du 2026-11-07, `contrat-api.md`) : `POST` sans corps,
 * même origine que l’onglet, cookies du navigateur. Irréversible, sans confirmation (Alexis, 2026-11-12) : garde-fous = plafond de valeur et arrêts sur erreur.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ENTREES_DEFAUSSE: Partial<Record<TypeAction, EntreeContrat>> = {
  defausse: {
    methode: 'POST',
    modeleChemin: '/api/user-cards/<id>/discard',
    construireChemin: (action) => {
      if (action.type !== 'defausse' || !UUID.test(action.idExemplaire)) throw new Error('Identifiant invalide.')
      return `/api/user-cards/${encodeURIComponent(action.idExemplaire)}/discard`
    },
    construireCorps: () => null,
    auth: null,
    hote: 'site',
    sansCorps: true,
    validerReponse: (statut) => (statut === 200 ? 'reussie' : 'hors-contrat'),
  },
}
