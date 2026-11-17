/**
 * Journal local des actions de la synchronisation complète.
 *
 * Logique pure : aucun accès à `chrome.*` (la persistance est dans `stockage.ts`),
 * horloge injectée. Chaque entrée est construite champ par champ à partir d’une
 * liste fermée : une clé inconnue de l’objet reçu n’est jamais recopiée, donc ni
 * jeton, ni en-tête, ni corps brut, ni identifiant d’exemplaire du site (SC-015).
 */

import {
  CAUSES_JOURNAL, FAMILLES_LOT, estLimiteEncheres, estVerificationHumaine, TYPES_ACTION,
  type CauseJournal, type EntreeJournal, type FamilleLot, type ResultatAction, type TypeAction,
} from './actions'
import { estEntier as entierPositif, tronquer } from './valider'

export type Journal = EntreeJournal[]

/** Nombre maximal d’entrées conservées (FIFO). */
export const MAX_ENTREES = 1000
/** Poids maximal du journal sérialisé : 1 Mo. */
export const MAX_OCTETS = 1024 * 1024

const MAX_TITRE = 300
const MAX_PARAMETRE = 300
const MAX_ID_CARTE = 400
const MAX_ID = 64

/** Libellé fixe affiché par l’interface. */
export const LIBELLE_INTERROMPUE = 'interrompue, résultat inconnu, à vérifier sur le site'

/** Champs fournis à l’ouverture d’une entrée (liste fermée). */
export interface ChampsEntree {
  idCarte: string
  titre: string
  type: TypeAction
  parametre: string | null
  idLot: string
}

type Resultat = EntreeJournal['resultat']

/** Longueur maximale d’une ligne de diagnostic de refus. */
const MAX_DIAGNOSTIC = 500

const RESULTATS: readonly Resultat[] = ['reussie', 'echouee', 'passee', 'interrompue', 'inconnu', 'en-cours']

const CLES_V1: readonly (keyof EntreeJournal)[] = [
  'id', 'horodatage', 'idCarte', 'titre', 'type', 'parametre', 'resultat', 'codeHttp', 'idLot',
]
const CLES_V2: readonly (keyof EntreeJournal)[] = [...CLES_V1, 'rang', 'total', 'lot', 'cause']

const RESULTAT_PAR_CLASSE: Readonly<Record<ResultatAction['classe'], Resultat>> = Object.freeze({
  __proto__: null,
  reussie: 'reussie',
  echec: 'echouee',
  arret: 'interrompue',
  inconnu: 'inconnu',
} as Record<ResultatAction['classe'], Resultat>)

const resultatDeClasse = (classe: unknown): Resultat =>
  typeof classe === 'string' && Object.hasOwn(RESULTAT_PAR_CLASSE, classe)
    ? RESULTAT_PAR_CLASSE[classe as ResultatAction['classe']]
    : 'inconnu'



const codeValide = (c: unknown): c is number | null =>
  c === null || (typeof c === 'number' && Number.isInteger(c) && c >= 100 && c <= 599)

/** Entrée reconstruite champ par champ. */
function copier(e: EntreeJournal): EntreeJournal {
  return {
    id: e.id,
    horodatage: e.horodatage,
    idCarte: e.idCarte,
    titre: e.titre,
    type: e.type,
    parametre: e.parametre,
    resultat: e.resultat,
    codeHttp: e.codeHttp,
    idLot: e.idLot,
    rang: e.rang,
    total: e.total,
    lot: e.lot,
    cause: e.cause,
    ...(typeof e.diagnostic === 'string' ? { diagnostic: e.diagnostic } : {}),
  }
}

const encodeur = new TextEncoder()

/** Poids exact, en octets UTF-8, de la sérialisation JSON d’un journal. */
const octets = (j: Journal): number => encodeur.encode(JSON.stringify(j)).length

/**
 * Double borne : au plus 1 000 entrées ET au plus 1 Mo sérialisé ; la plus stricte
 * l’emporte. On retire les plus anciennes entrées jusqu’à ce que les deux tiennent.
 */
function borner(j: Journal): Journal {
  let debut = Math.max(0, j.length - MAX_ENTREES)
  // Poids de chaque entrée, virgules comprises ; crochets : 2 octets.
  const poids = j.map((e) => encodeur.encode(JSON.stringify(e)).length + 1)
  let total = 1 + poids.slice(debut).reduce((a, b) => a + b, 0)
  while (debut < j.length - 1 && total > MAX_OCTETS) total -= poids[debut++]!
  return j.slice(debut)
}

function prochainCompteur(j: Journal): number {
  let max = 0
  for (const e of j) {
    const n = Number(e.id.slice(e.id.lastIndexOf('-') + 1))
    if (Number.isInteger(n) && n > max) max = n
  }
  return max + 1
}

/**
 * Ajoute une entrée « en cours » (écrite avant l’envoi, pour laisser une trace
 * d’une interruption). L’identifiant combine l’horodatage et un compteur.
 */
export function ouvrirEntree(
  journal: Journal,
  champs: ChampsEntree,
  maintenant: () => Date,
): { journal: Journal; id: string } {
  const date = maintenant()
  const id = `${date.getTime()}-${prochainCompteur(journal)}`
  const entree: EntreeJournal = {
    id,
    horodatage: date.toISOString(),
    idCarte: tronquer(String(champs.idCarte), MAX_ID_CARTE),
    titre: tronquer(String(champs.titre), MAX_TITRE),
    type: champs.type,
    parametre: champs.parametre === null ? null : tronquer(String(champs.parametre), MAX_PARAMETRE),
    resultat: 'en-cours',
    codeHttp: null,
    idLot: tronquer(String(champs.idLot), MAX_ID),
    rang: null,
    total: null,
    lot: null,
    cause: null,
  }
  return { journal: borner([...journal.map(copier), entree]), id }
}

/** Complète une entrée « en cours » ; sans effet si elle est absente ou déjà complétée. */
export function completerEntree(journal: Journal, id: string, resultat: ResultatAction): Journal {
  return journal.map((e) => {
    const c = copier(e)
    if (e.id !== id || e.resultat !== 'en-cours') return c
    c.resultat = resultatDeClasse(resultat.classe)
    c.codeHttp = codeValide(resultat.codeHttp) ? resultat.codeHttp : null
    if (typeof resultat.diagnostic === 'string' && resultat.diagnostic !== '') c.diagnostic = tronquer(resultat.diagnostic, MAX_DIAGNOSTIC)
    return c
  })
}

/**
 * Entrée « passée » pour une action écartée avant l'envoi (aucune requête), avec une ligne d'information dans le champ
 * de diagnostic (texte fixe de l'extension, jamais une réponse du site).
 */
export function ouvrirEntreePassee(journal: Journal, champs: ChampsEntree, information: string, maintenant: () => Date): Journal {
  const { journal: ouvert, id } = ouvrirEntree(journal, champs, maintenant)
  return passerEntree(ouvert, id).map((e) => (e.id === id ? { ...e, diagnostic: tronquer(information, MAX_DIAGNOSTIC) } : e))
}

/** Inscrit une entrée « en cours » en « passée » (action non envoyée) ; sans effet sinon. */
export function passerEntree(journal: Journal, id: string): Journal {
  return journal.map((e) => {
    const c = copier(e)
    if (e.id === id && e.resultat === 'en-cours') c.resultat = 'passee'
    return c
  })
}

/** Clôt les entrées « en cours » d’un lot en « interrompue » (résultat inconnu, à vérifier sur le site). */
export function cloreInterrompues(journal: Journal, idLot: string): Journal {
  const lot = tronquer(String(idLot), MAX_ID)
  return journal.map((e) => {
    const c = copier(e)
    if (e.idLot === lot && e.resultat === 'en-cours') c.resultat = 'interrompue'
    return c
  })
}

function entreeValide(brut: unknown): EntreeJournal | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const o = brut as Record<string, unknown>
  const cles = Object.keys(o)
  const avecDiag = Object.hasOwn(o, 'diagnostic')
  const v2 = cles.length === CLES_V2.length + (avecDiag ? 1 : 0) && CLES_V2.every((k) => Object.hasOwn(o, k))
  const v1 = cles.length === CLES_V1.length && CLES_V1.every((k) => Object.hasOwn(o, k))
  if (!v1 && !v2) return null
  const { id, horodatage, idCarte, titre, type, parametre, resultat, codeHttp, idLot } = o
  if (typeof id !== 'string' || id.length === 0 || Array.from(id).length > MAX_ID) return null
  if (
    typeof horodatage !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(horodatage) ||
    Number.isNaN(Date.parse(horodatage))
  ) return null
  if (typeof idCarte !== 'string' || Array.from(idCarte).length > MAX_ID_CARTE) return null
  if (typeof titre !== 'string' || Array.from(titre).length > MAX_TITRE) return null
  if (typeof type !== 'string' || !(TYPES_ACTION as readonly string[]).includes(type)) return null
  if (parametre !== null && (typeof parametre !== 'string' || Array.from(parametre).length > MAX_PARAMETRE)) return null
  if (typeof resultat !== 'string' || !(RESULTATS as readonly string[]).includes(resultat)) return null
  if (!codeValide(codeHttp)) return null
  if (typeof idLot !== 'string' || Array.from(idLot).length > MAX_ID) return null
  let rang: number | null = null
  let total: number | null = null
  let lot: FamilleLot | null = null
  let cause: CauseJournal | null = null
  if (v2) {
    const r = o.rang, t = o.total, l = o.lot, c = o.cause
    if (r !== null && !entierPositif(r)) return null
    if (t !== null && !entierPositif(t)) return null
    if (l !== null && (typeof l !== 'string' || !(FAMILLES_LOT as readonly string[]).includes(l))) return null
    if (c !== null && (typeof c !== 'string' || !(CAUSES_JOURNAL as readonly string[]).includes(c))) return null
    rang = r
    total = t
    lot = l as FamilleLot | null
    cause = c as CauseJournal | null
  }
  let diagnostic: string | undefined
  if (v2 && avecDiag) {
    if (typeof o.diagnostic !== 'string' || Array.from(o.diagnostic).length > MAX_DIAGNOSTIC) return null
    diagnostic = o.diagnostic
  }
  return {
    id,
    horodatage,
    idCarte,
    titre,
    type: type as TypeAction,
    parametre,
    resultat: resultat as Resultat,
    codeHttp,
    idLot,
    rang,
    total,
    lot,
    cause,
    ...(diagnostic !== undefined ? { diagnostic } : {}),
  }
}

/** Valide un journal lu du stockage : `null` à la moindre forme inattendue. */
export function validerJournal(brut: unknown): Journal | null {
  if (!Array.isArray(brut) || brut.length > MAX_ENTREES) return null
  const sortie: Journal = []
  for (const element of brut) {
    const e = entreeValide(element)
    if (e === null) return null
    sortie.push(e)
  }
  return octets(sortie) > MAX_OCTETS ? null : sortie
}

/** Clé d’un couple (carte, étiquette), sans ambiguïté même si les noms contiennent `|`. */
export const cleCouple = (idCarte: string, nomEtiquette: string): string =>
  JSON.stringify([idCarte, nomEtiquette])

/** Pose réussie la plus récente par couple (carte, étiquette). */
export function dernierePoseParCouple(journal: Journal): Map<string, EntreeJournal> {
  const sortie = new Map<string, EntreeJournal>()
  for (const e of journal) {
    if (e.type !== 'pose-etiquette' || e.resultat !== 'reussie' || e.parametre === null) continue
    const cle = cleCouple(e.idCarte, e.parametre)
    const precedente = sortie.get(cle)
    if (precedente === undefined || e.horodatage >= precedente.horodatage) sortie.set(cle, copier(e))
  }
  return sortie
}

/**
 * Libellé d’historique (H5) : l’exemplaire indisponible (403 ou 404 sur pose, retrait, enchère, défausse)
 * et les actions sautées ou ignorées se lisent « Passée : … ». La donnée stockée n’est pas modifiée ;
 * les autres entrées gardent le libellé de leur résultat.
 */
const LIBELLE_RESULTAT: Readonly<Record<Resultat, string>> = {
  reussie: 'Réussie',
  echouee: 'Échouée',
  passee: 'Passée',
  interrompue: 'Interrompue : résultat inconnu',
  inconnu: 'Résultat inconnu',
  'en-cours': 'En cours',
}

/** Libellé d’un refus par vérification anti-bot (Alexis, 2026-11-15). */
export const LIBELLE_VERIFICATION_HUMAINE =
  'Vérification anti-bot du site requise : mets une carte aux enchères à la main sur wiki-masters.com, résous la vérification, puis relance'

/** Libellé d’un 409 « limite d’enchères actives » (Alexis, 2026-11-15). */
export const LIBELLE_LIMITE_ENCHERES = 'Limite d’enchères actives atteinte : réessaie quand une vente se termine'

export function libelleHistorique(e: EntreeJournal): string {
  if (e.cause === 'sautee') return 'Passée : sautée'
  if (e.cause === 'ignoree') return 'Passée : ignorée jusqu’à la prochaine synchro'
  if (e.resultat === 'echouee' && e.codeHttp === 403 && estVerificationHumaine(e.diagnostic)) return LIBELLE_VERIFICATION_HUMAINE
  if (e.resultat === 'echouee' && e.codeHttp === 409 && e.type === 'enchere' && estLimiteEncheres(e.diagnostic)) return LIBELLE_LIMITE_ENCHERES
  if (
    e.resultat === 'echouee' &&
    (e.codeHttp === 403 || e.codeHttp === 404) &&
    (e.type === 'pose-etiquette' || e.type === 'retrait-etiquette' || e.type === 'enchere' || e.type === 'defausse' || e.type === 'favori')
  ) return 'Passée : exemplaire indisponible'
  return LIBELLE_RESULTAT[e.resultat]
}
