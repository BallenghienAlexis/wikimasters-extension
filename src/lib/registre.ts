/**
 * Registre des étiquettes posées par l’extension.
 *
 * Seul le registre autorise un retrait : l’extension ne touche jamais une
 * étiquette qu’elle n’a pas posée. Logique pure, sans `chrome.*` ; la
 * persistance relève de `stockage.ts`.
 */
import type { Registre } from './actions'

export const VERSION_REGISTRE = 1
/** Longueur maximale d’un identifiant ou d’un nom d’étiquette. */
export const LONGUEUR_MAX_ID = 200
/** Nombre maximal de couples par exemplaire relié. */
export const COUPLES_MAX_PAR_EXEMPLAIRE = 2

function identifiantValide(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= LONGUEUR_MAX_ID
}

export function registreVide(): Registre {
  return { version: VERSION_REGISTRE, etiquettes: {}, couples: [] }
}

/** Mémorise l’identifiant d’une étiquette créée. Entrée invalide : registre inchangé. */
export function enregistrerEtiquette(r: Registre, nom: string, idEtiquette: string): Registre {
  if (!identifiantValide(nom) || !identifiantValide(idEtiquette)) return r
  return { ...r, etiquettes: { ...r.etiquettes, [nom]: idEtiquette }, couples: r.couples }
}

export function couplesDe(r: Registre, idExemplaire: string): Array<{ ex: string; nom: string }> {
  return r.couples.filter((c) => c.ex === idExemplaire).map((c) => ({ ex: c.ex, nom: c.nom }))
}

/** Pose un couple. Refusé (registre inchangé) au-delà de 2 couples pour l’exemplaire. */
export function poserCouple(r: Registre, idExemplaire: string, nom: string): Registre {
  if (!identifiantValide(idExemplaire) || !identifiantValide(nom)) return r
  const existants = r.couples.filter((c) => c.ex === idExemplaire)
  if (existants.some((c) => c.nom === nom)) return r
  if (existants.length >= COUPLES_MAX_PAR_EXEMPLAIRE) return r
  return { ...r, couples: [...r.couples, { ex: idExemplaire, nom }] }
}

export function retirerCouple(r: Registre, idExemplaire: string, nom: string): Registre {
  return { ...r, couples: r.couples.filter((c) => !(c.ex === idExemplaire && c.nom === nom)) }
}

export function purgerExemplaire(r: Registre, idExemplaire: string): Registre {
  return { ...r, couples: r.couples.filter((c) => c.ex !== idExemplaire) }
}

export function purgerCarte(r: Registre, idsExemplaires: readonly string[]): Registre {
  const ids = new Set(idsExemplaires)
  return { ...r, couples: r.couples.filter((c) => !ids.has(c.ex)) }
}

/** Valide un registre lu du stockage ; `null` si la forme est inattendue. Ne modifie jamais l’entrée. */
export function validerRegistre(brut: unknown): Registre | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const o = brut as Record<string, unknown>
  if (o.version !== VERSION_REGISTRE) return null
  const et = o.etiquettes
  if (typeof et !== 'object' || et === null || Array.isArray(et)) return null
  if (!Array.isArray(o.couples)) return null

  const etiquettes: Record<string, string> = {}
  for (const [nom, id] of Object.entries(et)) {
    if (!identifiantValide(nom) || !identifiantValide(id)) return null
    etiquettes[nom] = id
  }

  const couples: Array<{ ex: string; nom: string }> = []
  const compte = new Map<string, number>()
  for (const c of o.couples as unknown[]) {
    if (typeof c !== 'object' || c === null || Array.isArray(c)) return null
    const { ex, nom } = c as Record<string, unknown>
    if (!identifiantValide(ex) || !identifiantValide(nom)) return null
    const n = (compte.get(ex) ?? 0) + 1
    if (n > COUPLES_MAX_PAR_EXEMPLAIRE) return null
    compte.set(ex, n)
    couples.push({ ex, nom })
  }
  return { version: VERSION_REGISTRE, etiquettes, couples }
}
