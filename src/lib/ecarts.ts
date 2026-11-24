/**
 * Écarts entre les étiquettes attendues d’une carte et celles lues sur le site.
 *
 * Logique pure : aucune écriture, aucun `chrome.*`, aucune requête. Les étiquettes attendues
 * viennent de `etiquettesDeCarte` (Statut · …, #À échanger …, thèmes) ; les étiquettes du site
 * sont `Carte.etiquettesSite`. Une carte non reliée est ignorée : rien n’y serait posé.
 */
import type { Carte } from './collection'
import type { Registre } from './actions'
import { etiquettesDeCarte, type Config } from './lot'
import { cleNomEtiquette, estRefuse } from './registre'

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
  config?: Pick<Config, 'amis' | 'limiteParExemplaire' | 'mesThemes'>,
  /** Registre : une étiquette retirée à la main par le joueur n'est plus « manquante ». */
  registre?: Registre,
): EcartCarte[] {
  const ecarts: EcartCarte[] = []
  for (const c of cartes) {
    if (c.idsSite === null) continue
    const attendues = etiquettesDeCarte(c, config).retenues
    // Le site affiche (et peut stocker) « ##Nom » pour « #Nom » : comparaison tolérante (Alexis, 2026-11-24).
    const surSite = new Set(c.etiquettesSite.map(cleNomEtiquette))
    const prevues = new Set(attendues.map(cleNomEtiquette))
    const refusee = (nom: string): boolean => registre !== undefined && c.idsSite !== null && c.idsSite.some((ex) => estRefuse(registre, ex, nom))
    const manquantes = attendues.filter((nom) => !surSite.has(cleNomEtiquette(nom)) && !refusee(nom))
    const enTrop = [...new Set(c.etiquettesSite)].filter((nom) => !prevues.has(cleNomEtiquette(nom)))
    if (manquantes.length > 0 || enTrop.length > 0) {
      ecarts.push({ idCarte: c.id, titre: c.titre, manquantes, enTrop })
    }
  }
  return ecarts
}
