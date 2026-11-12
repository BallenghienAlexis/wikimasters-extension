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
import { ID_CARTE_ETIQUETTES, TYPES_ACTION, type Action, type ResultatAction, type TypeAction } from './actions'

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
  'limite d’enchères atteinte',
  'conflit signalé par le site',
]

const CLASSES: ReadonlyArray<ResultatAction['classe']> = ['reussie', 'echec', 'arret', 'inconnu']

export interface MessageBonjour {
  message: 'bonjour'
}
export interface MessageOrdre {
  message: 'ordre'
  ordre: Action
  /** Numéro de corrélation (entier) : le résultat le reprend, ce qui permet plusieurs ordres en attente. */
  id?: number
}
export interface MessageResultat {
  message: 'resultat'
  resultat: ResultatAction
  id?: number
}

/** Plus grand numéro de corrélation admis. */
export const ID_MAX = 2_147_483_647

const idValide = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= ID_MAX
export interface MessageArret {
  message: 'arret'
}

/** Tout message admis sur le port. */
export type MessageProtocole = MessageBonjour | MessageOrdre | MessageResultat | MessageArret

export function messageBonjour(): MessageBonjour {
  return { message: 'bonjour' }
}

export function messageOrdre(ordre: Action, id?: number): MessageOrdre {
  return id === undefined ? { message: 'ordre', ordre } : { message: 'ordre', ordre, id }
}

export function messageResultat(resultat: ResultatAction, id?: number): MessageResultat {
  return id === undefined ? { message: 'resultat', resultat } : { message: 'resultat', resultat, id }
}

/** Numéro de corrélation d’un message `ordre` ou `resultat` : `null` si absent ou invalide. */
export function idDeMessage(brut: unknown): number | null {
  const enveloppe = enObjet(brut)
  return enveloppe && idValide(enveloppe.id) ? enveloppe.id : null
}

/** Clés attendues d’une enveloppe : le numéro de corrélation est facultatif mais, s’il est là, valide. */
function clesAvecId(enveloppe: Brut, base: readonly string[]): boolean {
  return 'id' in enveloppe ? idValide(enveloppe.id) && cles(enveloppe, [...base, 'id']) : cles(enveloppe, base)
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
  if (!enveloppe || !clesAvecId(enveloppe, ['message', 'ordre']) || enveloppe.message !== 'ordre') return null
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
      return { type: 'enchere' as const, idCarte, idExemplaire, prix }
    }
    case 'suppression-etiquette': {
      const nomEtiquette = texte(ordre.nomEtiquette)
      const idEtiquette = uuid(ordre.idEtiquette)
      if (!cles(ordre, ['type', 'idCarte', 'nomEtiquette', 'idEtiquette']) || nomEtiquette === null || idEtiquette === null) return null
      if (idCarte !== ID_CARTE_ETIQUETTES) return null
      return { type: 'suppression-etiquette', idCarte, nomEtiquette, idEtiquette }
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
  if (!enveloppe || !clesAvecId(enveloppe, ['message', 'resultat']) || enveloppe.message !== 'resultat') return null
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
