/**
 * Revérification d’une action juste avant sa requête, et application locale de son résultat.
 *
 * Logique pure, sans `chrome.*`. L’aperçu est figé (H24) : la revérification rattrape
 * les modifications faites ensuite, et l’état local ne bouge qu’après un succès.
 */
import type { Action, Registre, ResultatAction } from './actions'
import {
  appliquerEdition,
  retirerCarte,
  retirerIdSite,
  type Carte,
  type Collection,
} from './collection'
import { exemplairesAttendus, type Config } from './lot'
import { enregistrerEtiquette, poserCouple, purgerCarte, purgerExemplaire, retirerCouple } from './registre'
import { prixDepart, valeurDeCarte } from './tri'

/** Résultat d’une action, avec l’identifiant d’étiquette renvoyé par une création réussie. */
export type ResultatApplicable = ResultatAction & { idEtiquette?: string }

export interface EtatLocal {
  collection: Collection
  registre: Registre
}

/** Prix de départ courant (H4) : `prixCible` s’il est renseigné, sinon la matrice. */
function prixCourant(carte: Carte): number | null {
  if (carte.prixCible !== null) return carte.prixCible
  const valeur = valeurDeCarte(carte)
  return valeur === null ? null : prixDepart(valeur)
}

/**
 * Juge la cohérence de l’action avec l’état ACTUEL, et non le changement depuis l’aperçu :
 * une carte modifiée puis remise dans l’état d’origine reste « ok ».
 * « passee » si la carte n’existe plus, est devenue favori, a changé de statut,
 * de prix de départ ou d’ami, ou si l’exemplaire visé n’est plus dans son `idsSite`.
 */
export function reverifierAction(
  action: Action,
  collection: Collection,
  registre: Registre,
  // Réservé : les réglages du lot ne changent aucune règle de revérification pour l’instant.
  config: Config,
): 'ok' | 'passee' {
  void config
  if (action.type === 'lecture') return 'ok'
  const carte = collection.cartes.find((c) => c.id === action.idCarte)
  if (!carte || carte.favori) return 'passee'

  switch (action.type) {
    case 'enchere':
      if (carte.statut !== 'vendre' || !carte.idsSite?.includes(action.idExemplaire)) return 'passee'
      return prixCourant(carte) === action.prix ? 'ok' : 'passee'
    case 'defausse':
      if (carte.statut !== 'defausser' || carte.quantite < 1) return 'passee'
      return carte.idsSite?.includes(action.idExemplaire) ? 'ok' : 'passee'
    case 'creation-etiquette':
      return exemplairesAttendus(carte).some((e) => e.etiquettes.includes(action.nomEtiquette)) ? 'ok' : 'passee'
    case 'pose-etiquette': {
      const attendu = exemplairesAttendus(carte).find((e) => e.idExemplaire === action.idExemplaire)
      return attendu?.etiquettes.includes(action.nomEtiquette) ? 'ok' : 'passee'
    }
    case 'retrait-etiquette': {
      const attendu = exemplairesAttendus(carte).find((e) => e.idExemplaire === action.idExemplaire)
      if (!attendu || attendu.etiquettes.includes(action.nomEtiquette)) return 'passee'
      const pose = registre.couples.some((c) => c.ex === action.idExemplaire && c.nom === action.nomEtiquette)
      return pose ? 'ok' : 'passee'
    }
  }
}

/** Applique un résultat. Hors succès, ou si rien ne change, les mêmes références sont rendues. */
export function appliquerResultat(
  collection: Collection,
  registre: Registre,
  action: Action,
  resultat: ResultatApplicable,
): EtatLocal {
  if (resultat.classe !== 'reussie') return { collection, registre }
  const carte = collection.cartes.find((c) => c.id === action.idCarte)

  switch (action.type) {
    case 'lecture':
      return { collection, registre }
    case 'enchere':
      if (!carte) return { collection, registre }
      return { collection: appliquerEdition(collection, carte.id, { statut: 'en-vente' }), registre }
    case 'defausse': {
      if (!carte) return { collection, registre }
      const quantite = Math.max(0, carte.quantite - 1)
      if (quantite === 0) {
        return {
          collection: retirerCarte(collection, carte.id),
          registre: purgerCarte(registre, [...(carte.idsSite ?? []), action.idExemplaire]),
        }
      }
      const sansId = retirerIdSite(collection, carte.id, action.idExemplaire)
      return {
        collection: {
          ...sansId,
          cartes: sansId.cartes.map((c) => (c.id === carte.id ? { ...c, quantite } : c)),
        },
        registre: purgerExemplaire(registre, action.idExemplaire),
      }
    }
    case 'creation-etiquette': {
      if (!resultat.idEtiquette) return { collection, registre }
      return { collection, registre: enregistrerEtiquette(registre, action.nomEtiquette, resultat.idEtiquette) }
    }
    case 'pose-etiquette':
      return { collection, registre: poserCouple(registre, action.idExemplaire, action.nomEtiquette) }
    case 'retrait-etiquette':
      return { collection, registre: retirerCouple(registre, action.idExemplaire, action.nomEtiquette) }
  }
}
