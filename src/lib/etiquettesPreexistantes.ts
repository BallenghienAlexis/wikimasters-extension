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
