/**
 * Aperçu des étiquettes prévues : regroupement par nom, totaux et durée.
 *
 * Fonction pure : aucun accès au navigateur ni au site. Le calcul repose sur le
 * lot construit comme si tous les types d’action étaient disponibles : le volume est visible
 * avant l’envoi, même quand les types d’étiquette ne sont pas encore disponibles (G5).
 */
import type { Registre, TypeAction } from './actions'
import { TYPES_ACTION } from './actions'
import type { Collection } from './collection'
import { construireLot, etiquettesDeCarte, type Config, type EtiquetteNonPosee } from './lot'
import { DEFINITIONS_THEMES, LIBELLES_THEMES } from './themes'

/** Secondes par écriture d’étiquette en moyenne : 0,2 s minimale plus un supplément de 0 à 0,1 s. */
const SECONDES_PAR_REQUETE = 0.25

/** Nombre maximal de lignes rendues par l’aperçu (DT-05). */
export const LIGNES_MAX = 100

const PREFIXE_STATUT = 'Statut · '
const PREFIXE_ECHANGE = '#À échanger '

export type GenreEtiquette = 'statut' | 'echange' | 'theme'

export interface LigneEtiquette {
  nom: string
  /** Cartes concernées. */
  cartes: number
  /** Exemplaires reliés concernés. */
  exemplaires: number
  /** Le nom est absent du registre : l’étiquette serait à créer. */
  nouvelle: boolean
  genre: GenreEtiquette
}

export interface TotauxEtiquettes {
  /** Poses prévues (hors étiquettes déjà posées par l’extension). */
  poses: number
  themes: number
  echanges: number
  /** Noms à créer. */
  nomsNouveaux: number
  /** Retraits d’étiquettes de l’extension qui ne sont plus attendues (H11). */
  retraits: number
  /** Créations, retraits et poses : une requête chacune. */
  requetes: number
  minutes: number
}

export interface ApercuEtiquettes {
  /** Au plus `LIGNES_MAX` lignes. */
  lignes: LigneEtiquette[]
  /** Lignes non affichées au-delà de `LIGNES_MAX`. */
  restantes: number
  totaux: TotauxEtiquettes
  nonPosees: EtiquetteNonPosee[]
}

export const dureeMinutesApercu = (nbRequetes: number): number => Math.ceil((nbRequetes * SECONDES_PAR_REQUETE) / 60)

/** « 45 min » jusqu’à une heure, « 1 h 5 min » au-delà. */
export function texteDureeLongue(minutes: number): string {
  if (minutes <= 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

const genreDe = (nom: string): GenreEtiquette =>
  nom.startsWith(PREFIXE_STATUT) ? 'statut' : nom.startsWith(PREFIXE_ECHANGE) ? 'echange' : 'theme'

const ORDRE_GENRE: Record<GenreEtiquette, number> = { statut: 0, echange: 1, theme: 2 }

const ANCETRES_PAR_LIBELLE = new Map(DEFINITIONS_THEMES.map((t) => [LIBELLES_THEMES[t.id] ?? t.id, t.parents?.length ?? 0]))

const TOUS_TYPES: ReadonlySet<TypeAction> = new Set(TYPES_ACTION)

export function regrouperEtiquettes(collection: Collection, registre: Registre, config: Config): ApercuEtiquettes {
  const lot = construireLot(collection, registre, config, TOUS_TYPES)
  const ecartees = new Set(
    lot.ecartees.filter((e) => e.raison === 'non-reliee' || e.raison === 'identifiant-en-conflit').map((e) => e.idCarte),
  )
  const nonPosee = new Set(lot.nonPosees.map((n) => `${n.idCarte}\u0000${n.nomEtiquette}`))

  const groupes = new Map<string, { cartes: number; exemplaires: number }>()
  for (const c of collection.cartes) {
    if (ecartees.has(c.id) || !c.idsSite || c.idsSite.length === 0) continue
    for (const nom of etiquettesDeCarte(c, config).retenues) {
      if (nonPosee.has(`${c.id}\u0000${nom}`)) continue
      const g = groupes.get(nom)
      if (g) {
        g.cartes += 1
        g.exemplaires += c.idsSite.length
      } else {
        groupes.set(nom, { cartes: 1, exemplaires: c.idsSite.length })
      }
    }
  }

  const toutes: LigneEtiquette[] = [...groupes.entries()].map(([nom, g]) => ({
    nom,
    cartes: g.cartes,
    exemplaires: g.exemplaires,
    nouvelle: !Object.prototype.hasOwnProperty.call(registre.etiquettes, nom),
    genre: genreDe(nom),
  }))
  toutes.sort((a, b) => {
    if (a.genre !== b.genre) return ORDRE_GENRE[a.genre] - ORDRE_GENRE[b.genre]
    if (a.genre === 'theme') {
      const d = (ANCETRES_PAR_LIBELLE.get(b.nom) ?? 0) - (ANCETRES_PAR_LIBELLE.get(a.nom) ?? 0)
      if (d !== 0) return d
    }
    return a.nom.localeCompare(b.nom, 'fr')
  })

  const poses = lot.actions.filter((a) => a.type === 'pose-etiquette')
  const creations = lot.actions.filter((a) => a.type === 'creation-etiquette').length
  const retraits = lot.actions.filter((a) => a.type === 'retrait-etiquette').length
  const requetes = poses.length + creations + retraits
  const nomPose = (a: (typeof poses)[number]): string => (a.type === 'pose-etiquette' ? a.nomEtiquette : '')

  return {
    lignes: toutes.slice(0, LIGNES_MAX),
    restantes: Math.max(0, toutes.length - LIGNES_MAX),
    totaux: {
      poses: poses.length,
      themes: poses.filter((a) => genreDe(nomPose(a)) === 'theme').length,
      echanges: poses.filter((a) => genreDe(nomPose(a)) === 'echange').length,
      nomsNouveaux: creations,
      retraits,
      requetes,
      minutes: dureeMinutesApercu(requetes),
    },
    nonPosees: lot.nonPosees,
  }
}
