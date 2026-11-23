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
import { CAUSE_VERIFICATION_HUMAINE, ID_CARTE_ETIQUETTES, TYPES_ACTION, type Action, type ResultatAction, type TypeAction } from './actions'

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
  'prix du marché indisponible',
  'aucune vente récente : prix du marché inconnu',
  'prix du marché trop bas pour une mise en vente',
  'action non disponible',
  'erreur d’émission',
  'erreur de transport',
  'erreur réseau',
  'délai dépassé',
  'réponse hors contrat',
  'jeton-absent',
  'limite d’enchères atteinte',
  CAUSE_VERIFICATION_HUMAINE,
  'conflit signalé par le site',
]

const CLASSES: ReadonlyArray<ResultatAction['classe']> = ['reussie', 'echec', 'arret', 'inconnu', 'passee']

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
      if ('cible' in ordre) return cles(ordre, ['type', 'idCarte', 'cible']) && ordre.cible === 'etiquettes' ? { type: 'lecture', idCarte, cible: 'etiquettes' } : null
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
      const facultatifs = ['idCarteSite', 'rarete', 'prixFixe', 'reductions'].filter((k) => k in ordre)
      if (!cles(ordre, ['type', 'idCarte', 'idExemplaire', 'prix', ...facultatifs]) || idExemplaire === null) return null
      if (typeof prix !== 'number' || !Number.isSafeInteger(prix) || prix < 1 || prix > PRIX_MAX) return null
      const idCarteSite = 'idCarteSite' in ordre ? texte(ordre.idCarteSite) : undefined
      const rarete = 'rarete' in ordre ? texte(ordre.rarete) : undefined
      if (idCarteSite === null || rarete === null) return null
      if ('prixFixe' in ordre && typeof ordre.prixFixe !== 'boolean') return null
      const reductions = ordre.reductions
      if ('reductions' in ordre && (typeof reductions !== 'number' || !Number.isInteger(reductions) || reductions < 0 || reductions > 30)) return null
      return {
        type: 'enchere' as const, idCarte, idExemplaire, prix,
        ...(idCarteSite !== undefined ? { idCarteSite } : {}), ...(rarete !== undefined ? { rarete } : {}),
        ...('prixFixe' in ordre ? { prixFixe: ordre.prixFixe as boolean } : {}), ...('reductions' in ordre ? { reductions: reductions as number } : {}),
      }
    }
    case 'suppression-etiquette': {
      const nomEtiquette = texte(ordre.nomEtiquette)
      const idEtiquette = uuid(ordre.idEtiquette)
      if (!cles(ordre, ['type', 'idCarte', 'nomEtiquette', 'idEtiquette']) || nomEtiquette === null || idEtiquette === null) return null
      if (idCarte !== ID_CARTE_ETIQUETTES) return null
      return { type: 'suppression-etiquette', idCarte, nomEtiquette, idEtiquette }
    }
    case 'favori': {
      const idExemplaire = texte(ordre.idExemplaire)
      const avecValeur = 'valeur' in ordre
      if (!cles(ordre, avecValeur ? ['type', 'idCarte', 'idExemplaire', 'valeur'] : ['type', 'idCarte', 'idExemplaire']) || idExemplaire === null) return null
      if (!avecValeur) return { type: 'favori', idCarte, idExemplaire }
      if (typeof ordre.valeur !== 'boolean') return null
      return { type: 'favori', idCarte, idExemplaire, valeur: ordre.valeur }
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
  const avecDiag = resultat !== null && 'diagnostic' in resultat
  const avecVentes = resultat !== null && 'ventes' in resultat
  const avecPrix = resultat !== null && 'prix' in resultat
  const avecEtiquettes = resultat !== null && 'etiquettes' in resultat
  if (!resultat || !cles(resultat, ['classe', 'codeHttp', 'cause', ...(avecId ? ['idEtiquette'] : []), ...(avecDiag ? ['diagnostic'] : []), ...(avecVentes ? ['ventes'] : []), ...(avecPrix ? ['prix'] : []), ...(avecEtiquettes ? ['etiquettes'] : [])])) return null
  const { classe, codeHttp } = resultat
  if (typeof classe !== 'string' || !(CLASSES as readonly string[]).includes(classe)) return null
  if (codeHttp !== null) {
    if (typeof codeHttp !== 'number' || !Number.isInteger(codeHttp) || codeHttp < 100 || codeHttp > 599) return null
  }
  const cause = texte(resultat.cause)
  if (cause === null || !CAUSES_RESULTAT.includes(cause)) return null
  let diagnostic: string | undefined
  if (avecDiag) {
    if (typeof resultat.diagnostic !== 'string' || Array.from(resultat.diagnostic).length > 500) return null
    diagnostic = resultat.diagnostic
  }
  let ventes: { enCours: number; max: number } | undefined
  if (avecVentes) {
    const v = enObjet(resultat.ventes)
    if (!v || !cles(v, ['enCours', 'max'])) return null
    const { enCours, max } = v
    if (typeof enCours !== 'number' || typeof max !== 'number' || !Number.isInteger(enCours) || !Number.isInteger(max) || enCours < 0 || max < 0 || enCours > 1000 || max > 1000) return null
    ventes = { enCours, max }
  }
  let etiquettes: Array<{ id: string; nom: string; nbCartes: number }> | undefined
  if (avecEtiquettes) {
    if (!Array.isArray(resultat.etiquettes) || resultat.etiquettes.length > 500) return null
    etiquettes = []
    for (const e of resultat.etiquettes as unknown[]) {
      const o = enObjet(e)
      const id = o ? uuid(o.id) : null
      const nom = o ? texte(o.nom) : null
      const nbCartes = o?.nbCartes
      if (!o || !cles(o, ['id', 'nom', 'nbCartes']) || id === null || nom === null) return null
      if (typeof nbCartes !== 'number' || !Number.isSafeInteger(nbCartes) || nbCartes < 0) return null
      etiquettes.push({ id, nom, nbCartes })
    }
  }
  if (avecPrix && (typeof resultat.prix !== 'number' || !Number.isSafeInteger(resultat.prix) || resultat.prix < 1 || resultat.prix > PRIX_MAX)) return null
  const base = { classe: classe as ResultatAction['classe'], codeHttp: codeHttp as number | null, cause, ...(diagnostic !== undefined ? { diagnostic } : {}), ...(ventes !== undefined ? { ventes } : {}), ...(avecPrix ? { prix: resultat.prix as number } : {}), ...(etiquettes !== undefined ? { etiquettes } : {}) }
  if (!avecId) return base
  const idEtiquette = uuid(resultat.idEtiquette)
  return idEtiquette === null ? null : { ...base, idEtiquette }
}
