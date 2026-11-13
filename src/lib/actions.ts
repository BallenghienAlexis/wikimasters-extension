/**
 * Types partagés de la synchronisation complète : actions, lot, résultats,
 * journal, registre et état d’exécution.
 *
 * Types et constantes seulement : aucune classe, aucun accès à `chrome.*`.
 * Aucun type ne porte de champ pouvant contenir un jeton, un en-tête, un cookie
 * ou un corps de réponse brut (SC-018) : les champs libres sont proscrits.
 */

/** Les six types d’action que le lot peut contenir. */
export const TYPES_ACTION = [
  'lecture',
  'creation-etiquette',
  'retrait-etiquette',
  'pose-etiquette',
  'enchere',
  'defausse',
  'suppression-etiquette',
] as const

export type TypeAction = (typeof TYPES_ACTION)[number]

/** Types d’action dont l’entrée existe dans la table du contrat. */
export type TypesDisponibles = ReadonlySet<TypeAction>

/** Champs communs : une carte est identifiée par son identifiant local `rareté|titre`. */
interface ActionBase {
  idCarte: string
}

export interface ActionLecture extends ActionBase {
  type: 'lecture'
}

export interface ActionCreationEtiquette extends ActionBase {
  type: 'creation-etiquette'
  nomEtiquette: string
}

export interface ActionRetraitEtiquette extends ActionBase {
  type: 'retrait-etiquette'
  idExemplaire: string
  nomEtiquette: string
  /** Identifiant d’étiquette du site, ajouté à l’envoi depuis le registre (absent dans le lot). */
  idEtiquette?: string
}

export interface ActionPoseEtiquette extends ActionBase {
  type: 'pose-etiquette'
  idExemplaire: string
  nomEtiquette: string
  /** Identifiant d’étiquette du site, ajouté à l’envoi depuis le registre (absent dans le lot). */
  idEtiquette?: string
}

export interface ActionEnchere extends ActionBase {
  type: 'enchere'
  idExemplaire: string
  prix: number
}

export interface ActionDefausse extends ActionBase {
  type: 'defausse'
  idExemplaire: string
}

/**
 * Suppression d’une étiquette du compte (RPC `delete_tag`, relevé du 2026-11-12). Opération hors carte :
 * `idCarte` vaut toujours `ID_CARTE_ETIQUETTES`. L’identifiant d’étiquette est obligatoire.
 */
export const ID_CARTE_ETIQUETTES = 'etiquettes'
export interface ActionSuppressionEtiquette extends ActionBase {
  type: 'suppression-etiquette'
  nomEtiquette: string
  idEtiquette: string
}

/** Action du lot, discriminée par `type`. */
export type Action =
  | ActionLecture
  | ActionCreationEtiquette
  | ActionRetraitEtiquette
  | ActionPoseEtiquette
  | ActionEnchere
  | ActionDefausse
  | ActionSuppressionEtiquette

/** Raison pour laquelle une carte (ou une partie de ses exemplaires) est écartée du lot. */
export type RaisonEcart =
  | 'non-reliee'
  | 'identifiant-en-conflit'
  | 'en-attente-place'
  | 'action-non-disponible'
  | 'prix-invalide'
  | 'prix-superieur-valeur'
  | 'valeur-absente'
  | 'nom-trop-long'
  | 'homonyme'
  | 'exemplaires-non-relies'
  | 'valeur-defausse-elevee'
  | 'en-vente-sur-site'

export interface CarteEcartee {
  idCarte: string
  titre: string
  raison: RaisonEcart
}

/** Lot construit : actions ordonnées et cartes écartées. */
export interface Lot {
  actions: Action[]
  ecartees: CarteEcartee[]
}

/** Résultat d’une action : classe, code HTTP éventuel et cause en libellé fixe. */
export interface ResultatAction {
  classe: 'reussie' | 'echec' | 'arret' | 'inconnu'
  codeHttp: number | null
  /** Libellé fixe choisi par l’extension, jamais recopié depuis une réponse. */
  cause: string
  /** Identifiant de l’étiquette créée (réponse d’une création), validé avant d’aller au registre. */
  idEtiquette?: string
}

/**
 * Entrée du journal local. Aucun identifiant d’exemplaire du site (SC-015).
 * Construite champ par champ à partir de cette liste fermée.
 */
export interface EntreeJournal {
  id: string
  /** Date ISO 8601. */
  horodatage: string
  idCarte: string
  titre: string
  type: TypeAction
  /** Nom d’étiquette ou prix, selon le type ; `null` si sans objet. */
  parametre: string | null
  resultat: 'reussie' | 'echouee' | 'passee' | 'interrompue' | 'inconnu' | 'en-cours'
  codeHttp: number | null
  idLot: string
  /** Rang de l’action dans son lot (à partir de 1) ; `null` pour une entrée v1 ou sans objet. */
  rang?: number | null
  /** Taille du lot de l’action ; `null` si inconnue. */
  total?: number | null
  /** Famille de l’action ; `null` si inconnue. */
  lot?: FamilleLot | null
  /** Cause d’une action passée ou interrompue, en liste fermée ; `null` sinon. */
  cause?: CauseJournal | null
}

/** Familles de lots d’une exécution (v2). */
export const FAMILLES_LOT = ['etiquettes', 'encheres', 'defausses', 'suppressions', 'lectures'] as const
export type FamilleLot = (typeof FAMILLES_LOT)[number]

/** Causes d’un journal v2 : raisons d’arrêt de `file.ts`, plus `sautee` et `ignoree`. */
export const CAUSES_JOURNAL = [
  'manuel', 'echecs', 'code-http', 'resultat', 'ecriture', 'transport', 'verification', 'sautee', 'ignoree',
] as const
export type CauseJournal = (typeof CAUSES_JOURNAL)[number]

/** Registre des étiquettes posées par l’extension (seul à autoriser les retraits). */
export interface Registre {
  version: number
  /** Nom d’étiquette → identifiant d’étiquette sur le site. */
  etiquettes: Record<string, string>
  /** Couples (exemplaire, nom d’étiquette) posés par l’extension. */
  couples: Array<{ ex: string; nom: string }>
}

/** État de l’exécution en cours, persisté pour détecter une interruption. */
export interface EtatExecution {
  version: number
  idLot: string
  etat: 'en-cours' | 'terminee' | 'arretee'
  /** Nombre d’actions déjà traitées dans le lot. */
  traitees: number
  /** Nombre total d’actions du lot. */
  total: number
}

/** Progression d’une famille de lots (v2). */
export interface LotExecution {
  famille: FamilleLot
  total: number
  traitees: number
  sautees: number
}

/**
 * Contexte de l’erreur qui a arrêté l’exécution (v2). Liste fermée : aucun identifiant d’exemplaire du site,
 * aucun corps de réponse (SC-007).
 */
export interface ErreurExecution {
  type: TypeAction
  parametre: string | null
  idCarte: string
  titre: string
  famille: FamilleLot
  indexLot: number
  nbLots: number
  rang: number
  totalLot: number
  codeHttp: number | null
  cause: CauseJournal
  le: number
  reussies: number
  autresEchecsEnVol: number
}

/** État d’exécution v2 : v1 + lots, pause et contexte d’erreur. */
export interface EtatExecutionV2 extends EtatExecution {
  version: 2
  lots: LotExecution[]
  pauseJusqua: number | null
  erreur: ErreurExecution | null
}

/** Codes HTTP d’un refus par carte (exemplaire vendu, défaussé ou en vente), tolérés un à un. */
export const CODES_CARTE_INDISPONIBLE: readonly number[] = [403, 404]
