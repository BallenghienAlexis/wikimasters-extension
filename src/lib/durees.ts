/**
 * Durées mesurées (Alexis, 2026-11-24 : « améliore tous les systèmes de prédiction de temps en te basant sur les requêtes
 * déjà passées ») : chaque process note le temps réel qu’il met par unité (page lue, prix, action d’un lot, titre
 * Wikipédia) ; les estimations affichées (durée restante, aperçu des lots, lecture de fond) utilisent la médiane des
 * dernières mesures, avec un repli sur les tarifs par défaut tant que l’historique est trop court.
 *
 * Logique pure : aucune requête, aucun `chrome.*`, aucune horloge. Les cadences, la gigue et les arrêts ne changent pas :
 * seule l’**estimation affichée** en dépend. Les mesures sont des durées en millisecondes, sans identifiant ni contenu.
 */

export const CATEGORIES_DUREE = ['lecture', 'ecriture', 'prix', 'wikipedia'] as const
export type CategorieDuree = (typeof CATEGORIES_DUREE)[number]

export type MesuresDurees = Record<CategorieDuree, number[]>

/** Tarifs de repli, en secondes par unité (valeurs d’avant les mesures : cadence 0,2 s + gigue moyenne 0,05 s, etc.). */
export const DUREES_PAR_DEFAUT: Readonly<Record<CategorieDuree, number>> = {
  lecture: 0.25,
  ecriture: 0.25,
  /** 0,2 s + gigue 0,05 s + pause de prix 1,2 s + variation moyenne 0,2 s. */
  prix: 1.65,
  /** Environ trois requêtes Wikipédia/Wikidata d’une seconde par titre. */
  wikipedia: 3,
}

/** Nombre de mesures gardées par catégorie (les plus récentes). */
export const MESURES_MAX = 60
/** Sous ce nombre de mesures, le tarif par défaut est gardé. */
export const MESURES_MIN = 5
/** Une unité qui a pris plus que cela (attente après erreur, onglet endormi) n’est pas représentative : ignorée. */
export const MESURE_MAX_MS = 120_000

export const mesuresVides = (): MesuresDurees => ({ lecture: [], ecriture: [], prix: [], wikipedia: [] })

const mesureValide = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MESURE_MAX_MS

/** Valeur lue du stockage : une catégorie illisible redonne une liste vide (les mesures se reconstruisent). */
export function validerMesures(brut: unknown): MesuresDurees {
  const sortie = mesuresVides()
  if (typeof brut !== 'object' || brut === null) return sortie
  for (const cat of CATEGORIES_DUREE) {
    const liste = (brut as Record<string, unknown>)[cat]
    if (Array.isArray(liste)) sortie[cat] = liste.filter(mesureValide).map((v) => Math.round(v)).slice(-MESURES_MAX)
  }
  return sortie
}

/** Ajoute des mesures (invalides ignorées) en gardant les `MESURES_MAX` plus récentes. */
export function ajouterMesures(mesures: MesuresDurees, ajouts: Partial<Record<CategorieDuree, readonly number[]>>): MesuresDurees {
  const sortie = mesuresVides()
  for (const cat of CATEGORIES_DUREE) {
    const nouvelles = (ajouts[cat] ?? []).filter(mesureValide).map((v) => Math.round(v))
    sortie[cat] = [...mesures[cat], ...nouvelles].slice(-MESURES_MAX)
  }
  return sortie
}

export function mediane(valeurs: readonly number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b)
  const m = Math.floor(tri.length / 2)
  return tri.length % 2 === 1 ? (tri[m] as number) : ((tri[m - 1] as number) + (tri[m] as number)) / 2
}

/** Secondes par unité : médiane des mesures si elles sont assez nombreuses, sinon le tarif par défaut. */
export function secondesParUnite(mesures: MesuresDurees, cat: CategorieDuree): number {
  const liste = mesures[cat]
  if (liste.length < MESURES_MIN) return DUREES_PAR_DEFAUT[cat]
  return mediane(liste) / 1000
}

/** Vrai quand l’estimation de la catégorie vient des mesures et non du tarif par défaut. */
export const estMesuree = (mesures: MesuresDurees, cat: CategorieDuree): boolean => mesures[cat].length >= MESURES_MIN

// Mesures courantes de la page : alimentées par `App` (lecture du stockage), lues par les fonctions d’estimation.
let courantes: MesuresDurees = mesuresVides()

export const definirMesures = (mesures: MesuresDurees): void => {
  courantes = mesures
}

export const secondesPar = (cat: CategorieDuree): number => secondesParUnite(courantes, cat)

export const mesuresCourantes = (): MesuresDurees => courantes

export interface Collecteur {
  noter: (cat: CategorieDuree, ms: number) => void
  /** Écrit tout de suite les mesures en attente. */
  vider: () => Promise<void>
}

/**
 * Tampon de mesures : écrit au plus toutes les `delaiMs` (5 s) ou dès `seuil` mesures, jamais à chaque requête.
 * Une erreur d’écriture est ignorée (les mesures ne sont pas irremplaçables).
 */
export function creerCollecteur(
  ecrire: (ajouts: Partial<Record<CategorieDuree, number[]>>) => Promise<void>,
  options: { seuil?: number; delaiMs?: number } = {},
): Collecteur {
  const { seuil = 10, delaiMs = 5000 } = options
  let tampon: Partial<Record<CategorieDuree, number[]>> = {}
  let n = 0
  let minuteur: ReturnType<typeof setTimeout> | null = null
  const vider = async (): Promise<void> => {
    if (minuteur !== null) clearTimeout(minuteur)
    minuteur = null
    if (n === 0) return
    const ajouts = tampon
    tampon = {}
    n = 0
    await ecrire(ajouts).catch(() => undefined)
  }
  return {
    noter(cat, ms) {
      if (!mesureValide(ms)) return
      ;(tampon[cat] ??= []).push(ms)
      n += 1
      if (n >= seuil) void vider()
      else minuteur ??= setTimeout(() => void vider(), delaiMs)
    },
    vider,
  }
}
