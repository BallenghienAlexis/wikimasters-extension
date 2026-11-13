/**
 * Analyses de l’onglet Collection (T-301). Fonctions pures, listes vides exploitables.
 *
 * Exports (importés par T-308) : `doublons`, `aTrier`, `defaussables(cartes, plafond)`,
 * `valeurParDecision`, `plusCheres` (10 au plus), `themesFrequents` (10 au plus).
 * Le plafond de défausse réglé vient de `plafondDefausse` (`tri.ts`), passé par l’appelant.
 */
import type { Carte, Statut } from './collection'
import { STATUTS } from './collection'
import { compterThemes } from './themes'

const LIMITE = 10

export const doublons = (cartes: readonly Carte[]): Carte[] => cartes.filter((c) => c.quantite > 1)

export const aTrier = (cartes: readonly Carte[]): Carte[] => cartes.filter((c) => c.statut === 'a-trier')

/** Statut `defausser`, valeur connue et au plus égale au plafond. */
export const defaussables = (cartes: readonly Carte[], plafond: number): Carte[] =>
  cartes.filter((c) => c.statut === 'defausser' && c.valeurMarchande !== null && c.valeurMarchande <= plafond)

export function valeurParDecision(
  cartes: readonly Carte[],
): { statut: Statut; exemplaires: number; valeur: number | null }[] {
  return STATUTS.map((statut) => {
    const du = cartes.filter((c) => c.statut === statut)
    const connues = du.filter((c) => c.valeurMarchande !== null)
    return {
      statut,
      exemplaires: du.reduce((s, c) => s + c.quantite, 0),
      valeur: connues.length === 0 ? null : connues.reduce((s, c) => s + (c.valeurMarchande ?? 0) * c.quantite, 0),
      present: du.length > 0,
    }
  })
    .filter((l) => l.present)
    .map(({ statut, exemplaires, valeur }) => ({ statut, exemplaires, valeur }))
}

/** Tri stable (égalités dans l’ordre de la collection). */
export function plusCheres(cartes: readonly Carte[]): Carte[] {
  return cartes
    .filter((c) => c.valeurMarchande !== null)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.valeurMarchande ?? 0) - (a.c.valeurMarchande ?? 0) || a.i - b.i)
    .slice(0, LIMITE)
    .map(({ c }) => c)
}

export function themesFrequents(cartes: readonly Carte[]): { theme: string; nombre: number }[] {
  return Object.entries(compterThemes([...cartes]))
    .filter(([, nombre]) => nombre > 0)
    .map(([theme, nombre]) => ({ theme, nombre }))
    .sort((a, b) => b.nombre - a.nombre || (a.theme < b.theme ? -1 : a.theme > b.theme ? 1 : 0))
    .slice(0, LIMITE)
}
