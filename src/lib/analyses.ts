/** Analyses de l’onglet Collection. Fonctions pures : `doublons`, `plusCheres` (10 au plus), `themesFrequents` (10 au plus). */
import type { Carte } from './collection'
import { compterThemes } from './themes'

const LIMITE = 10

export const doublons = (cartes: readonly Carte[]): Carte[] => cartes.filter((c) => c.quantite > 1)

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
