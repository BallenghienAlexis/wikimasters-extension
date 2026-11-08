/**
 * Construction du lot de la synchronisation : ce qui sera envoyé au site.
 *
 * Fonction pure : aucun accès à `chrome.*`, aucun appel à l’assistant de tri
 * (le statut stocké décide, SC-005), aucune mutation des entrées. Une erreur ici
 * a des effets définitifs sur le site : les garde-fous priment sur tout le reste.
 */
import type {
  Action,
  CarteEcartee,
  Lot,
  RaisonEcart,
  Registre,
  TypeAction,
  TypesDisponibles,
} from './actions'
import { LIBELLES_STATUT, type Carte, type Collection, type Statut } from './collection'
import { prixDepart } from './tri'

/** Réglages du lot. */
export interface Config {
  /** Limite d’enchères simultanées (lue par la construction des enchères, T-012). */
  maxVentesSimultanees: number
  /** Longueur maximale d’un nom d’étiquette ; `null` = inconnue (aucune limite appliquée). */
  longueurMaxEtiquette: number | null
  /** Noms d’étiquettes déjà connus sur le site (dont ceux du joueur). */
  nomsExistants: readonly string[]
  /**
   * Le lien `card_id` ↔ `user_card_id` est relevé : l’enchère peut viser un exemplaire (H45).
   * Absent ou `false` : le type « enchère » reste non disponible.
   */
  lienCardId?: boolean
}

/** Étiquette de l’extension encore posée sur une carte favori ou à trier (H18). */
export interface EtiquetteObsolete {
  idCarte: string
  titre: string
  idExemplaire: string
  nomEtiquette: string
}

/** Lot construit, avec les étiquettes obsolètes conservées à signaler dans l’aperçu. */
export interface LotConstruit extends Lot {
  obsoletes: EtiquetteObsolete[]
}

export interface ExemplaireAttendu {
  idExemplaire: string
  /** Noms d’étiquettes attendus sur cet exemplaire. */
  etiquettes: string[]
}

const comparer = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const STATUTS_ETIQUETES = new Set<Statut>(['garder', 'echanger', 'vendre', 'en-vente'])

/**
 * Exemplaires reliés d’une carte et étiquettes attendues sur chacun.
 * Vide pour un favori, une carte à trier ou à défausser, ou non reliée.
 */
export function exemplairesAttendus(carte: Carte): ExemplaireAttendu[] {
  if (carte.favori || !STATUTS_ETIQUETES.has(carte.statut) || !carte.idsSite) return []
  const etiquettes = [`Statut · ${LIBELLES_STATUT[carte.statut]}`]
  const ami = carte.statut === 'echanger' ? (carte.ami ?? '').trim() : ''
  if (ami !== '') etiquettes.push(`Ami · ${ami}`)
  return carte.idsSite.map((idExemplaire) => ({ idExemplaire, etiquettes: [...etiquettes] }))
}

/**
 * Enchères du lot : `candidates` = cartes `vendre` reliées, sans conflit (les autres sont
 * déjà écartées par `construireLot`). Une enchère par carte, sur le premier exemplaire de
 * `idsSite`, dans la limite des places libres. Une enchère est définitive côté site.
 */
export function construireEncheres(
  candidates: readonly Carte[],
  enVente: number,
  config: Config,
  disponibles: TypesDisponibles,
): { actions: Action[]; ecartees: CarteEcartee[] } {
  const ecartees: CarteEcartee[] = []
  const valides: Array<{ carte: Carte; prix: number; valeur: number; idExemplaire: string }> = []
  const autorisee = config.lienCardId === true && disponibles.has('enchere')

  for (const c of candidates) {
    // Garde-fou propre : jamais d’enchère sur un favori ou une carte qui n’est pas à vendre.
    if (c.favori || c.statut !== 'vendre') continue
    const ecarter = (raison: RaisonEcart): void => {
      ecartees.push({ idCarte: c.id, titre: c.titre, raison })
    }
    const valeur = c.valeurMarchande
    if (valeur === null) {
      ecarter('valeur-absente')
      continue
    }
    const prix = c.prixCible ?? prixDepart(valeur)
    if (prix === null || !Number.isSafeInteger(prix) || prix < 1) {
      ecarter('prix-invalide')
      continue
    }
    if (prix >= valeur) {
      ecarter('prix-superieur-valeur')
      continue
    }
    const idExemplaire = c.idsSite?.[0]
    if (idExemplaire === undefined) {
      ecarter('non-reliee')
      continue
    }
    if (!autorisee) {
      ecarter('action-non-disponible')
      continue
    }
    valides.push({ carte: c, prix, valeur, idExemplaire })
  }

  valides.sort((a, b) => b.prix - a.prix || b.valeur - a.valeur || comparer(a.carte.id, b.carte.id))
  const places = Math.max(0, Math.floor(config.maxVentesSimultanees - enVente))
  const actions: Action[] = []
  valides.forEach(({ carte, prix, idExemplaire }, rang) => {
    if (rang < places) actions.push({ type: 'enchere', idCarte: carte.id, idExemplaire, prix })
    else ecartees.push({ idCarte: carte.id, titre: carte.titre, raison: 'en-attente-place' })
  })
  return { actions, ecartees }
}

/** Construit le lot. Les cartes sont traitées par `id` croissant (H9). */
export function construireLot(
  collection: Collection,
  registre: Registre,
  config: Config,
  disponibles: TypesDisponibles,
): LotConstruit {
  const cartes = [...collection.cartes].sort((a, b) => comparer(a.id, b.id))

  // Identifiants d’exemplaire présents dans plus d’une carte (H47).
  const proprietaires = new Map<string, number>()
  for (const c of cartes) for (const id of c.idsSite ?? []) proprietaires.set(id, (proprietaires.get(id) ?? 0) + 1)

  const couplesParExemplaire = new Map<string, string[]>()
  for (const c of registre.couples) {
    const l = couplesParExemplaire.get(c.ex)
    if (l) l.push(c.nom)
    else couplesParExemplaire.set(c.ex, [c.nom])
  }
  const connus = new Set(config.nomsExistants)
  const limite = config.longueurMaxEtiquette

  const creations: Action[] = []
  const retraits: Action[] = []
  const poses: Action[] = []
  const defausses: Action[] = []
  const ecartees: CarteEcartee[] = []
  const obsoletes: EtiquetteObsolete[] = []
  const creesCeLot = new Set<string>()
  const aVendre: Carte[] = []
  let enVente = 0

  const dispo = (t: TypeAction): boolean => disponibles.has(t)

  for (const c of cartes) {
    if (c.statut === 'en-vente') enVente++
    const ecarter = (raison: RaisonEcart): void => {
      ecartees.push({ idCarte: c.id, titre: c.titre, raison })
    }

    // Garde-fous : favori et « à trier » ne produisent jamais d’action (SC-003, SC-004).
    if (c.favori || c.statut === 'a-trier') {
      for (const id of c.idsSite ?? []) {
        for (const nom of couplesParExemplaire.get(id) ?? []) {
          obsoletes.push({ idCarte: c.id, titre: c.titre, idExemplaire: id, nomEtiquette: nom })
        }
      }
      continue
    }

    if (c.idsSite === null) {
      ecarter('non-reliee')
      continue
    }
    if (c.idsSite.some((id) => (proprietaires.get(id) ?? 0) > 1)) {
      ecarter('identifiant-en-conflit')
      continue
    }

    if (c.statut === 'defausser') {
      // Aucun retrait d’étiquette avant défausse (H19).
      const ids = c.idsSite.slice(0, Math.max(0, c.quantite))
      if (ids.length > 0) {
        if (dispo('defausse')) {
          for (const idExemplaire of ids) defausses.push({ type: 'defausse', idCarte: c.id, idExemplaire })
        } else {
          ecarter('action-non-disponible')
        }
      }
      if (c.quantite > c.idsSite.length) ecarter('exemplaires-non-relies')
      continue
    }

    if (c.statut === 'vendre') aVendre.push(c)

    // Étiquettes (SC-007).
    let nonDispo = false
    let tropLong = false
    let homonyme = false
    const attendus = exemplairesAttendus(c)

    for (const { idExemplaire, etiquettes } of attendus) {
      const attendu = new Set(etiquettes)
      const presents = couplesParExemplaire.get(idExemplaire) ?? []

      for (const nom of presents) {
        if (attendu.has(nom)) continue
        if (dispo('retrait-etiquette')) retraits.push({ type: 'retrait-etiquette', idCarte: c.id, idExemplaire, nomEtiquette: nom })
        else nonDispo = true
      }

      for (const nom of etiquettes) {
        if (presents.includes(nom)) continue
        if (limite !== null && nom.length > limite) {
          tropLong = true
          continue
        }
        const connue = Object.prototype.hasOwnProperty.call(registre.etiquettes, nom)
        if (!connue && connus.has(nom)) {
          homonyme = true
          continue
        }
        if (!connue) {
          if (!dispo('creation-etiquette') || !dispo('pose-etiquette')) {
            nonDispo = true
            continue
          }
          if (!creesCeLot.has(nom)) {
            creesCeLot.add(nom)
            creations.push({ type: 'creation-etiquette', idCarte: c.id, nomEtiquette: nom })
          }
        }
        if (dispo('pose-etiquette')) poses.push({ type: 'pose-etiquette', idCarte: c.id, idExemplaire, nomEtiquette: nom })
        else nonDispo = true
      }
    }

    if (tropLong) ecarter('nom-trop-long')
    if (homonyme) ecarter('homonyme')
    if (nonDispo) ecarter('action-non-disponible')
  }

  const encheres = construireEncheres(aVendre, enVente, config, disponibles)
  ecartees.push(...encheres.ecartees)

  // Une même raison n’est donnée qu’une fois par carte (ex. étiquettes et enchère indisponibles).
  const vues = new Set<string>()
  const ecarteesUniques = ecartees.filter((e) => {
    const cle = JSON.stringify([e.idCarte, e.raison])
    if (vues.has(cle)) return false
    vues.add(cle)
    return true
  })

  return {
    // Les actions `lecture` (SC-024) s’inséreront ici, avant les créations (H9).
    actions: [...creations, ...retraits, ...poses, ...encheres.actions, ...defausses],
    ecartees: ecarteesUniques,
    obsoletes,
  }
}
