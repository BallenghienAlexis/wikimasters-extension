/**
 * Sélection manuelle des cartes à mettre aux enchères ou à défausser (Alexis, 2026-11-14 : sans statut local,
 * le joueur choisit au lancement d’un lot ; l’étiquette « Statut · Vendre » du site préremplit la mise aux enchères).
 *
 * Logique pure, sans `chrome.*`. Rien n’est stocké : la sélection vit le temps de l’aperçu.
 */
import { CONFIG_AFFLUENCE } from '../config/affluence'
import { estHeureForte, type EvenementVente } from './affluence'
import { estFavoriVerrouille, normaliser, type Carte } from './collection'
import { estACLasser, type SelectionLot } from './lot'
import { LIBELLES_THEMES, themesDeCarte, themesPrincipaux } from './themes'
import { amisConcernes, plafondDefausse, type Preferences } from './tri'

/** Choix possibles pour une carte. */
export type ChoixCarte = 'aucun' | 'vendre' | 'defausser'

/** Une carte est proposable si elle est reliée au site, n’est ni un favori (verrouillé) ni « à classer ». */
export const estProposable = (c: Carte): boolean => !estFavoriVerrouille(c) && !estACLasser(c) && c.idsSite !== null && c.idsSite.length > 0 && c.quantite > 0

/** Raison pour laquelle une carte n’est pas proposable (null si elle l’est) : affichée au lieu de la masquer en silence. */
export const raisonNonProposable = (c: Carte): string | null => {
  if (estFavoriVerrouille(c)) return 'favori : verrouillé sur le site'
  if (c.idsSite === null || c.idsSite.length === 0 || c.quantite <= 0) return 'non reliée au site : lancez une synchronisation'
  if (estACLasser(c)) return 'sans thème fiable ou encore « #À classer » : écartée de toute vente tant qu’elle n’est pas classée'
  return null
}

/**
 * Cartes dont aucun prix n’a été trouvé sur le site (Alexis, 2026-11-23) : pas de valeur marchande (ni saisie à la main) et un
 * relevé récent où le site a répondu sans aucune valeur (`sansVente`). Une erreur, un 404 ou une carte passée ne comptent pas.
 */
export function idsSansPrixConfirme(
  cartes: readonly Carte[],
  prix: Readonly<Record<string, { valeur: number | null; releveLe: number; sansVente?: boolean }>>,
  maintenant: number,
  ancienneteMaxMs: number,
): string[] {
  return cartes
    .filter((c) => {
      const r = prix[c.id]
      return c.valeurMarchande === null && r !== undefined && r.sansVente === true && r.valeur === null && maintenant - r.releveLe <= ancienneteMaxMs
    })
    .map((c) => c.id)
}

/** Fraîcheur du relevé « aucun prix » pour proposer une défausse : une semaine (la défausse est définitive). */
export const FRAICHEUR_SANS_PRIX_MS = 7 * 86_400_000
/** Au-delà de ce nombre de cartes sans prix à défausser, la pré-coche de masse ne les coche pas : le joueur les choisit à la main. */
export const MAX_PRECOCHE_SANS_PRIX = 10

/** Cartes sans prix que la pré-coche défausserait (hors règles de garde), et si leur nombre dépasse le plafond de pré-coche. */
export function resumerSansPrix(cartes: readonly Carte[], preferences: Preferences, sansPrix: ReadonlySet<string>): { nombre: number; trop: boolean } {
  let nombre = 0
  for (const c of cartes) {
    // Conditions peu coûteuses d’abord : `estProposable` lit les thèmes de la carte.
    if (c.valeurMarchande !== null || !sansPrix.has(c.id) || !estProposable(c)) continue
    const themes = themesDeCarte(c)
    if (preferences.mesThemes.some((t) => themes.includes(t))) continue
    if (amisConcernes(themes, preferences.amis).length > 0 || c.ami !== null) continue
    nombre++
  }
  return { nombre, trop: nombre > MAX_PRECOCHE_SANS_PRIX }
}

const sansDieseEtAccents = (nom: string): string => normaliser(nom).replace(/^#\s*/, '').trim()

/**
 * Étiquette du site qui demande la vente : « Statut · Vendre » (relevé du compte d’Alexis, 2026-11-15) ou « À vendre ».
 * Lecture seule : l’extension ne pose jamais ces étiquettes. « Statut · En vente » (déjà aux enchères), « Échanger » et « Garder » ne préchoisissent rien.
 */
export const estEtiquetteAVendre = (nom: string): boolean => /^(statut[^a-z]*vendre|a vendre)$/.test(sansDieseEtAccents(nom))

export interface ChoixParCarte {
  choix: ChoixCarte
  /** Nombre d’exemplaires à défausser (1 au moins, `quantite` au plus) ; sans objet pour les autres choix. */
  exemplaires: number
  /** `regle` : coche posée par la pré-coche, recalculée à chaque fois ; absent : choix du joueur (ou étiquette du site), jamais touché. */
  origine?: 'regle'
}

export type Choix = ReadonlyMap<string, ChoixParCarte>

/** Choix de départ d’après les étiquettes du site (mise aux enchères seulement). */
export function choixInitial(cartes: readonly Carte[]): Choix {
  const m = new Map<string, ChoixParCarte>()
  for (const c of cartes) {
    if (!estProposable(c)) continue
    // La défausse reste un choix manuel : le compte n’a pas d’étiquette de défausse.
    if (c.etiquettesSite.some(estEtiquetteAVendre)) m.set(c.id, { choix: 'vendre', exemplaires: 1 })
  }
  return m
}

/** Convertit les choix en sélection du lot ; une carte non proposable ou sans choix est ignorée. */
export function versSelection(cartes: readonly Carte[], choix: Choix): SelectionLot {
  const vendre: string[] = []
  const defausser: Record<string, number> = {}
  for (const c of cartes) {
    const x = choix.get(c.id)
    if (!x || !estProposable(c)) continue
    if (x.choix === 'vendre') vendre.push(c.id)
    else if (x.choix === 'defausser') defausser[c.id] = Math.max(1, Math.min(x.exemplaires, c.quantite, c.idsSite?.length ?? 0))
  }
  return { vendre, defausser }
}

/** Raison du verdict d’une carte (stable : sert aux filtres et aux comptes de l’interface). */
export type CodeVerdict =
  | 'favori'
  | 'non-reliee'
  | 'a-classer'
  | 'theme-garde'
  | 'ami'
  | 'valeur-inconnue'
  | 'sans-prix-trop'
  | 'defausse-plafond'
  | 'defausse-sans-prix'
  | 'enchere'

/** Verdict des règles pour une carte : ce que la pré-coche proposerait, avec le motif exact (Alexis, 2026-11-24 : « pourquoi gardée ? »). */
export interface Verdict {
  /** `garder` : aucune proposition ; sinon l’action que la pré-coche cocherait. */
  action: 'garder' | 'defausser' | 'vendre'
  code: CodeVerdict
  /** Motif lisible, sans majuscule initiale ni point final. */
  motif: string
  /** Motif en quelques mots pour les listes (« Thème gardé : Rock », « Valeur 2 ≤ 20 »). */
  court: string
  /** Libellé complet pour la ligne de la carte (« Gardée : … », « Défausse proposée : … »). */
  libelle: string
  /** Exemplaires à défausser (défausse seulement). */
  exemplaires: number
}

const libelleTheme = (id: string): string => (LIBELLES_THEMES[id] ?? id).replace(/^#/, '')

const exemplairesADefausser = (c: Carte): number => Math.max(1, Math.min(c.quantite - 1, (c.idsSite?.length ?? 1) - 1))

/**
 * Verdict d’une carte avec les règles courantes (aucun cache : recalculé à chaque appel). Source unique de la pré-coche,
 * de la relance automatique et de l’affichage du motif. Ordre des règles : favori, non reliée, « à classer », thème gardé,
 * ami, puis la valeur (inconnue, au plafond ou en dessous : défausse ; au-dessus : enchère).
 * `sansPrixAutorise` : faux quand trop de cartes sans prix seraient défaussées d’un coup (elles se choisissent alors à la main).
 */
export function verdictCarte(c: Carte, preferences: Preferences, sansPrix: ReadonlySet<string>, sansPrixAutorise: boolean): Verdict {
  const v = (action: Verdict['action'], code: CodeVerdict, motif: string, court: string, exemplaires = 1): Verdict => ({
    action,
    code,
    motif,
    court,
    exemplaires,
    libelle: `${action === 'garder' ? 'Gardée' : action === 'defausser' ? 'Défausse proposée' : 'Enchère proposée'} : ${motif}`,
  })
  const raison = raisonNonProposable(c)
  if (raison !== null) {
    const code: CodeVerdict = estFavoriVerrouille(c) ? 'favori' : c.idsSite === null || c.idsSite.length === 0 || c.quantite <= 0 ? 'non-reliee' : 'a-classer'
    return v('garder', code, raison, code === 'favori' ? 'Favori' : code === 'non-reliee' ? 'Non reliée au site' : 'Sans thème fiable')
  }
  const themes = themesDeCarte(c)
  const gardes = preferences.mesThemes.filter((t) => themes.includes(t))
  if (gardes.length > 0) {
    const directs = new Set(themesPrincipaux(c))
    const noms = gardes.map((t) => `« ${libelleTheme(t)} »${directs.has(t) ? '' : ' (famille d’un thème de la carte)'}`)
    return v('garder', 'theme-garde', `thème que vous gardez ${noms.join(', ')}`, `Thème gardé : ${gardes.map(libelleTheme).join(', ')}`)
  }
  const amis = amisConcernes(themes, preferences.amis)
  if (amis.length > 0) return v('garder', 'ami', `thème suivi par ${amis.map((a) => a.nom).join(', ')} (échange par « #À échanger »)`, `Ami : ${amis.map((a) => a.nom).join(', ')}`)
  if (c.ami !== null) return v('garder', 'ami', `carte réservée à ${c.ami}`, `Ami : ${c.ami}`)
  if (c.valeurMarchande === null) {
    if (sansPrix.has(c.id)) {
      if (sansPrixAutorise) return v('defausser', 'defausse-sans-prix', 'aucun prix trouvé sur le site et aucune règle de garde', 'Aucun prix trouvé', exemplairesADefausser(c))
      return v('garder', 'sans-prix-trop', `aucun prix trouvé, mais plus de ${MAX_PRECOCHE_SANS_PRIX} cartes dans ce cas : à choisir à la main`, 'Sans prix, trop nombreuses')
    }
    return v('garder', 'valeur-inconnue', 'valeur marchande inconnue (prix pas encore relevé de façon sûre)', 'Valeur inconnue')
  }
  if (c.valeurMarchande <= plafondDefausse(preferences)) {
    return v('defausser', 'defausse-plafond', `valeur ${c.valeurMarchande}, au plafond de défausse (${plafondDefausse(preferences)}) ou en dessous`, `Valeur ${c.valeurMarchande} ≤ ${plafondDefausse(preferences)}`, exemplairesADefausser(c))
  }
  return v('vendre', 'enchere', `valeur ${c.valeurMarchande}, au-dessus du plafond de défausse (${plafondDefausse(preferences)})`, `Valeur ${c.valeurMarchande} > ${plafondDefausse(preferences)}`)
}

/** Verdict de toutes les cartes, recalculé avec les règles courantes (appelé à chaque ouverture des lots et à chaque affichage). */
export function verdictsDesCartes(
  cartes: readonly Carte[],
  preferences: Preferences,
  sansPrix: ReadonlySet<string> = new Set(),
  /** Collection entière, pour décider si les cartes sans prix sont trop nombreuses quand `cartes` n’en est qu’une partie (lignes affichées). */
  ensemble: readonly Carte[] = cartes,
): Map<string, Verdict> {
  const autorise = resumerSansPrix(ensemble, preferences, sansPrix).nombre <= MAX_PRECOCHE_SANS_PRIX
  const m = new Map<string, Verdict>()
  for (const c of cartes) m.set(c.id, verdictCarte(c, preferences, sansPrix, autorise))
  return m
}

/**
 * Retire des choix les coches de règle (`origine: 'regle'`) que les règles courantes ne proposent plus (nouveau favori, thème
 * gardé, prix relevé…) : plus de coche périmée au lancement. Les choix du joueur (sans origine) sont gardés tels quels.
 */
export function retirerCochesPerimees(choix: Choix, verdicts: ReadonlyMap<string, Verdict>): Choix {
  let change = false
  const m = new Map<string, ChoixParCarte>()
  for (const [id, x] of choix) {
    const v = verdicts.get(id)
    const attendu: ChoixCarte = v?.action === 'defausser' ? 'defausser' : v?.action === 'vendre' ? 'vendre' : 'aucun'
    if (x.origine === 'regle' && x.choix !== attendu) {
      change = true
      continue
    }
    m.set(id, x)
  }
  return change ? m : choix
}

/**
 * Pré-coche d’après les règles de l’ancien assistant (Alexis, 2026-11-15), sans rien imposer : le joueur garde la main
 * sur chaque case avant « Lancer ». Voir `verdictCarte` pour les règles et leurs motifs. Les coches posées par une pré-coche
 * précédente (`origine: 'regle'`) sont **recalculées** à chaque fois (Alexis, 2026-11-24 : toutes les cartes revues à chaque
 * fois) ; un choix du joueur n’est jamais remplacé. Aucun prix trouvé (`sansPrix`, Alexis 2026-11-23) : voir `verdictCarte`.
 */
export function precocher(cartes: readonly Carte[], preferences: Preferences, actuel: Choix, sansPrix: ReadonlySet<string> = new Set()): Choix {
  const m = new Map<string, ChoixParCarte>()
  for (const [id, x] of actuel) if (x.origine !== 'regle') m.set(id, x)
  for (const [id, v] of verdictsDesCartes(cartes, preferences, sansPrix)) {
    if (v.action === 'garder' || m.has(id)) continue
    m.set(id, v.action === 'defausser' ? { choix: 'defausser', exemplaires: v.exemplaires, origine: 'regle' } : { choix: 'vendre', exemplaires: 1, origine: 'regle' })
  }
  return m
}

/** Conseil de moment de lancement pour une mise aux enchères (durée toujours 1 h, Alexis 2026-11-15) : chères en heure forte, moins chères en temps libre. */
export function conseilLancement(valeur: number | null, at: number, evenements: readonly EvenementVente[]): string {
  if (valeur === null) return 'valeur inconnue'
  const forte = estHeureForte(at, evenements)
  const chere = valeur >= CONFIG_AFFLUENCE.seuilCarteChere
  if (chere) return forte ? 'heure forte : bon moment' : 'carte chère : attendre une heure forte'
  return forte ? 'heure forte : mieux vaut réserver ce créneau aux cartes chères' : 'temps libre : bon moment'
}
