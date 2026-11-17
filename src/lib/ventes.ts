/**
 * Suivi des mises en vente (onglet « Mise en vente », Alexis, 2026-11-17).
 *
 * Logique pure, sans `chrome.*` : lecture validée du listing du marché (`/api/marketplace?...&mine=1`, déjà autorisé pour
 * l’affluence), détection des prolongations, cadence de relecture et mise en forme du décompte. Seuls les champs d’une
 * liste fermée sont retenus : ni nom de joueur, ni mise d’un autre joueur, ni identifiant de joueur.
 *
 * Règle du site rappelée par Alexis : la mise est débitée immédiatement, remboursée si l’on est surenchéri, et une mise dans
 * les 10 dernières secondes prolonge la fin de 60 secondes. La réponse ne donne pas les prolongations : elles se déduisent
 * d’une heure de fin (`end_at`) qui avance d’une relecture à l’autre.
 */
import { estEntier, estObjet, tronquer } from './valider'

export const VERSION_SUIVI = 1

/** Relecture normale. */
export const DELAI_NORMAL_MS = 5 * 60_000
/** Relecture dans la dernière minute d’une enchère. */
export const DELAI_FINAL_MS = 10_000
/** Seuil de la « dernière minute ». */
export const DERNIERE_MINUTE_MS = 60_000
/** Une prolongation vaut 60 s. */
export const PROLONGATION_MS = 60_000
/** Enchère dépassée depuis longtemps mais toujours « active » côté site : relecture plus calme. */
export const DEPASSEE_MS = 2 * 60_000
export const DELAI_DEPASSEE_MS = 30_000
/** Attente de base après un échec de lecture, allongée d’autant à chaque échec de suite, sans plafond. */
export const PAS_ATTENTE_MS = 5_000
export const MAX_TERMINEES = 50
export const MAX_ACTIVES = 20
const MAX_TITRE = 200
const PRIX_MAX = 1_000_000_000

export interface VenteActive {
  /** Identifiant de l’enchère (sert à reconnaître la même enchère d’une lecture à l’autre). */
  id: string
  /** Identifiant de l’exemplaire mis en vente (`card_id` de l’enchère). */
  idExemplaire: string
  titre: string
  rarete: string
  /** Prix de départ. */
  prixDepart: number
  /** Prix actuel (mise la plus haute, ou prix de départ sans mise). */
  prixActuel: number
  /** Une mise a été posée. */
  avecMise: boolean
  /** Mise mise en vente (ms). */
  creeLe: number
  /** Fin actuelle (ms), prolongations comprises. */
  finLe: number
  /** Première fin vue pour cette enchère (ms) : sert à compter les prolongations. */
  finInitiale: number
}

export interface VenteTerminee {
  id: string
  titre: string
  rarete: string
  prixDepart: number
  /** Prix final (vente) ; `null` : pas de vente. */
  prixFinal: number | null
  creeLe: number
  finLe: number
}

export interface SuiviVentes {
  version: typeof VERSION_SUIVI
  /** Dernière lecture réussie (ms). */
  releveLe: number
  /** Maximum d’enchères simultanées annoncé par le site, `null` si absent. */
  max: number | null
  actives: VenteActive[]
  terminees: VenteTerminee[]
}

export const suiviVide = (): SuiviVentes => ({ version: VERSION_SUIVI, releveLe: 0, max: null, actives: [], terminees: [] })

const dateMs = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) && t > Date.UTC(2020, 0, 1) ? t : null
}

const prix = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= PRIX_MAX ? Math.round(v) : null)

const titreDe = (o: Record<string, unknown>): string => {
  const carte = o.card
  if (estObjet(carte)) {
    const t = carte.wikipedia_title
    if (typeof t === 'string' && t.trim() !== '') return tronquer(t.trim(), MAX_TITRE)
  }
  return 'Carte inconnue'
}

const texteCourt = (v: unknown): string => (typeof v === 'string' ? tronquer(v, 40) : '')

/** Lit une enchère de `selling` ; `null` si un champ indispensable manque. */
function lireActive(brut: unknown): Omit<VenteActive, 'finInitiale'> | null {
  if (!estObjet(brut)) return null
  const { id, card_id: idExemplaire } = brut
  if (typeof id !== 'string' || id === '' || id.length > 80 || typeof idExemplaire !== 'string' || idExemplaire === '' || idExemplaire.length > 80) return null
  const prixDepart = prix(brut.base_amount)
  const creeLe = dateMs(brut.created_at)
  const finLe = dateMs(brut.end_at)
  if (prixDepart === null || creeLe === null || finLe === null) return null
  const mise = prix(brut.current_bid)
  const effectif = prix(brut.effective_bid)
  const actuel = Math.max(prixDepart, effectif ?? 0, mise ?? 0)
  return { id, idExemplaire, titre: titreDe(brut), rarete: texteCourt(brut.snapshot_rarity), prixDepart, prixActuel: actuel, avecMise: mise !== null && mise > 0, creeLe, finLe }
}

function lireTerminee(brut: unknown): VenteTerminee | null {
  if (!estObjet(brut)) return null
  const { id } = brut
  if (typeof id !== 'string' || id === '' || id.length > 80) return null
  const prixDepart = prix(brut.base_amount)
  const creeLe = dateMs(brut.created_at)
  const finLe = dateMs(brut.settled_at) ?? dateMs(brut.end_at)
  if (prixDepart === null || creeLe === null || finLe === null) return null
  return { id, titre: titreDe(brut), rarete: texteCourt(brut.snapshot_rarity), prixDepart, prixFinal: prix(brut.final_price), creeLe, finLe }
}

export interface LectureVentes {
  actives: Array<Omit<VenteActive, 'finInitiale'>>
  terminees: VenteTerminee[]
  max: number | null
}

/**
 * Lit la réponse du listing (`selling` = enchères du joueur en cours, `history` = terminées). `null` si la forme est
 * inattendue (ni `selling` ni `history` sous forme de liste) : rien n’est deviné.
 */
export function analyserListeVentes(json: unknown): LectureVentes | null {
  if (!estObjet(json) || !Array.isArray(json.selling)) return null
  const actives = json.selling.slice(0, MAX_ACTIVES).map(lireActive).filter((v): v is NonNullable<typeof v> => v !== null)
  const historique = Array.isArray(json.history) ? json.history : []
  const terminees = historique
    .slice(0, 200)
    .map(lireTerminee)
    .filter((v): v is VenteTerminee => v !== null)
    .sort((a, b) => b.finLe - a.finLe)
    .slice(0, MAX_TERMINEES)
  const max = estEntier(json.maxConcurrentAuctions) ? json.maxConcurrentAuctions : null
  return { actives, terminees, max }
}

/** Nouveau suivi à partir d’une lecture : la première fin vue de chaque enchère est conservée d’une lecture à l’autre. */
export function fusionnerSuivi(precedent: SuiviVentes, lecture: LectureVentes, maintenant: number): SuiviVentes {
  const anciennes = new Map(precedent.actives.map((v) => [v.id, v]))
  const actives: VenteActive[] = lecture.actives.map((v) => ({ ...v, finInitiale: anciennes.get(v.id)?.finInitiale ?? v.finLe }))
  return { version: VERSION_SUIVI, releveLe: maintenant, max: lecture.max ?? precedent.max, actives, terminees: lecture.terminees }
}

/** Nombre de prolongations de 60 s déjà subies (0 si aucune). */
export const prolongations = (v: Pick<VenteActive, 'finLe' | 'finInitiale'>): number => Math.max(0, Math.round((v.finLe - v.finInitiale) / PROLONGATION_MS))

/** Millisecondes avant la fin (négatif : dépassée). */
export const resteMs = (v: Pick<VenteActive, 'finLe'>, maintenant: number): number => v.finLe - maintenant

/**
 * Délai avant la prochaine lecture réussie : 5 min, ramenées pour tomber au début de la dernière minute de l’enchère la
 * plus proche ; puis toutes les 10 s dans la dernière minute (et tant qu’une enchère terminée n’a pas disparu de la liste,
 * toutes les 30 s au-delà de 2 min de retard).
 */
export function delaiSuivant(actives: ReadonlyArray<Pick<VenteActive, 'finLe'>>, maintenant: number): number {
  if (actives.length === 0) return DELAI_NORMAL_MS
  const reste = Math.min(...actives.map((v) => v.finLe - maintenant))
  if (reste <= -DEPASSEE_MS) return DELAI_DEPASSEE_MS
  if (reste <= DERNIERE_MINUTE_MS) return DELAI_FINAL_MS
  return Math.min(DELAI_NORMAL_MS, reste - DERNIERE_MINUTE_MS)
}

/** Attente après `echecs` échecs de lecture de suite : 5 s, 10 s, 15 s… sans plafond (Alexis : aucun arrêt automatique). */
export const attenteApresEchec = (echecs: number): number => PAS_ATTENTE_MS * Math.max(1, echecs)

/** Décompte « 12 min 05 s », « 45 s », « terminée ». */
export function formaterDecompte(reste: number): string {
  if (reste <= 0) return 'terminée'
  const s = Math.ceil(reste / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m > 0) return `${m} min ${String(sec).padStart(2, '0')} s`
  return `${sec} s`
}

/** Journal des mises en vente lancées par l’extension (relance automatique). */
export interface LancementVente {
  le: number
  source: 'auto'
  titre: string
  prix: number
  resultat: 'reussie' | 'echec'
  /** Cause en libellé fixe, jamais un corps de réponse. */
  cause: string | null
}

export const MAX_LANCEMENTS = 100

export function validerLancements(brut: unknown): LancementVente[] {
  if (!Array.isArray(brut)) return []
  const sortie: LancementVente[] = []
  for (const e of brut) {
    if (!estObjet(e)) continue
    const { le, source, titre, resultat, cause } = e
    const p = e.prix
    if (typeof le !== 'number' || !Number.isSafeInteger(le) || le < 0 || source !== 'auto') continue
    if (typeof titre !== 'string' || typeof p !== 'number' || !Number.isSafeInteger(p) || p < 0) continue
    if (resultat !== 'reussie' && resultat !== 'echec') continue
    sortie.push({ le, source: 'auto', titre: tronquer(titre, MAX_TITRE), prix: p, resultat, cause: typeof cause === 'string' ? tronquer(cause, 120) : null })
  }
  return sortie.slice(-MAX_LANCEMENTS)
}

/** Origine d’une enchère : lancement automatique, lot (journal), ou inconnue (mise à la main sur le site). */
export type Origine = { type: 'auto' } | { type: 'lot'; idLot: string } | { type: 'inconnue' }

const ECART_ORIGINE_MS = 3 * 60_000

/** Rapproche une enchère d’un lancement de l’extension : même titre, à moins de 3 min de la mise en vente. */
export function origineDe(
  v: Pick<VenteActive, 'titre' | 'creeLe'> | Pick<VenteTerminee, 'titre' | 'creeLe'>,
  lancements: readonly LancementVente[],
  lots: ReadonlyArray<{ titre: string; at: number; idLot: string }>,
): Origine {
  const proche = (at: number): boolean => Math.abs(at - v.creeLe) <= ECART_ORIGINE_MS
  if (lancements.some((l) => l.resultat === 'reussie' && l.titre === v.titre && proche(l.le))) return { type: 'auto' }
  const lot = lots.find((l) => l.titre === v.titre && proche(l.at))
  return lot ? { type: 'lot', idLot: lot.idLot } : { type: 'inconnue' }
}

/** Avertissement à partir de ce nombre de relances automatiques d’une même carte (depuis le dernier « Continuer »). */
export const SEUIL_AVERTISSEMENT_RELANCES = 3
/** Une carte non vendue est dite « relancée » si l’extension l’a remise en vente dans l’heure qui suit sa fin. */
const FENETRE_RELANCE_MS = 60 * 60_000

export const clePasserCarte = (titre: string): string => `carte:${titre}`
export const cleVuCarte = (titre: string): string => `vu:${titre}`

/** Lancements automatiques réussis d’une carte. */
export const nombreRelances = (lancements: readonly LancementVente[], titre: string): number =>
  lancements.filter((l) => l.resultat === 'reussie' && l.titre === titre).length

/**
 * Cartes remises en vente au moins `SEUIL` fois après une enchère terminée non vendue, depuis le dernier choix du joueur :
 * avertissement et choix, jamais d’arrêt caché. Seules comptent les remises qui suivent une fin sans vente.
 */
export function cartesAAvertir(
  lancements: readonly LancementVente[],
  ecartes: Readonly<Record<string, number>>,
  terminees: readonly VenteTerminee[],
): Array<{ titre: string; relances: number }> {
  const comptes = new Map<string, number>()
  for (const v of terminees) if (etatTerminee(v, lancements) === 'non-vendue-relancee') comptes.set(v.titre, (comptes.get(v.titre) ?? 0) + 1)
  const sortie: Array<{ titre: string; relances: number }> = []
  for (const [titre, n] of comptes) {
    if (ecartes[clePasserCarte(titre)] !== undefined) continue
    if (n - (ecartes[cleVuCarte(titre)] ?? 0) >= SEUIL_AVERTISSEMENT_RELANCES) sortie.push({ titre, relances: n })
  }
  return sortie.sort((a, b) => b.relances - a.relances)
}

export type EtatTerminee = 'vendue' | 'non-vendue-relancee' | 'non-vendue'

/** Vendue (prix final connu), non vendue puis relancée par l’extension, ou non vendue. */
export function etatTerminee(v: VenteTerminee, lancements: readonly LancementVente[]): EtatTerminee {
  if (v.prixFinal !== null && v.prixFinal > 0) return 'vendue'
  const relancee = lancements.some((l) => l.resultat === 'reussie' && l.titre === v.titre && l.le >= v.finLe - 60_000 && l.le <= v.finLe + FENETRE_RELANCE_MS)
  return relancee ? 'non-vendue-relancee' : 'non-vendue'
}
