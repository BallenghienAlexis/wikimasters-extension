/**
 * Sélection manuelle des cartes à mettre aux enchères ou à défausser (Alexis, 2026-11-14 : sans statut local,
 * le joueur choisit au lancement d’un lot ; l’étiquette « Statut · Vendre » du site préremplit la mise aux enchères).
 *
 * Logique pure, sans `chrome.*`. Rien n’est stocké : la sélection vit le temps de l’aperçu.
 */
import { CONFIG_AFFLUENCE } from '../config/affluence'
import { estHeureForte, type EvenementVente } from './affluence'
import { normaliser, type Carte } from './collection'
import { estACLasser, type SelectionLot } from './lot'
import { themesDeCarte } from './themes'
import { amisConcernes, plafondDefausse, type Preferences } from './tri'

/** Choix possibles pour une carte. */
export type ChoixCarte = 'aucun' | 'vendre' | 'defausser'

/** Une carte est proposable si elle est reliée au site, n’est ni un favori (verrouillé) ni « à classer ». */
export const estProposable = (c: Carte): boolean => !c.favori && !estACLasser(c) && c.idsSite !== null && c.idsSite.length > 0 && c.quantite > 0

/** Raison pour laquelle une carte n’est pas proposable (null si elle l’est) : affichée au lieu de la masquer en silence. */
export const raisonNonProposable = (c: Carte): string | null => {
  if (c.favori) return 'favori : verrouillé sur le site'
  if (c.idsSite === null || c.idsSite.length === 0 || c.quantite <= 0) return 'non reliée au site : lancez une synchronisation'
  if (estACLasser(c)) return 'sans thème fiable ou encore « #À classer » : écartée de toute vente tant qu’elle n’est pas classée'
  return null
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

/**
 * Pré-coche d’après les règles de l’ancien assistant (Alexis, 2026-11-15), sans rien imposer : le joueur garde la main
 * sur chaque case avant « Lancer ». Un favori n’est jamais coché. Un thème gardé (« Mes thèmes ») : rien. Un ami concerné :
 * rien non plus, l’échange passe uniquement par les étiquettes « #À échanger <nom> » que le lot pose (jamais « Statut · Échanger »).
 * Valeur inconnue : rien. Valeur au plafond de défausse ou en dessous : défausse. Sinon : mise aux enchères.
 * Une coche déjà faite (`actuel`) n’est jamais remplacée.
 */
export function precocher(cartes: readonly Carte[], preferences: Preferences, actuel: Choix): Choix {
  const m = new Map(actuel)
  const plafond = plafondDefausse(preferences)
  for (const c of cartes) {
    if (!estProposable(c) || m.has(c.id)) continue
    const themes = themesDeCarte(c)
    if (preferences.mesThemes.some((t) => themes.includes(t))) continue
    if (amisConcernes(themes, preferences.amis).length > 0 || c.ami !== null) continue
    if (c.valeurMarchande === null) continue
    // Défausse définitive : on garde un exemplaire quand la carte est en plusieurs (les doublons seulement).
    if (c.valeurMarchande <= plafond) m.set(c.id, { choix: 'defausser', exemplaires: Math.max(1, Math.min(c.quantite - 1, (c.idsSite?.length ?? 1) - 1)) })
    else m.set(c.id, { choix: 'vendre', exemplaires: 1 })
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
