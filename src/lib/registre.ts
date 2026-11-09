/**
 * Registre des étiquettes posées par l’extension.
 *
 * Seul le registre autorise un retrait : l’extension ne touche jamais une
 * étiquette qu’elle n’a pas posée. Logique pure, sans `chrome.*` ; la
 * persistance relève de `stockage.ts`.
 */
import type { Registre } from './actions'

export const VERSION_REGISTRE = 2
/** Versions lisibles : la 1 est migrée en 2 sans perte (SC-013). */
const VERSIONS_LISIBLES: readonly unknown[] = [1, VERSION_REGISTRE]
/** Longueur maximale d’un identifiant ou d’un nom d’étiquette. */
export const LONGUEUR_MAX_ID = 200
/**
 * Borne de forme du registre stocké (H7) : elle ne sert qu'à rejeter une donnée corrompue.
 * La limite réelle du site est un réglage passé à `poserCouple`.
 */
export const COUPLES_MAX_PAR_EXEMPLAIRE = 256

function identifiantValide(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= LONGUEUR_MAX_ID
}

/** Table sans prototype : un nom comme `__proto__` ou `constructor` reste une simple clé. */
function tableVide(): Record<string, string> {
  return Object.create(null) as Record<string, string>
}

export function registreVide(): Registre {
  return { version: VERSION_REGISTRE, etiquettes: {}, couples: [] }
}

/** Mémorise l’identifiant d’une étiquette créée. Entrée invalide : registre inchangé. */
export function enregistrerEtiquette(r: Registre, nom: string, idEtiquette: string): Registre {
  if (!identifiantValide(nom) || !identifiantValide(idEtiquette)) return r
  const etiquettes = tableVide()
  for (const [cle, id] of Object.entries(r.etiquettes)) etiquettes[cle] = id
  etiquettes[nom] = idEtiquette
  return { ...r, etiquettes, couples: r.couples }
}

export function couplesDe(r: Registre, idExemplaire: string): Array<{ ex: string; nom: string }> {
  return r.couples.filter((c) => c.ex === idExemplaire).map((c) => ({ ex: c.ex, nom: c.nom }))
}

/**
 * Pose un couple. Refusé (registre inchangé) au-delà de `limite` couples pour l’exemplaire,
 * si la limite du site est connue ; sans limite (`null` ou absente), aucun plafond propre.
 */
export function poserCouple(r: Registre, idExemplaire: string, nom: string, limite: number | null = null): Registre {
  if (!identifiantValide(idExemplaire) || !identifiantValide(nom)) return r
  const existants = r.couples.filter((c) => c.ex === idExemplaire)
  if (existants.some((c) => c.nom === nom)) return r
  if (limite !== null && existants.length >= limite) return r
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
  if (!VERSIONS_LISIBLES.includes(o.version)) return null
  const et = o.etiquettes
  if (typeof et !== 'object' || et === null || Array.isArray(et)) return null
  if (!Array.isArray(o.couples)) return null

  const etiquettes = tableVide()
  for (const [nom, id] of Object.entries(et)) {
    if (!identifiantValide(nom) || !identifiantValide(id)) return null
    etiquettes[nom] = id
  }

  const couples: Array<{ ex: string; nom: string }> = []
  const compte = new Map<string, number>()
  const vus = new Set<string>()
  for (const c of o.couples as unknown[]) {
    if (typeof c !== 'object' || c === null || Array.isArray(c)) return null
    const { ex, nom } = c as Record<string, unknown>
    if (!identifiantValide(ex) || !identifiantValide(nom)) return null
    // Séparateur impossible dans un identifiant sérialisé : JSON.stringify de la paire.
    const cle = JSON.stringify([ex, nom])
    if (vus.has(cle)) return null
    vus.add(cle)
    const n = (compte.get(ex) ?? 0) + 1
    if (n > COUPLES_MAX_PAR_EXEMPLAIRE) return null
    compte.set(ex, n)
    couples.push({ ex, nom })
  }
  return { version: VERSION_REGISTRE, etiquettes, couples }
}
