/**
 * Agrégations des graphiques du Tableau de bord (Alexis, 2026-11-24) : calendrier d’activité, répartition des thèmes,
 * répartition des verdicts de garde, profil d’affluence. Logique pure : aucun `chrome.*`, aucune requête, horloge injectée.
 * Les données viennent du stockage déjà lu par l’application (journal, enchères terminées, relances, collection).
 */
import type { EntreeJournal } from './actions'
import { CONFIG_AFFLUENCE, type ConfigAffluence } from '../config/affluence'
import { estHeureForte, type EvenementVente } from './affluence'
import type { Carte } from './collection'
import { jourLocal } from './historique'
import type { Verdict } from './selectionLot'
import { LIBELLES_THEMES, themesPrincipaux } from './themes'
import type { LancementVente } from './ventes'

/* ───────────── Calendrier d’activité ───────────── */

export type CategorieActivite = 'encheres' | 'ventes' | 'defausses' | 'etiquettes'
export type FiltreActivite = 'tout' | CategorieActivite

export const LIBELLES_ACTIVITE: Readonly<Record<FiltreActivite, string>> = {
  tout: 'Toute l’activité',
  encheres: 'Enchères lancées',
  ventes: 'Ventes réussies',
  defausses: 'Défausses',
  etiquettes: 'Étiquettes et favoris',
}

export interface EvenementActivite {
  at: number
  categorie: CategorieActivite
}

const TYPES_ETIQUETTES: ReadonlySet<EntreeJournal['type']> = new Set(['creation-etiquette', 'pose-etiquette', 'retrait-etiquette', 'suppression-etiquette', 'favori'])

/**
 * Évènements d’activité du joueur, sans doublon entre sources :
 * - enchères lancées : actions « enchère » réussies du journal (lots à la main) + relances automatiques réussies ;
 * - ventes réussies : enchères terminées vendues (daté de la mise en vente, la fin n’étant pas conservée) ;
 * - défausses et étiquettes/favoris : actions réussies du journal. Les lectures de synchro ne sont pas comptées.
 */
export function evenementsActivite(
  journal: readonly EntreeJournal[],
  lancements: readonly LancementVente[],
  resultats: readonly EvenementVente[],
): EvenementActivite[] {
  const sortie: EvenementActivite[] = []
  for (const e of journal) {
    if (e.resultat !== 'reussie') continue
    const at = Date.parse(e.horodatage)
    if (!Number.isFinite(at)) continue
    if (e.type === 'enchere') sortie.push({ at, categorie: 'encheres' })
    else if (e.type === 'defausse') sortie.push({ at, categorie: 'defausses' })
    else if (TYPES_ETIQUETTES.has(e.type)) sortie.push({ at, categorie: 'etiquettes' })
  }
  for (const l of lancements) if (l.resultat === 'reussie') sortie.push({ at: l.le, categorie: 'encheres' })
  for (const r of resultats) if (r.type === 'resultat' && (r.poids ?? 0) > 0) sortie.push({ at: r.at, categorie: 'ventes' })
  return sortie
}

/** Activité cumulée par jour local (clé `activiteQuotidienne`) : survit au plafond du journal et voyage dans la sauvegarde. */
export type CompteursJour = Record<CategorieActivite, number>
export type ActiviteJours = Record<string, CompteursJour>

export const CATEGORIES_ACTIVITE: readonly CategorieActivite[] = ['encheres', 'ventes', 'defausses', 'etiquettes']
/** Jours gardés (un peu plus d’un an). */
export const MAX_JOURS_ACTIVITE = 400
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/
const MAX_COMPTE = 1_000_000

const vide = (): CompteursJour => ({ encheres: 0, ventes: 0, defausses: 0, etiquettes: 0 })

/** Compte les évènements par jour local. */
export function compterParJour(evenements: readonly EvenementActivite[]): ActiviteJours {
  const sortie: ActiviteJours = {}
  for (const e of evenements) {
    const j = jourLocal(new Date(e.at))
    ;(sortie[j] ??= vide())[e.categorie]++
  }
  return sortie
}

/** Valide l’activité lue du stockage ou d’une sauvegarde : jours et compteurs illisibles ignorés, 400 jours au plus (les plus récents). */
export function validerActiviteJours(brut: unknown): ActiviteJours {
  const sortie: ActiviteJours = {}
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return sortie
  for (const [jour, v] of Object.entries(brut)) {
    if (!FORMAT_JOUR.test(jour) || typeof v !== 'object' || v === null) continue
    const o = v as Record<string, unknown>
    const c = vide()
    let somme = 0
    for (const k of CATEGORIES_ACTIVITE) {
      const n = o[k]
      if (typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= MAX_COMPTE) {
        c[k] = n
        somme += n
      }
    }
    if (somme > 0) sortie[jour] = c
  }
  return limiterJours(sortie)
}

function limiterJours(j: ActiviteJours): ActiviteJours {
  const cles = Object.keys(j).sort()
  if (cles.length <= MAX_JOURS_ACTIVITE) return j
  return Object.fromEntries(cles.slice(-MAX_JOURS_ACTIVITE).map((k) => [k, j[k]!]))
}

/**
 * Fusionne deux activités : par jour et par catégorie, le plus grand compte l’emporte. L’opération est idempotente (relire
 * le même journal ou importer deux fois la même sauvegarde ne double rien) ; un compte déjà acquis ne baisse jamais, même
 * quand le journal (1 000 entrées) a oublié les plus anciennes actions.
 */
export function fusionnerActiviteJours(a: ActiviteJours, b: ActiviteJours): ActiviteJours {
  const sortie: ActiviteJours = {}
  for (const jour of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[jour]
    const y = b[jour]
    const c = vide()
    for (const k of CATEGORIES_ACTIVITE) c[k] = Math.max(x?.[k] ?? 0, y?.[k] ?? 0)
    sortie[jour] = c
  }
  return limiterJours(sortie)
}

export interface JourActivite {
  /** Jour local AAAA-MM-JJ. */
  jour: string
  n: number
  /** Détail par catégorie (info-bulle) ; tout à 0 pour un jour à venir. */
  detail: CompteursJour
  /** Jour à venir (dernière semaine, après aujourd’hui) : non coloré. */
  futur: boolean
}

export interface CalendrierActivite {
  /** Colonnes = semaines (lundi d’abord), 7 jours chacune, la plus ancienne en premier. */
  semaines: JourActivite[][]
  total: number
  maximum: number
  joursActifs: number
}

/** Lundi (heure locale, midi pour éviter les bascules d’heure) de la semaine qui contient `d`. */
function lundiDe(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Calendrier des `nbSemaines` dernières semaines (la semaine en cours comprise), filtré par catégorie. */
export function calendrierActivite(jours: ActiviteJours, filtre: FiltreActivite, nbSemaines: number, maintenant: Date): CalendrierActivite {
  const nb = Math.max(1, nbSemaines)
  const debut = lundiDe(maintenant)
  debut.setDate(debut.getDate() - 7 * (nb - 1))
  const aujourdhui = jourLocal(maintenant)
  const semaines: JourActivite[][] = []
  let total = 0
  let maximum = 0
  let joursActifs = 0
  const curseur = new Date(debut)
  for (let s = 0; s < nb; s++) {
    const colonne: JourActivite[] = []
    for (let i = 0; i < 7; i++) {
      const jour = jourLocal(curseur)
      const futur = jour > aujourdhui
      const detail = futur ? vide() : { ...vide(), ...jours[jour] }
      const n = filtre === 'tout' ? CATEGORIES_ACTIVITE.reduce((t, k) => t + detail[k], 0) : detail[filtre]
      total += n
      maximum = Math.max(maximum, n)
      if (n > 0) joursActifs++
      colonne.push({ jour, n, detail, futur })
      curseur.setDate(curseur.getDate() + 1)
    }
    semaines.push(colonne)
  }
  return { semaines, total, maximum, joursActifs }
}

/** Intensité de 0 (aucune activité) à 4 (jour le plus actif), par quarts du maximum. */
export function niveauActivite(n: number, maximum: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0 || maximum <= 0) return 0
  return Math.max(1, Math.min(4, Math.ceil((4 * n) / maximum))) as 1 | 2 | 3 | 4
}


/* ───────────── Répartitions (camemberts) ───────────── */

export interface Part {
  id: string
  libelle: string
  valeur: number
}

export const ID_AUTRES = 'autres'
export const ID_SANS_THEME = 'sans-theme'

/** Répartition des cartes par thème principal (le mieux établi de chaque carte) ; au plus `max` parts, le reste dans « Autres thèmes ». */
export function repartitionThemes(cartes: readonly Carte[], max = 6): Part[] {
  const compte = new Map<string, number>()
  for (const c of cartes) {
    const id = themesPrincipaux(c)[0] ?? ID_SANS_THEME
    compte.set(id, (compte.get(id) ?? 0) + 1)
  }
  const libelle = (id: string): string => (id === ID_SANS_THEME ? 'Sans thème fiable' : (LIBELLES_THEMES[id] ?? id).replace(/^#/, ''))
  const parts = [...compte].map(([id, valeur]): Part => ({ id, libelle: libelle(id), valeur })).sort((a, b) => b.valeur - a.valeur || a.libelle.localeCompare(b.libelle, 'fr'))
  if (parts.length <= max) return parts
  // « Sans thème fiable » reste visible même s’il est petit : c’est un manque à combler, pas un thème.
  const tete = parts.slice(0, max - 1)
  const reste = parts.slice(max - 1)
  const sans = reste.find((p) => p.id === ID_SANS_THEME)
  if (sans && !tete.some((p) => p.id === ID_SANS_THEME)) {
    tete.pop()
    reste.push(...parts.slice(max - 2, max - 1))
    reste.splice(reste.indexOf(sans), 1)
    tete.push(sans)
  }
  const autres = parts.filter((p) => !tete.includes(p)).reduce((s, p) => s + p.valeur, 0)
  return [...tete, { id: ID_AUTRES, libelle: 'Autres thèmes', valeur: autres }]
}

export type IdDestination = 'moi' | 'amis' | 'vendre' | 'defausser' | 'a-traiter'

export const LIBELLES_DESTINATION: Readonly<Record<IdDestination, string>> = {
  moi: 'Gardées pour moi',
  amis: 'Voulues par mes amis',
  vendre: 'À mettre en vente',
  defausser: 'À défausser',
  'a-traiter': 'À classer ou à relever',
}

/** Destination d’une carte d’après son verdict de garde (même source que la pré-coche des lots et les filtres de la Collection). */
export function destinationDe(v: Verdict): IdDestination {
  switch (v.code) {
    case 'favori':
    case 'theme-garde':
      return 'moi'
    case 'ami':
      return 'amis'
    case 'enchere':
      return 'vendre'
    case 'defausse-plafond':
    case 'defausse-sans-prix':
      return 'defausser'
    default:
      return 'a-traiter'
  }
}

/** Répartition des cartes distinctes entre gardées, voulues par les amis, à vendre, à défausser et à traiter (parts vides omises). */
export function repartitionDestinations(verdicts: ReadonlyMap<string, Verdict>): Part[] {
  const compte: Record<IdDestination, number> = { moi: 0, amis: 0, vendre: 0, defausser: 0, 'a-traiter': 0 }
  for (const v of verdicts.values()) compte[destinationDe(v)]++
  return (Object.keys(LIBELLES_DESTINATION) as IdDestination[]).filter((id) => compte[id] > 0).map((id) => ({ id, libelle: LIBELLES_DESTINATION[id], valeur: compte[id] }))
}

export const totalParts = (parts: readonly Part[]): number => parts.reduce((s, p) => s + p.valeur, 0)

/** Part en pourcentage entier (0 si total nul). */
export const pourcentage = (valeur: number, total: number): number => (total <= 0 ? 0 : Math.round((valeur * 100) / total))

export interface Secteur {
  id: string
  /** Angles en radians, 0 = haut, sens horaire. */
  debut: number
  fin: number
}

/** Angles de chaque part, dans l’ordre ; les parts vides n’ont pas de secteur. */
export function secteurs(parts: readonly Part[]): Secteur[] {
  const total = totalParts(parts)
  if (total <= 0) return []
  let angle = 0
  const sortie: Secteur[] = []
  for (const p of parts) {
    if (p.valeur <= 0) continue
    const fin = angle + (p.valeur / total) * 2 * Math.PI
    sortie.push({ id: p.id, debut: angle, fin })
    angle = fin
  }
  return sortie
}

const arrondi = (n: number): string => String(Math.round(n * 100) / 100)
const point = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)]

/** Tracé SVG d’un secteur d’anneau (`rInterieur` à 0 : secteur plein). Un tour complet est tracé en deux demi-arcs. */
export function cheminSecteur(cx: number, cy: number, rExterieur: number, rInterieur: number, debut: number, fin: number): string {
  const tour = 2 * Math.PI
  const fin2 = fin - debut >= tour - 1e-9 ? debut + tour - 1e-4 : fin
  const grand = fin2 - debut > Math.PI ? 1 : 0
  const [x1, y1] = point(cx, cy, rExterieur, debut)
  const [x2, y2] = point(cx, cy, rExterieur, fin2)
  const exterieur = `M ${arrondi(x1)} ${arrondi(y1)} A ${rExterieur} ${rExterieur} 0 ${grand} 1 ${arrondi(x2)} ${arrondi(y2)}`
  if (rInterieur <= 0) return `${exterieur} L ${cx} ${cy} Z`
  const [x3, y3] = point(cx, cy, rInterieur, fin2)
  const [x4, y4] = point(cx, cy, rInterieur, debut)
  return `${exterieur} L ${arrondi(x3)} ${arrondi(y3)} A ${rInterieur} ${rInterieur} 0 ${grand} 0 ${arrondi(x4)} ${arrondi(y4)} Z`
}

/* ───────────── Profil d’affluence (7 jours × 8 tranches de 3 h) ───────────── */

export type SourceAffluence = 'resultats' | 'observations' | 'defaut'

export const TRANCHES = 8
export const HEURES_PAR_TRANCHE = 3
/** Ordre d’affichage : lundi d’abord ; valeurs de `Date.getDay()`. */
export const JOURS_AFFICHES: readonly number[] = [1, 2, 3, 4, 5, 6, 0]
export const NOMS_JOURS: Readonly<Record<number, string>> = { 0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' }

export interface CelluleAffluence {
  /** Valeur de `getDay()` (0 = dimanche). */
  jour: number
  /** 0 à 7 : tranche de 3 h commençant à `tranche × 3` h. */
  tranche: number
  /** Rendement moyen (enchères terminées), nombre de mises en vente (observations) ou 1/0 (créneaux par défaut). */
  valeur: number
  /** Observations dans la cellule (enchères terminées ou mises en vente notées) ; sert à dire « pas encore assez de données ». */
  nombre: number
  /** Une heure de la tranche au moins est une heure forte selon la règle des durées d’enchère (`estHeureForte`). */
  forte: boolean
}

export interface ProfilAffluence {
  source: SourceAffluence
  /** Enchères terminées (source `resultats`) ou observations (source `observations`) ; 0 par défaut. */
  nombre: number
  /** Une ligne par jour de `JOURS_AFFICHES`, 8 tranches chacune. */
  jours: CelluleAffluence[][]
  maximum: number
}

export const libelleTranche = (t: number): string => `${t * HEURES_PAR_TRANCHE} h–${(t + 1) * HEURES_PAR_TRANCHE} h`

// Semaine de référence (lundi 2026-11-23 → dimanche 2026-11-29) : seule la nature du jour compte pour `estHeureForte`.
const dateReference = (jour: number, heure: number): number => new Date(2026, 10, 23 + ((jour + 6) % 7), heure, 30).getTime()

/**
 * Profil de la semaine : 7 jours par tranches de 3 h, calculé avec la même règle que le conseil de lancement
 * (`estHeureForte`), donc cohérent avec les durées d’enchère choisies. Les données sont celles des enchères du joueur, pas de
 * tout le site ; il s’affine à chaque enchère terminée (source `resultats` dès `minVentesConclues`).
 */
export function profilAffluence(evenements: readonly EvenementVente[], config: ConfigAffluence = CONFIG_AFFLUENCE): ProfilAffluence {
  const resultats = evenements.filter((e) => e.type === 'resultat')
  const autres = evenements.filter((e) => e.type !== 'resultat')
  const nbObservations = autres.filter((e) => e.type === 'debut' || e.type === 'site').length
  const source: SourceAffluence = resultats.length >= config.minVentesConclues ? 'resultats' : nbObservations >= config.minObservations ? 'observations' : 'defaut'
  const somme = Array.from({ length: 7 }, () => new Array<number>(TRANCHES).fill(0))
  const n = Array.from({ length: 7 }, () => new Array<number>(TRANCHES).fill(0))
  const source_ = source === 'resultats' ? resultats : autres.filter((e) => e.type === 'debut' || e.type === 'site')
  for (const e of source_) {
    const d = new Date(e.at)
    const t = Math.floor(d.getHours() / HEURES_PAR_TRANCHE)
    somme[d.getDay()]![t]! += e.type === 'resultat' ? (e.poids ?? 0) : 1
    n[d.getDay()]![t]! += 1
  }
  let maximum = 0
  const jours = JOURS_AFFICHES.map((jour) =>
    Array.from({ length: TRANCHES }, (_, tranche): CelluleAffluence => {
      let forte = false
      for (let h = tranche * HEURES_PAR_TRANCHE; h < (tranche + 1) * HEURES_PAR_TRANCHE; h++) forte ||= estHeureForte(dateReference(jour, h), evenements, config)
      const nombre = n[jour]![tranche]!
      let valeur: number
      if (source === 'resultats') valeur = nombre > 0 ? somme[jour]![tranche]! / nombre : 0
      else if (source === 'observations') valeur = nombre
      else valeur = forte ? 1 : 0
      maximum = Math.max(maximum, valeur)
      return { jour, tranche, valeur, nombre, forte }
    }),
  )
  return { source, nombre: source === 'resultats' ? resultats.length : source === 'observations' ? nbObservations : 0, jours, maximum }
}
