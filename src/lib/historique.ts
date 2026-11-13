/**
 * Historique quotidien du nombre d’exemplaires (clé `historique`) : logique pure, sans `chrome.*`.
 * Jour local, un point par jour (le dernier remplace), 30 points au plus.
 */

export interface PointHistorique {
  jour: string
  exemplaires: number
}

export const MAX_POINTS = 30
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/

const deux = (n: number): string => String(n).padStart(2, '0')

/** Jour local au format AAAA-MM-JJ. */
export const jourLocal = (d: Date): string => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`

/** Valide l’enveloppe `{version:1, points}` ; `null` si version inconnue ou forme inattendue. */
export function validerHistorique(brut: unknown): PointHistorique[] | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const o = brut as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.points) || o.points.length > MAX_POINTS) return null
  const sortie: PointHistorique[] = []
  for (const p of o.points) {
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null
    const { jour, exemplaires } = p as Record<string, unknown>
    if (typeof jour !== 'string' || !FORMAT_JOUR.test(jour)) return null
    if (typeof exemplaires !== 'number' || !Number.isSafeInteger(exemplaires) || exemplaires < 0) return null
    sortie.push({ jour, exemplaires })
  }
  return sortie
}

/** Note le nombre d’exemplaires du jour (remplace le point du même jour), borne à 30 points triés. */
export function noterPoint(points: readonly PointHistorique[], exemplaires: number, maintenant: Date): PointHistorique[] {
  const jour = jourLocal(maintenant)
  const suite = [...points.filter((p) => p.jour !== jour), { jour, exemplaires }]
  suite.sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0))
  return suite.slice(-MAX_POINTS)
}

/** Série des 30 derniers jours finissant aujourd’hui ; `null` là où aucun point n’existe. */
export function serie30Jours(
  points: readonly PointHistorique[],
  maintenant: Date,
): Array<{ jour: string; exemplaires: number | null }> {
  const parJour = new Map(points.map((p) => [p.jour, p.exemplaires]))
  const sortie: Array<{ jour: string; exemplaires: number | null }> = []
  for (let i = MAX_POINTS - 1; i >= 0; i--) {
    const jour = jourLocal(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - i, 12))
    sortie.push({ jour, exemplaires: parJour.get(jour) ?? null })
  }
  return sortie
}
