/**
 * Tri des étiquettes du site selon leur origine : posées par l’extension ou préexistantes.
 *
 * Logique pure : aucune écriture, aucune requête, aucun `chrome.*`. Une étiquette est
 * « de l’extension » si elle figure au registre (créée par l’extension), si son nom suit un
 * préfixe du plan (« Statut · », « #À échanger ») ou si le plan l’attend pour une carte.
 * Toute autre étiquette lue sur une carte est « préexistante ». Seules les étiquettes portées
 * par au moins une carte lue sont connues : une étiquette sans carte n’est pas vue.
 */
import type { Registre } from './actions'
import type { Carte } from './collection'
import { etiquettesDeCarte, type Config } from './lot'

/** Étiquette du compte lue sur le site (`my-collection/stats`, `tagOptions`). */
export interface EtiquetteSite {
  id: string
  nom: string
  nbCartes: number
}

export interface EtiquetteSiteTriee extends EtiquetteSite {
  origine: 'extension' | 'preexistante'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_ETIQUETTES_SITE = 500

/** Valide la liste stockée ; `null` si la forme est inattendue. */
export function validerEtiquettesSite(brut: unknown): EtiquetteSite[] | null {
  if (!Array.isArray(brut) || brut.length > MAX_ETIQUETTES_SITE) return null
  const vus = new Set<string>()
  const liste: EtiquetteSite[] = []
  for (const e of brut as unknown[]) {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return null
    const { id, nom, nbCartes } = e as Record<string, unknown>
    if (typeof id !== 'string' || !UUID.test(id) || vus.has(id)) return null
    if (typeof nom !== 'string' || nom.length === 0 || nom.length > 200) return null
    if (typeof nbCartes !== 'number' || !Number.isSafeInteger(nbCartes) || nbCartes < 0) return null
    vus.add(id)
    liste.push({ id, nom, nbCartes })
  }
  return liste
}

/**
 * Trie la liste complète des étiquettes du compte (cartes sans étiquette comprises). Une étiquette est
 * « de l’extension » si elle est au registre (par identifiant ou par nom), suit un préfixe du plan ou est
 * attendue par le plan pour une carte ; toute autre est « préexistante ». Aucune suppression ici.
 */
export function trierEtiquettesSite(
  site: readonly EtiquetteSite[],
  cartes: readonly Carte[],
  registre: Registre,
  config?: Pick<Config, 'amis' | 'limiteParExemplaire'>,
): EtiquetteSiteTriee[] {
  const prevues = new Set<string>()
  for (const c of cartes) for (const nom of etiquettesDeCarte(c, config).retenues) prevues.add(nom)
  const idsRegistre = new Set(Object.values(registre.etiquettes))
  return site
    .map((e): EtiquetteSiteTriee => {
      const deLExtension =
        idsRegistre.has(e.id) ||
        Object.prototype.hasOwnProperty.call(registre.etiquettes, e.nom) ||
        prevues.has(e.nom) ||
        PREFIXES_PLAN.some((p) => e.nom.startsWith(p))
      return { ...e, origine: deLExtension ? 'extension' : 'preexistante' }
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

const PREFIXES_PLAN = ['Statut · ', '#À échanger ']

export interface EtiquetteTriee {
  nom: string
  /** Nombre de cartes lues qui portent l’étiquette. */
  nbCartes: number
}

export interface TriEtiquettes {
  extension: EtiquetteTriee[]
  preexistantes: EtiquetteTriee[]
}

const parNom = (a: EtiquetteTriee, b: EtiquetteTriee): number => a.nom.localeCompare(b.nom, 'fr')

export function trierEtiquettes(
  cartes: readonly Carte[],
  registre: Registre,
  config?: Pick<Config, 'amis' | 'limiteParExemplaire'>,
): TriEtiquettes {
  const prevues = new Set<string>()
  for (const c of cartes) for (const nom of etiquettesDeCarte(c, config).retenues) prevues.add(nom)

  const comptes = new Map<string, number>()
  for (const c of cartes) {
    if (c.idsSite === null) continue
    for (const nom of new Set(c.etiquettesSite)) comptes.set(nom, (comptes.get(nom) ?? 0) + 1)
  }

  const extension: EtiquetteTriee[] = []
  const preexistantes: EtiquetteTriee[] = []
  for (const [nom, nbCartes] of comptes) {
    const deLExtension =
      Object.prototype.hasOwnProperty.call(registre.etiquettes, nom) ||
      prevues.has(nom) ||
      PREFIXES_PLAN.some((p) => nom.startsWith(p))
    ;(deLExtension ? extension : preexistantes).push({ nom, nbCartes })
  }
  return { extension: extension.sort(parNom), preexistantes: preexistantes.sort(parNom) }
}
