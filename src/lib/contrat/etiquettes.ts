import type { EntreeContrat } from '../contrat'
import type { Action, TypeAction } from '../actions'

/**
 * Entrées du contrat pour les étiquettes (relevé du 2026-11-11, `contrat-api.md`).
 * Ni hôte ni nom d’en-tête d’authentification ici : `reseau.ts` les ajoute.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const enc = encodeURIComponent

function ids(action: Action): { exemplaire: string; etiquette: string } | null {
  if (action.type !== 'pose-etiquette' && action.type !== 'retrait-etiquette') return null
  if (!action.idEtiquette || !UUID.test(action.idEtiquette) || !UUID.test(action.idExemplaire)) return null
  return { exemplaire: action.idExemplaire, etiquette: action.idEtiquette }
}

function objet(json: unknown): Record<string, unknown> | null {
  const brut = Array.isArray(json) && json.length === 1 ? json[0] : json
  return typeof brut === 'object' && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : null
}

function idCree(json: unknown): string | null {
  const id = objet(json)?.id
  return typeof id === 'string' && UUID.test(id) ? id : null
}

export const ENTREES_ETIQUETTES: Partial<Record<TypeAction, EntreeContrat>> = {
  'creation-etiquette': {
    methode: 'POST',
    modeleChemin: '/rest/v1/tags?select=*',
    construireChemin: () => '/rest/v1/tags?select=*',
    construireCorps: (action, contexte) =>
      action.type === 'creation-etiquette'
        ? { user_id: contexte.idJoueur, name: action.nomEtiquette, color: contexte.couleurEtiquette }
        : null,
    entetes: { Prefer: 'return=representation' },
    lireIdEtiquette: idCree,
    auth: { entete: 'session' },
    validerReponse: (statut, json) => (statut === 201 && idCree(json) !== null ? 'reussie' : 'hors-contrat'),
  },
  'pose-etiquette': {
    methode: 'POST',
    modeleChemin: '/rest/v1/user_card_tags',
    construireChemin: () => '/rest/v1/user_card_tags',
    construireCorps: (action) => {
      const i = ids(action)
      return i === null ? null : { user_card_id: i.exemplaire, tag_id: i.etiquette }
    },
    auth: { entete: 'session' },
    validerReponse: (statut) => (statut === 201 ? 'reussie' : 'hors-contrat'),
  },
  'retrait-etiquette': {
    methode: 'DELETE',
    modeleChemin: '/rest/v1/user_card_tags?user_card_id=eq.<id>&tag_id=eq.<id>',
    construireChemin: (action) => {
      const i = ids(action)
      if (i === null) throw new Error('Identifiants invalides.')
      // Le filtre ne vise qu’un couple (exemplaire, étiquette) : l’étiquette n’est jamais supprimée.
      return `/rest/v1/user_card_tags?user_card_id=eq.${enc(i.exemplaire)}&tag_id=eq.${enc(i.etiquette)}`
    },
    construireCorps: () => null,
    auth: { entete: 'session' },
    validerReponse: (statut) => (statut === 204 ? 'reussie' : 'hors-contrat'),
  },
}
