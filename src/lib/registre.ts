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

const MAX_REFUS = 20_000

/** Vrai si le joueur a retiré cette étiquette de cet exemplaire à la main : elle n’est plus reposée. */
export const estRefuse = (r: Registre, idExemplaire: string, nom: string): boolean => (r.refus ?? []).some((x) => x.ex === idExemplaire && x.nom === nom)

/** Mémorise un retrait voulu par le joueur : la synchro ne repose pas l’étiquette, même si elle reste attendue. */
export function refuserCouple(r: Registre, idExemplaire: string, nom: string): Registre {
  if (!identifiantValide(idExemplaire) || !identifiantValide(nom) || estRefuse(r, idExemplaire, nom)) return r
  const refus = r.refus ?? []
  if (refus.length >= MAX_REFUS) return r
  return { ...r, refus: [...refus, { ex: idExemplaire, nom }] }
}

/** Oublie une étiquette supprimée du site : son nom et tous ses couples. */
export function supprimerEtiquetteDuRegistre(r: Registre, nom: string): Registre {
  const etiquettes = tableVide()
  for (const [cle, id] of Object.entries(r.etiquettes)) if (cle !== nom) etiquettes[cle] = id
  return { ...r, etiquettes, couples: r.couples.filter((c) => c.nom !== nom), ...(r.refus ? { refus: r.refus.filter((x) => x.nom !== nom) } : {}) }
}

/** Étiquette du compte telle que le site la liste (identifiant et nom). */
export interface EtiquetteDuSite {
  id: string
  nom: string
}

export interface ReconciliationSite {
  registre: Registre
  /** Couples (exemplaire, nom) perdus parce que leur étiquette a disparu du site : à reposer après recréation. */
  perdus: Array<{ ex: string; nom: string }>
  /** Noms d’étiquettes du registre absents du site (supprimées par erreur) : à recréer. */
  manquantes: string[]
}

/**
 * Aligne le registre sur la liste d’étiquettes réellement présente sur le site (Alexis, 2026-11-23 : thèmes supprimés par
 * erreur). Une étiquette du registre dont l’identifiant a disparu du site est oubliée avec ses couples, qui sont rendus
 * pour être reposés ; si le site en porte une du même nom sous un autre identifiant (recréée à la main), le registre
 * reprend cet identifiant et ses couples sont reposés aussi (la suppression emporte les poses). Les retraits voulus par le
 * joueur (`refus`) sont conservés : une étiquette recréée n’est pas reposée là où il l’avait retirée.
 * Sans liste fiable (`null` ou vide), le registre est rendu tel quel. Ne modifie jamais l’entrée.
 */
export function reconcilierAvecSite(r: Registre, site: readonly EtiquetteDuSite[] | null): ReconciliationSite {
  // Liste vide alors que le registre connaît des étiquettes : le site renvoie `tagOptions: []` dans ses réponses allégées, ce
  // n'est pas la preuve que tout a disparu (recréer en masse ferait des doublons) : registre inchangé.
  if (site === null || (site.length === 0 && Object.keys(r.etiquettes).length > 0)) return { registre: r, perdus: [], manquantes: [] }
  const idsSite = new Set(site.map((e) => e.id))
  const idParNom = new Map<string, string>()
  for (const e of site) if (!idParNom.has(e.nom)) idParNom.set(e.nom, e.id)

  const etiquettes = tableVide()
  const perdues = new Set<string>()
  const manquantes: string[] = []
  for (const [nom, id] of Object.entries(r.etiquettes)) {
    if (idsSite.has(id)) {
      etiquettes[nom] = id
      continue
    }
    perdues.add(nom)
    const autre = idParNom.get(nom)
    if (autre !== undefined) etiquettes[nom] = autre
    else manquantes.push(nom)
  }
  if (perdues.size === 0) return { registre: r, perdus: [], manquantes: [] }
  const perdus = r.couples.filter((c) => perdues.has(c.nom)).map((c) => ({ ex: c.ex, nom: c.nom }))
  return {
    registre: { ...r, etiquettes, couples: r.couples.filter((c) => !perdues.has(c.nom)) },
    perdus,
    manquantes,
  }
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
  return { ...r, couples: r.couples.filter((c) => c.ex !== idExemplaire), ...(r.refus ? { refus: r.refus.filter((x) => x.ex !== idExemplaire) } : {}) }
}

export function purgerCarte(r: Registre, idsExemplaires: readonly string[]): Registre {
  const ids = new Set(idsExemplaires)
  return { ...r, couples: r.couples.filter((c) => !ids.has(c.ex)), ...(r.refus ? { refus: r.refus.filter((x) => !ids.has(x.ex)) } : {}) }
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
  // Retraits voulus par le joueur : champ facultatif, une entrée illisible est ignorée sans invalider le registre.
  const refus: Array<{ ex: string; nom: string }> = []
  if (Array.isArray(o.refus)) {
    const deja = new Set<string>()
    for (const c of o.refus.slice(0, MAX_REFUS) as unknown[]) {
      if (typeof c !== 'object' || c === null || Array.isArray(c)) continue
      const { ex, nom } = c as Record<string, unknown>
      if (!identifiantValide(ex) || !identifiantValide(nom)) continue
      const cle = JSON.stringify([ex, nom])
      if (deja.has(cle)) continue
      deja.add(cle)
      refus.push({ ex, nom })
    }
  }
  return { version: VERSION_REGISTRE, etiquettes, couples, ...(refus.length > 0 ? { refus } : {}) }
}

/**
 * Ajoute à une pose ou un retrait l'identifiant d'étiquette du site, lu dans le registre.
 * `null` si le nom n'y figure pas (l'action n'est alors pas émise). Clés héritées du prototype ignorées.
 */
export function avecIdEtiquette<T extends { nomEtiquette: string }>(action: T, registre: Registre): (T & { idEtiquette: string }) | null {
  if (!Object.prototype.hasOwnProperty.call(registre.etiquettes, action.nomEtiquette)) return null
  const id = registre.etiquettes[action.nomEtiquette]
  return typeof id === 'string' && id !== '' ? { ...action, idEtiquette: id } : null
}
