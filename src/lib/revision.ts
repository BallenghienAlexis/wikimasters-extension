/**
 * Revérification d’une action juste avant sa requête, et application locale de son résultat.
 *
 * Logique pure, sans `chrome.*`. L’aperçu est figé (H24) : la revérification rattrape
 * les modifications faites ensuite, et l’état local ne bouge qu’après un succès.
 */
import { CODES_CARTE_INDISPONIBLE, type Action, type Registre, type ResultatAction } from './actions'
import {
  aEditionLocale,
  retirerCarte,
  retirerIdSite,
  type Collection,
} from './collection'
import { exemplairesAttendus, type Config } from './lot'
import { enregistrerEtiquette, poserCouple, purgerCarte, purgerExemplaire, retirerCouple, supprimerEtiquetteDuRegistre } from './registre'

/** Résultat d’une action, avec l’identifiant d’étiquette renvoyé par une création réussie. */
export type ResultatApplicable = ResultatAction & { idEtiquette?: string }

export interface EtatLocal {
  collection: Collection
  registre: Registre
}

/**
 * Juge la cohérence de l’action avec l’état ACTUEL, et non le changement depuis l’aperçu :
 * une carte modifiée puis remise dans l’état d’origine reste « ok ».
 * « passee » si la carte n’existe plus, est devenue favori, a changé d’ami, ou si l’exemplaire visé n’est plus dans son `idsSite`.
 */
export function reverifierAction(
  action: Action,
  collection: Collection,
  registre: Registre,
  // Amis et limites du site : l’étiquette doit être attendue selon la même `Config` que le lot (H12).
  config: Config,
): 'ok' | 'passee' {
  // Suppression d’étiquette : hors carte, validée par la liste que le joueur a confirmée.
  if (action.type === 'lecture' || action.type === 'suppression-etiquette') return 'ok'
  const carte = collection.cartes.find((c) => c.id === action.idCarte)
  if (!carte) return 'passee'

  switch (action.type) {
    // Sans statut (2026-11-14), aucun lot ne produit d’enchère ni de défausse : un ordre ancien est toujours passé.
    case 'enchere':
    case 'defausse':
      return 'passee'
    case 'creation-etiquette':
      return exemplairesAttendus(carte, config).some((e) => e.etiquettes.includes(action.nomEtiquette)) ? 'ok' : 'passee'
    case 'pose-etiquette': {
      const attendu = exemplairesAttendus(carte, config).find((e) => e.idExemplaire === action.idExemplaire)
      return attendu?.etiquettes.includes(action.nomEtiquette) ? 'ok' : 'passee'
    }
    case 'retrait-etiquette': {
      const attendu = exemplairesAttendus(carte, config).find((e) => e.idExemplaire === action.idExemplaire)
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
  if (resultat.classe === 'echec' && resultat.codeHttp !== null && CODES_CARTE_INDISPONIBLE.includes(resultat.codeHttp)) {
    return appliquerIndisponible(collection, registre, action)
  }
  if (resultat.classe !== 'reussie') return { collection, registre }
  const carte = collection.cartes.find((c) => c.id === action.idCarte)

  switch (action.type) {
    case 'lecture':
      return { collection, registre }
    case 'suppression-etiquette':
      return { collection, registre: supprimerEtiquetteDuRegistre(registre, action.nomEtiquette) }
    case 'enchere':
      return { collection, registre }
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

/**
 * Le site a refusé (403, 404) une action sur un exemplaire : il n’est plus dans la collection (vendu, défaussé,
 * échangé ou aux enchères). On le retire du local comme une défausse réussie : identifiant d’exemplaire oublié,
 * quantité diminuée ; le registre d’étiquettes n’est jamais touché ; à zéro, la carte disparaît si elle n’a aucune édition locale, sinon elle
 * est gardée mais déliée du site (`idsSite` nul). Actions sans exemplaire : rien.
 */
export function appliquerIndisponible(collection: Collection, registre: Registre, action: Action): EtatLocal {
  if (action.type !== 'pose-etiquette' && action.type !== 'retrait-etiquette' && action.type !== 'enchere' && action.type !== 'defausse') {
    return { collection, registre }
  }
  const carte = collection.cartes.find((c) => c.id === action.idCarte)
  if (!carte || !carte.idsSite?.includes(action.idExemplaire)) return { collection, registre }
  // Le registre n’est jamais vidé sur un simple refus : un faux positif (session refusée) ferait perdre la trace des
  // étiquettes posées, seules retirables. Un couple périmé est inoffensif (un retrait sur un identifiant périmé répond 204).
  const sansId = retirerIdSite(collection, carte.id, action.idExemplaire)
  const quantite = Math.max(0, carte.quantite - 1)
  if (quantite === 0 && !aEditionLocale(carte)) {
    return { collection: retirerCarte(sansId, carte.id), registre }
  }
  return {
    collection: {
      ...sansId,
      cartes: sansId.cartes.map((c) =>
        c.id === carte.id ? { ...c, quantite, ...(quantite === 0 ? { idsSite: null, etiquettesSite: [] } : {}) } : c,
      ),
    },
    registre,
  }
}
