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
import { LIBELLES_STATUT, normaliser, type Carte, type Collection, type Statut } from './collection'
import { LONGUEUR_MAX_ID } from './registre'
import { amisConcernes, plafondDefausse, prixDepart, type Ami } from './tri'
import { DEFINITIONS_THEMES, LIBELLES_THEMES, THEME_AUTRES, themesDeCarte } from './themes'

/** Réglages du lot. */
export interface Config {
  /** Limite d’enchères simultanées (lue par la construction des enchères, T-012). */
  maxVentesSimultanees: number
  /** Longueur maximale d’un nom d’étiquette ; `null` = inconnue (aucune limite appliquée). */
  longueurMaxEtiquette: number | null
  /** Noms d’étiquettes déjà connus sur le site (dont ceux du joueur). */
  nomsExistants: readonly string[]
  /**
   * L’identifiant attendu par l’enchère est relevé (identifiant de l’exemplaire) : l’enchère peut viser un exemplaire (H45).
   * Absent ou `false` : le type « enchère » reste non disponible.
   */
  lienCardId?: boolean
  /** Enchères en cours et plafond relevés sur le site (`marketplace/mine`) ; le plus contraignant l’emporte sur le décompte local. */
  ventesSite?: { enCours: number; max: number } | null
  /** Amis et thèmes qu’ils suivent, lus au moment où l’aperçu est figé (étiquettes d’échange). Absent : aucun ami. */
  amis?: readonly Ami[]
  /** Limite de nombre d’étiquettes par exemplaire relevée sur le site ; `null` ou absent = inconnue. */
  limiteParExemplaire?: number | null
  /** Limite de noms d’étiquettes distincts sur le compte ; `null` ou absent = inconnue. */
  limiteNoms?: number | null
  /** Plafond de valeur de défausse réglé par le joueur ; absent : `PLAFOND_VALEUR_DEFAUSSE` (5). */
  plafondDefausse?: number
}

/** Raison pour laquelle une étiquette précise n’est pas posée. */
export type RaisonNonPosee = 'homonyme' | 'nom-trop-long' | 'au-dela-limite'

/** Étiquette attendue mais non posée, avec sa carte et sa raison (aperçu « Étiquettes non posées »). */
export interface EtiquetteNonPosee {
  idCarte: string
  titre: string
  nomEtiquette: string
  raison: RaisonNonPosee
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
  nonPosees: EtiquetteNonPosee[]
}

export interface ExemplaireAttendu {
  idExemplaire: string
  /** Noms d’étiquettes attendus sur cet exemplaire. */
  etiquettes: string[]
}

/** Même ordre que `localeCompare(…, 'fr')`, sans recréer le collateur à chaque comparaison. */
const COLLATEUR_FR = new Intl.Collator('fr')

const comparer = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const STATUTS_ETIQUETES = new Set<Statut>(['garder', 'echanger', 'vendre'])

const PREFIXE_ECHANGE = '#À échanger '
const PREFIXE_STATUT = 'Statut · '

const NB_ANCETRES: Record<string, number> = Object.fromEntries(DEFINITIONS_THEMES.map((t) => [t.id, t.parents?.length ?? 0]))

/** Thèmes de la carte, sauf `autres`, du plus précis au plus général puis par libellé (H5). */
function themesOrdonnes(ids: readonly string[]): string[] {
  return ids
    .filter((id) => id !== THEME_AUTRES)
    .sort((a, b) => (NB_ANCETRES[b] ?? 0) - (NB_ANCETRES[a] ?? 0) || COLLATEUR_FR.compare(LIBELLES_THEMES[a] ?? a, LIBELLES_THEMES[b] ?? b))
}

/** Clés de comparaison des noms d’amis, mémorisées : la même liste revient pour chaque carte. */
const clesNoms = new Map<string, string>()
function cleNom(net: string): string {
  let cle = clesNoms.get(net)
  if (cle === undefined) {
    if (clesNoms.size >= 10_000) clesNoms.clear()
    cle = normaliser(net)
    clesNoms.set(net, cle)
  }
  return cle
}

/** Étiquettes d’échange (SC-021) : l’ami de la carte, puis chaque ami de la liste qui suit un thème de la carte. */
function etiquettesEchange(carte: Carte, themes: readonly string[], amis: readonly Ami[]): string[] {
  const noms: string[] = []
  const vus = new Set<string>()
  const ajouter = (nom: string): void => {
    const net = nom.trim()
    const cle = cleNom(net)
    if (net !== '' && !vus.has(cle)) {
      vus.add(cle)
      noms.push(net)
    }
  }
  ajouter(carte.ami ?? '')
  for (const ami of amisConcernes(themes, amis)) ajouter(ami.nom)
  return noms.map((n) => `${PREFIXE_ECHANGE}${n}`)
}

interface EtiquettesCarte {
  retenues: readonly string[]
  ecartees: readonly string[]
}

const MEMO_ETIQUETTES = new WeakMap<Carte, { amis: readonly Ami[] | undefined; limite: number | null | undefined; resultat: EtiquettesCarte }>()

/**
 * Étiquettes d’une carte pour chaque exemplaire relié, dans l’ordre de priorité de H5 :
 * Statut, étiquettes d’échange (carte `echanger`), puis thèmes. `ecartees` : thèmes au-delà de la
 * limite du site par exemplaire ; Statut et échanges ne sont jamais écartés au profit d’un thème.
 * Vide pour un favori, une carte à trier, à défausser ou en vente sur le site, ou non reliée.
 */
export function etiquettesDeCarte(carte: Carte, config?: Pick<Config, 'amis' | 'limiteParExemplaire'>): EtiquettesCarte {
  // Le lot, l’aperçu et le regroupement demandent trois fois les mêmes étiquettes pour les mêmes cartes
  // (objets immuables) : le résultat est mémorisé par carte, tant que les amis et la limite sont les mêmes.
  const amis = config?.amis
  const limite = config?.limiteParExemplaire
  const memo = MEMO_ETIQUETTES.get(carte)
  if (memo && memo.amis === amis && memo.limite === limite) return memo.resultat
  const resultat = calculerEtiquettes(carte, config)
  MEMO_ETIQUETTES.set(carte, { amis, limite, resultat })
  return resultat
}

function calculerEtiquettes(carte: Carte, config?: Pick<Config, 'amis' | 'limiteParExemplaire'>): EtiquettesCarte {
  if (carte.favori || !STATUTS_ETIQUETES.has(carte.statut) || !carte.idsSite) return { retenues: [], ecartees: [] }
  const themes = themesDeCarte(carte)
  const prioritaires = [`${PREFIXE_STATUT}${LIBELLES_STATUT[carte.statut]}`]
  if (carte.statut === 'echanger') prioritaires.push(...etiquettesEchange(carte, themes, config?.amis ?? []))
  const libellesThemes = themesOrdonnes(themes).map((id) => LIBELLES_THEMES[id] ?? id)
  const tous = [...prioritaires, ...libellesThemes]
  const limite = config?.limiteParExemplaire
  if (limite === null || limite === undefined || !Number.isFinite(limite) || limite < prioritaires.length) {
    // Pas de limite connue, ou limite plus basse que Statut et échanges : ceux-là restent, les thèmes sont écartés.
    if (limite === null || limite === undefined || !Number.isFinite(limite)) return { retenues: tous, ecartees: [] }
    // Limite à 0 : « Statut · … » reste posé malgré tout (au moins une étiquette par exemplaire).
    const n = Math.max(1, Math.floor(limite))
    return { retenues: prioritaires.slice(0, n), ecartees: [...prioritaires.slice(n), ...libellesThemes] }
  }
  const n = Math.floor(limite)
  return { retenues: tous.slice(0, n), ecartees: tous.slice(n) }
}

/**
 * Exemplaires reliés d’une carte et étiquettes attendues sur chacun.
 * Vide pour un favori, une carte à trier, à défausser ou en vente sur le site, ou non reliée.
 */
export function exemplairesAttendus(carte: Carte, config?: Pick<Config, 'amis' | 'limiteParExemplaire'>): ExemplaireAttendu[] {
  const { retenues } = etiquettesDeCarte(carte, config)
  if (retenues.length === 0 || !carte.idsSite) return []
  return carte.idsSite.map((idExemplaire) => ({ idExemplaire, etiquettes: [...retenues] }))
}

/**
 * Noms exclus par la limite de noms du compte (H6). Tous les noms du registre restent sur le compte
 * et occupent des places (même s’ils ne sont plus attendus) ; il reste `limite − noms du registre`
 * places pour les nouveaux noms : Statut et échanges d’abord, puis les thèmes par nombre
 * d’exemplaires décroissant et par libellé.
 */
function nomsAuDelaDeLaLimite(
  cartes: readonly Carte[],
  etiquettes: ReadonlyMap<string, { retenues: readonly string[] }>,
  registre: Registre,
  limiteNoms: number | null | undefined,
): Set<string> {
  if (limiteNoms === null || limiteNoms === undefined || !Number.isFinite(limiteNoms)) return new Set()
  const dansRegistre = new Set([...Object.keys(registre.etiquettes), ...registre.couples.map((x) => x.nom)])
  const compte = new Map<string, number>()
  for (const c of cartes) {
    const retenues = etiquettes.get(c.id)?.retenues ?? []
    const nb = c.idsSite?.length ?? 0
    if (nb === 0) continue
    for (const nom of retenues) compte.set(nom, (compte.get(nom) ?? 0) + nb)
  }
  const rang = (nom: string): number => (nom.startsWith(PREFIXE_STATUT) || nom.startsWith(PREFIXE_ECHANGE) ? 1 : 2)
  const nouveaux = [...compte.keys()]
    .filter((nom) => !dansRegistre.has(nom))
    .sort((a, b) => rang(a) - rang(b) || (rang(a) === 2 ? (compte.get(b) ?? 0) - (compte.get(a) ?? 0) : 0) || COLLATEUR_FR.compare(a, b))
  const places = Math.max(0, Math.floor(limiteNoms) - dansRegistre.size)
  return new Set(nouveaux.slice(places))
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
  const plafond = Math.min(config.maxVentesSimultanees, config.ventesSite?.max ?? Infinity)
  const places = Math.max(0, Math.floor(plafond - Math.max(enVente, config.ventesSite?.enCours ?? 0)))
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
  // Plafond absolu : un nom plus long que la limite d’identifiant du registre ne serait pas retirable.
  const limite = Math.min(config.longueurMaxEtiquette ?? LONGUEUR_MAX_ID, LONGUEUR_MAX_ID)

  const creations: Action[] = []
  const retraits: Action[] = []
  const poses: Action[] = []
  const defausses: Action[] = []
  const ecartees: CarteEcartee[] = []
  const obsoletes: EtiquetteObsolete[] = []
  const nonPosees: EtiquetteNonPosee[] = []
  const parCarte = new Map(cartes.map((c) => [c.id, etiquettesDeCarte(c, config)] as const))
  const exclus = nomsAuDelaDeLaLimite(cartes, parCarte, registre, config.limiteNoms)
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
      if (ids.length > 0 && !(c.valeurMarchande !== null && c.valeurMarchande <= plafondDefausse({ plafondDefausse: config.plafondDefausse }))) {
        ecarter('valeur-defausse-elevee')
      } else if (ids.length > 0) {
        if (dispo('defausse')) {
          for (const idExemplaire of ids) defausses.push({ type: 'defausse', idCarte: c.id, idExemplaire })
        } else {
          ecarter('action-non-disponible')
        }
      }
      if (c.quantite > c.idsSite.length) ecarter('exemplaires-non-relies')
      continue
    }

    // Une carte aux enchères n'est plus dans la collection du joueur : le site refuse (403) toute pose
    // sur son exemplaire. On n'envoie donc aucune étiquette, ni pose ni retrait ni création.
    if (c.statut === 'en-vente') {
      ecarter('en-vente-sur-site')
      continue
    }

    if (c.statut === 'vendre') aVendre.push(c)

    // Étiquettes (SC-007, SC-008).
    let nonDispo = false
    let tropLong = false
    let homonyme = false
    const { retenues, ecartees: ecarteesCarte } = parCarte.get(c.id) ?? { retenues: [], ecartees: [] }
    const attendus: Array<{ idExemplaire: string; etiquettes: readonly string[] }> = retenues.length === 0 ? [] : c.idsSite.map((idExemplaire) => ({ idExemplaire, etiquettes: retenues }))
    const dejaSignalees = new Set<string>()
    const nonPoseeCarte = (nomEtiquette: string, raison: RaisonNonPosee): void => {
      const cle = `${nomEtiquette}\u0000${raison}`
      if (dejaSignalees.has(cle)) return
      dejaSignalees.add(cle)
      nonPosees.push({ idCarte: c.id, titre: c.titre, nomEtiquette, raison })
    }
    for (const nom of ecarteesCarte) nonPoseeCarte(nom, 'au-dela-limite')

    for (const { idExemplaire, etiquettes: toutes } of attendus) {
      const etiquettes = toutes.filter((nom) => !exclus.has(nom))
      for (const nom of toutes) if (exclus.has(nom)) nonPoseeCarte(nom, 'au-dela-limite')
      const attendu = new Set(etiquettes)
      const presents = couplesParExemplaire.get(idExemplaire) ?? []

      for (const nom of presents) {
        if (attendu.has(nom)) continue
        if (dispo('retrait-etiquette')) retraits.push({ type: 'retrait-etiquette', idCarte: c.id, idExemplaire, nomEtiquette: nom })
        else nonDispo = true
      }

      for (const nom of etiquettes) {
        if (presents.includes(nom)) continue
        if (nom.length > limite) {
          tropLong = true
          nonPoseeCarte(nom, 'nom-trop-long')
          continue
        }
        const connue = Object.prototype.hasOwnProperty.call(registre.etiquettes, nom)
        if (!connue && connus.has(nom)) {
          homonyme = true
          nonPoseeCarte(nom, 'homonyme')
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
    nonPosees,
  }
}
