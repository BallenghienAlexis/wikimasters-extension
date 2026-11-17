import type { EntreeContrat } from '../contrat'
import type { Action, TypeAction } from '../actions'

/**
 * Entrée du contrat pour la mise en favori d’un exemplaire (relevé d’Alexis du 2026-11-15) :
 * `PATCH /rest/v1/user_cards?id=eq.<exemplaire>`, corps `{ "starred": true }`, réponse 204 sans corps.
 * Ni hôte ni valeur d’authentification ici : `reseau.ts` les ajoute. Corps `starred: true`, sauf pour un choix manuel
 * du joueur (Alexis, 2026-11-17) qui décoche l’étoile : `starred: false`. Une règle n’envoie jamais `false`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ENTREES_FAVORI: Partial<Record<TypeAction, EntreeContrat>> = {
  favori: {
    methode: 'PATCH',
    modeleChemin: '/rest/v1/user_cards?id=eq.<id>',
    construireChemin: (action: Action) => {
      if (action.type !== 'favori' || !UUID.test(action.idExemplaire)) throw new Error('Identifiant invalide.')
      return `/rest/v1/user_cards?id=eq.${encodeURIComponent(action.idExemplaire)}`
    },
    construireCorps: (action: Action) => (action.type === 'favori' && UUID.test(action.idExemplaire) ? { starred: action.valeur !== false } : null),
    auth: { entete: 'session' },
    validerReponse: (statut) => (statut === 204 ? 'reussie' : 'hors-contrat'),
  },
}
