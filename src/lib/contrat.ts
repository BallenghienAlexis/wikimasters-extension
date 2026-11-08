/**
 * Table du contrat : décrit, par type d’action, la requête attendue par le site.
 *
 * Livrée vide : un type absent de la table est « non disponible » (SC-020) et
 * n’est jamais deviné (G5). Ce module ne contient ni URL ni nom d’en-tête ; il
 * n’importe pas `jeton.ts`. Le champ `auth` ne porte que le nom d’un en-tête,
 * jamais une valeur.
 */
import type { Action, TypeAction, TypesDisponibles } from './actions'
import { ENTREES_DEFAUSSE } from './contrat/defausse'
import { ENTREES_ENCHERE } from './contrat/enchere'
import { ENTREES_ETIQUETTES } from './contrat/etiquettes'
import { ENTREES_LECTURE } from './contrat/lecture'

export interface EntreeContrat {
  methode: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Modèle de chemin, pour documentation et validation. */
  modeleChemin: string
  /** Reçoit des identifiants déjà validés ; chaque segment est encodé avec `encodeURIComponent`. */
  construireChemin: (action: Action) => string
  /** Corps JSON de la requête, ou `null` s’il n’y en a pas. */
  construireCorps: (action: Action) => unknown
  /** Nom de l’en-tête d’authentification exigé, ou `null`. Jamais une valeur. */
  auth: { entete: string } | null
  validerReponse: (statut: number, json: unknown) => 'reussie' | 'hors-contrat'
}

export type TableContrat = Partial<Record<TypeAction, EntreeContrat>>

export const TABLE_CONTRAT: TableContrat = {
  ...ENTREES_LECTURE,
  ...ENTREES_ETIQUETTES,
  ...ENTREES_ENCHERE,
  ...ENTREES_DEFAUSSE,
}

export function typesDisponibles(table: TableContrat = TABLE_CONTRAT): TypesDisponibles {
  const types = (Object.keys(table) as TypeAction[]).filter((t) => table[t] !== undefined)
  return new Set(types)
}
