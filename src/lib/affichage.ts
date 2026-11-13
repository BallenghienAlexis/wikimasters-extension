/** Préférence d’affichage (clé `affichage`) : logique pure, sans `chrome.*`. */

export interface Affichage {
  version: 1
  animations: boolean
}

export const AFFICHAGE_DEFAUT: Affichage = { version: 1, animations: true }

/** `null` si version inconnue ou forme inattendue (le défaut s’applique alors, sans écraser). */
export function validerAffichage(brut: unknown): Affichage | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const o = brut as Record<string, unknown>
  if (o.version !== 1 || typeof o.animations !== 'boolean') return null
  return { version: 1, animations: o.animations }
}
