/**
 * Réalignement du registre sur l’état réel du site (Alexis, 2026-11-24 : « 2680 étiquettes à créer alors que la plupart existent
 * déjà »). Le lot compare les étiquettes attendues au registre (ce que l’extension a posé) : un registre vide ou en retard (ancien
 * import entre PC, autre PC, stockage vidé) faisait proposer la création et la pose de tout, même de ce que le site porte déjà.
 *
 * Fonction pure, sans requête : la preuve est la liste d’étiquettes du site et les étiquettes lues sur chaque carte. Seules les
 * étiquettes **attendues** par les règles pour une carte (thèmes, échanges aux amis) sont reprises, jamais autre chose : une
 * étiquette posée à la main, « Statut · … », « #À classer » ou « #Autres » n’entrent jamais au registre. Hors mode `poser`,
 * rien n’est repris. Idempotente ; ne modifie jamais l’entrée ; n’écrit rien sur le site.
 */
import type { Registre } from './actions'
import type { Carte } from './collection'
import type { EtiquetteSite } from './etiquettesPreexistantes'
import { ETIQUETTE_A_CLASSER, exemplairesAttendus, type Config } from './lot'
import { cleNomEtiquette, enregistrerEtiquette, estRefuse, poserCouple } from './registre'

const NOMS_INTERDITS: ReadonlySet<string> = new Set([ETIQUETTE_A_CLASSER, '#Autres'])

export interface BilanAlignement {
  registre: Registre
  /** Étiquettes du site dont l’identifiant est entré au registre (le lot ne les recrée plus). */
  etiquettes: number
  /** Poses déjà présentes sur le site, notées au registre (le lot ne les repose plus). */
  couples: number
}

export function alignerRegistreSurSite(
  registre: Registre,
  cartes: readonly Carte[],
  site: readonly EtiquetteSite[] | null,
  config: Pick<Config, 'amis' | 'limiteParExemplaire' | 'mesThemes' | 'modeEtiquettes'>,
): BilanAlignement {
  const rien: BilanAlignement = { registre, etiquettes: 0, couples: 0 }
  if ((config.modeEtiquettes ?? 'poser') !== 'poser') return rien
  // Une liste absente ou vide n'est pas une preuve (réponse allégée possible du site).
  if (site === null || site.length === 0) return rien
  const idParNom = new Map<string, string>()
  for (const e of site) if (!idParNom.has(cleNomEtiquette(e.nom))) idParNom.set(cleNomEtiquette(e.nom), e.id)

  let r = registre
  let nbEtiquettes = 0
  let nbCouples = 0
  for (const c of cartes) {
    const sur = new Set(c.etiquettesSite.map(cleNomEtiquette))
    for (const { idExemplaire, etiquettes } of exemplairesAttendus(c, config)) {
      for (const nom of etiquettes) {
        if (NOMS_INTERDITS.has(nom)) continue
        const id = idParNom.get(cleNomEtiquette(nom))
        if (id === undefined) continue
        if (!Object.hasOwn(r.etiquettes, nom)) {
          const suivant = enregistrerEtiquette(r, nom, id)
          if (suivant === r) continue
          r = suivant
          nbEtiquettes += 1
        }
        if (!sur.has(cleNomEtiquette(nom)) || estRefuse(r, idExemplaire, nom)) continue
        const suivant = poserCouple(r, idExemplaire, nom)
        if (suivant !== r) nbCouples += 1
        r = suivant
      }
    }
  }
  return { registre: r, etiquettes: nbEtiquettes, couples: nbCouples }
}
