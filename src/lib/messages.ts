/**
 * Protocole du port page ↔ content script (SC-015, SC-018).
 *
 * Quatre messages : `bonjour` (content → page), `ordre` (page → content),
 * `resultat` (content → page) et `arret`. Validation par liste blanche : tout
 * champ inconnu fait rejeter le message (`null`). Aucun type exporté n’a de champ
 * libre : rien ne peut transporter un jeton, un en-tête ou un corps de réponse.
 *
 * Logique pure : pas de `chrome.runtime` ici.
 */
import { TYPES_ACTION, type Action, type ResultatAction, type TypeAction } from './actions'

const LONGUEUR_MAX = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuid = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null)

/** Nom du port ouvert par le content script vers la page de gestion. */
export const NOM_PORT = 'wm-synchro'

/** Plafond du prix de départ d’une enchère (au-delà : ordre rejeté). */
export const PRIX_MAX = 1_000_000

/**
 * Libellés fixes admis dans `cause` d’un résultat. Une cause hors liste fait rejeter le
 * message : rien de libre (jeton, en-tête, corps) ne peut transiter par ce champ.
 */
export const CAUSES_RESULTAT: readonly string[] = [
  'action réussie',
  'action non disponible',
  'erreur d’émission',
  'erreur de transport',
  'erreur réseau',
  'délai dépassé',
  'réponse hors contrat',
  'jeton-absent',
]

const CLASSES: ReadonlyArray<ResultatAction['classe']> = ['reussie', 'echec', 'arret', 'inconnu']

export interface MessageBonjour {
  message: 'bonjour'
}
export interface MessageOrdre {
  message: 'ordre'
  ordre: Action
}
export interface MessageResultat {
  message: 'resultat'
  resultat: ResultatAction
}
export interface MessageArret {
  message: 'arret'
}

/** Tout message admis sur le port. */
export type MessageProtocole = MessageBonjour | MessageOrdre | MessageResultat | MessageArret

export function messageBonjour(): MessageBonjour {
  return { message: 'bonjour' }
}

export function messageOrdre(ordre: Action): MessageOrdre {
  return { message: 'ordre', ordre }
}

export function messageResultat(resultat: ResultatAction): MessageResultat {
  return { message: 'resultat', resultat }
}

export function messageArret(): MessageArret {
  return { message: 'arret' }
}

type Brut = Record<string, unknown>

function enObjet(valeur: unknown): Brut | null {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return null
  return valeur as Brut
}

/** Vrai si l’objet n’a que des clés de la liste (la liste doit être exacte, aucun champ optionnel). */
function cles(objet: Brut, attendues: readonly string[]): boolean {
  const presentes = Object.keys(objet)
  return presentes.length === attendues.length && attendues.every((c) => presentes.includes(c))
}

function texte(valeur: unknown): string | null {
  if (typeof valeur !== 'string' || valeur.length === 0 || valeur.length > LONGUEUR_MAX) return null
  return valeur
}

/** Valide un signal sans charge utile (`bonjour` ou `arret`) ; `null` pour tout le reste. */
export function validerSignal(brut: unknown): 'bonjour' | 'arret' | null {
  const enveloppe = enObjet(brut)
  if (!enveloppe || !cles(enveloppe, ['message'])) return null
  return enveloppe.message === 'bonjour' || enveloppe.message === 'arret' ? enveloppe.message : null
}

/** Valide un ordre : enveloppe `{ message: 'ordre', ordre }`. Renvoie l’action ou `null`. */
export function validerOrdre(brut: unknown): Action | null {
  const enveloppe = enObjet(brut)
  if (!enveloppe || !cles(enveloppe, ['message', 'ordre']) || enveloppe.message !== 'ordre') return null
  const ordre = enObjet(enveloppe.ordre)
  if (!ordre) return null
  const type = ordre.type
  if (typeof type !== 'string' || !(TYPES_ACTION as readonly string[]).includes(type)) return null
  const idCarte = texte(ordre.idCarte)
  if (idCarte === null) return null

  switch (type as TypeAction) {
    case 'lecture':
      return cles(ordre, ['type', 'idCarte']) ? { type: 'lecture', idCarte } : null
    case 'creation-etiquette': {
      const nomEtiquette = texte(ordre.nomEtiquette)
      if (!cles(ordre, ['type', 'idCarte', 'nomEtiquette']) || nomEtiquette === null) return null
      return { type: 'creation-etiquette', idCarte, nomEtiquette }
    }
    case 'retrait-etiquette':
    case 'pose-etiquette': {
      const idExemplaire = texte(ordre.idExemplaire)
      const nomEtiquette = texte(ordre.nomEtiquette)
      const avecId = 'idEtiquette' in ordre
      if (!cles(ordre, ['type', 'idCarte', 'idExemplaire', 'nomEtiquette', ...(avecId ? ['idEtiquette'] : [])])) return null
      if (idExemplaire === null || nomEtiquette === null) return null
      const base = { type: type as 'retrait-etiquette' | 'pose-etiquette', idCarte, idExemplaire, nomEtiquette }
      if (!avecId) return base
      const idEtiquette = uuid(ordre.idEtiquette)
      return idEtiquette === null ? null : { ...base, idEtiquette }
    }
    case 'enchere': {
      const idExemplaire = texte(ordre.idExemplaire)
      const prix = ordre.prix
      if (!cles(ordre, ['type', 'idCarte', 'idExemplaire', 'prix']) || idExemplaire === null) return null
      if (typeof prix !== 'number' || !Number.isSafeInteger(prix) || prix < 1 || prix > PRIX_MAX) return null
      return { type: 'enchere', idCarte, idExemplaire, prix }
    }
    case 'defausse': {
      const idExemplaire = texte(ordre.idExemplaire)
      if (!cles(ordre, ['type', 'idCarte', 'idExemplaire']) || idExemplaire === null) return null
      return { type: 'defausse', idCarte, idExemplaire }
    }
  }
}

/** Valide un résultat : enveloppe `{ message: 'resultat', resultat }`. Renvoie le résultat ou `null`. */
export function validerResultat(brut: unknown): ResultatAction | null {
  const enveloppe = enObjet(brut)
  if (!enveloppe || !cles(enveloppe, ['message', 'resultat']) || enveloppe.message !== 'resultat') return null
  const resultat = enObjet(enveloppe.resultat)
  const avecId = resultat !== null && 'idEtiquette' in resultat
  if (!resultat || !cles(resultat, ['classe', 'codeHttp', 'cause', ...(avecId ? ['idEtiquette'] : [])])) return null
  const { classe, codeHttp } = resultat
  if (typeof classe !== 'string' || !(CLASSES as readonly string[]).includes(classe)) return null
  if (codeHttp !== null) {
    if (typeof codeHttp !== 'number' || !Number.isInteger(codeHttp) || codeHttp < 100 || codeHttp > 599) return null
  }
  const cause = texte(resultat.cause)
  if (cause === null || !CAUSES_RESULTAT.includes(cause)) return null
  const base = { classe: classe as ResultatAction['classe'], codeHttp: codeHttp as number | null, cause }
  if (!avecId) return base
  const idEtiquette = uuid(resultat.idEtiquette)
  return idEtiquette === null ? null : { ...base, idEtiquette }
}
