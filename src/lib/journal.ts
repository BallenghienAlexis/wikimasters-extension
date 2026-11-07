/**
 * Journal local des actions de la synchronisation complète.
 *
 * Logique pure : aucun accès à `chrome.*` (la persistance est dans `stockage.ts`),
 * horloge injectée. Chaque entrée est construite champ par champ à partir d’une
 * liste fermée : une clé inconnue de l’objet reçu n’est jamais recopiée, donc ni
 * jeton, ni en-tête, ni corps brut, ni identifiant d’exemplaire du site (SC-015).
 */

import { TYPES_ACTION, type EntreeJournal, type ResultatAction, type TypeAction } from './actions'

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

const RESULTATS: readonly Resultat[] = ['reussie', 'echouee', 'passee', 'interrompue', 'inconnu', 'en-cours']

const CLES: readonly (keyof EntreeJournal)[] = [
  'id', 'horodatage', 'idCarte', 'titre', 'type', 'parametre', 'resultat', 'codeHttp', 'idLot',
]

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

const tronquer = (s: string, max: number): string => Array.from(s).slice(0, max).join('')

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
    return c
  })
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
  if (cles.length !== CLES.length || !CLES.every((k) => Object.hasOwn(o, k))) return null
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
