/**
 * Écarts entre les étiquettes attendues d’une carte et celles lues sur le site.
 *
 * Logique pure : aucune écriture, aucun `chrome.*`, aucune requête. Les étiquettes attendues
 * viennent de `etiquettesDeCarte` (Statut · …, #À échanger …, thèmes) ; les étiquettes du site
 * sont `Carte.etiquettesSite`. Une carte non reliée est ignorée : rien n’y serait posé.
 */
import type { Carte } from './collection'
import { etiquettesDeCarte, type Config } from './lot'

export interface EcartCarte {
  idCarte: string
  titre: string
  /** Attendues mais absentes du site. */
  manquantes: string[]
  /** Présentes sur le site mais non attendues. */
  enTrop: string[]
}

export function calculerEcarts(
  cartes: readonly Carte[],
  config?: Pick<Config, 'amis' | 'limiteParExemplaire'>,
): EcartCarte[] {
  const ecarts: EcartCarte[] = []
  for (const c of cartes) {
    if (c.idsSite === null) continue
    const attendues = etiquettesDeCarte(c, config).retenues
    const surSite = new Set(c.etiquettesSite)
    const prevues = new Set(attendues)
    const manquantes = attendues.filter((nom) => !surSite.has(nom))
    const enTrop = [...surSite].filter((nom) => !prevues.has(nom))
    if (manquantes.length > 0 || enTrop.length > 0) {
      ecarts.push({ idCarte: c.id, titre: c.titre, manquantes, enTrop })
    }
  }
  return ecarts
}
