/**
 * Construction du lot de la synchronisation : ce qui sera envoyé au site.
 *
 * Fonction pure : aucun accès à `chrome.*`, aucune mutation des entrées. Depuis le 2026-11-14 il n’y a plus de statut :
 * le lot contient des étiquettes (thèmes, échanges aux amis) ; les enchères et les défausses ne viennent que de la
 * sélection manuelle du joueur (`Config.selection`), jamais d’une déduction. Une erreur ici
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
import { estFavori, estFavoriVerrouille, normaliser, type Carte, type Collection } from './collection'
import { estRefuse, LONGUEUR_MAX_ID } from './registre'
import { amisConcernes, plafondDefausse, prixDepart, type Ami } from './tri'
import { LIBELLES_THEMES, themesDeCarte, themesPrincipaux, versionThemes } from './themes'

/** Choix manuels du joueur pour le lot : un favori n’est jamais retenu, une carte ne peut être qu’à vendre ou à défausser. */
export interface SelectionLot {
  /** Identifiants de cartes (un exemplaire mis aux enchères par carte). */
  vendre: readonly string[]
  /** Identifiant de carte → nombre d’exemplaires à défausser. */
  defausser: Readonly<Record<string, number>>
}

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
  /** Sélection manuelle du joueur au moment de l’aperçu : cartes à mettre aux enchères et nombre d’exemplaires à défausser. */
  selection?: SelectionLot
  /** Plafond de valeur de défausse réglé par le joueur ; absent : `PLAFOND_VALEUR_DEFAUSSE` (5). */
  plafondDefausse?: number
  /** Mode des étiquettes (absent : `poser`) : `suspendre` ne crée ni ne pose rien ; `retirer-tout` ne propose que des retraits (tout ce que l’extension a posé). */
  modeEtiquettes?: 'poser' | 'suspendre' | 'retirer-tout'
  /** Thèmes gardés du joueur (« Mes thèmes ») : une carte reliée de ces thèmes est mise en favori (Alexis, 2026-11-15). */
  mesThemes?: readonly string[]
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

/** Lot construit, avec les étiquettes obsolètes conservées à signaler dans l’aperçu. */
export interface LotConstruit extends Lot {
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

const PREFIXE_ECHANGE = '#À échanger '

/** Un ami peut aussi suivre une étiquette du site (Alexis, 2026-11-14) : sa clé est `site:<nom>`. */
export const cleEtiquetteSite = (nom: string): string => `site:${nom}`

/** Ancienne étiquette de repli : elle n’est plus posée (Alexis, 2026-11-15 : jamais « À classer »), mais celles déjà posées sont retirées. */
export const ETIQUETTE_A_CLASSER = '#À classer'

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
  for (const ami of amisConcernes([...themes, ...carte.etiquettesSite.map(cleEtiquetteSite)], amis)) ajouter(ami.nom)
  return noms.map((n) => `${PREFIXE_ECHANGE}${n}`)
}

/**
 * Carte « à classer » (Alexis, 2026-11-15) : aucun thème fiable, ou l’ancienne étiquette « #À classer » est encore sur le site (elle est alors retirée).
 * Elle est écartée de toute vente, défausse et échange tant qu’elle n’est pas classée.
 */
export function estACLasser(carte: Carte): boolean {
  return carte.etiquettesSite.includes(ETIQUETTE_A_CLASSER) || themesPrincipaux(carte).length === 0
}

/**
 * Carte à garder : elle porte l’un des thèmes gardés du joueur. Elle est alors mise en favori par l’extension
 * (au lieu d’une étiquette « Garder »). Une carte « à classer » n’est jamais retenue.
 */
export function estAGarder(carte: Carte, mesThemes: readonly string[] | undefined): boolean {
  if (!mesThemes || mesThemes.length === 0 || estACLasser(carte)) return false
  const themes = themesDeCarte(carte)
  return mesThemes.some((t) => themes.includes(t))
}

interface EtiquettesCarte {
  retenues: readonly string[]
  ecartees: readonly string[]
}

const MEMO_ETIQUETTES = new WeakMap<Carte, { amis: readonly Ami[] | undefined; gardes: readonly string[] | undefined; limite: number | null | undefined; version: number; resultat: EtiquettesCarte }>()

/**
 * Étiquettes d’une carte pour chaque exemplaire relié, dans l’ordre de priorité de H5 :
 * étiquettes d’échange (cartes non favorites), puis thèmes. `ecartees` : étiquettes au-delà de la
 * limite du site par exemplaire. Vide pour une carte non reliée.
 */
export function etiquettesDeCarte(carte: Carte, config?: Pick<Config, 'amis' | 'limiteParExemplaire' | 'mesThemes'>): EtiquettesCarte {
  // Le lot, l’aperçu et le regroupement demandent trois fois les mêmes étiquettes pour les mêmes cartes
  // (objets immuables) : le résultat est mémorisé par carte, tant que les amis et la limite sont les mêmes.
  const amis = config?.amis
  const limite = config?.limiteParExemplaire
  const gardes = config?.mesThemes
  const version = versionThemes()
  const memo = MEMO_ETIQUETTES.get(carte)
  if (memo && memo.amis === amis && memo.gardes === gardes && memo.limite === limite && memo.version === version) return memo.resultat
  const resultat = calculerEtiquettes(carte, config)
  MEMO_ETIQUETTES.set(carte, { amis, gardes, limite, version, resultat })
  return resultat
}

function calculerEtiquettes(carte: Carte, config?: Pick<Config, 'amis' | 'limiteParExemplaire' | 'mesThemes'>): EtiquettesCarte {
  // Toute carte reliée dont un thème fiable est connu reçoit 1 à 4 étiquettes de thème, favoris compris ; sans thème fiable, aucune (jamais « #À classer »).
  if (!carte.idsSite) return { retenues: [], ecartees: [] }
  const themes = themesDeCarte(carte)
  // Étiquettes d’échange : jamais pour un favori (le site le verrouille, et c’est une carte aimée), ni pour une carte
  // de thème gardé qui va être mise en favori (sinon des poses suivies de retraits au lot d’après).
  const prioritaires = estFavori(carte) || estACLasser(carte) || ((carte.choixFavori ?? null) === null && estAGarder(carte, config?.mesThemes)) ? [] : etiquettesEchange(carte, themes, config?.amis ?? [])
  // Les 4 thèmes les mieux établis seulement (Alexis, 2026-11-14) ; les parents ne servent qu’à désigner les amis.
  const precis = themesPrincipaux(carte).map((id) => LIBELLES_THEMES[id] ?? id)
  // Aucun thème fiable : aucune étiquette de thème (jamais « À classer »), la carte est signalée dans l’aperçu.
  const libellesThemes = precis
  const tous = [...prioritaires, ...libellesThemes]
  const limite = config?.limiteParExemplaire
  if (limite === null || limite === undefined || !Number.isFinite(limite)) return { retenues: tous, ecartees: [] }
  // Au moins une étiquette par exemplaire, et toujours le thème le plus précis : les échanges cèdent la place d’abord.
  const n = Math.max(1, Math.floor(limite))
  if (tous.length <= n) return { retenues: tous, ecartees: [] }
  const p = Math.min(prioritaires.length, libellesThemes.length === 0 ? n : n - 1)
  const retenues = [...prioritaires.slice(0, p), ...libellesThemes.slice(0, n - p)]
  return { retenues, ecartees: [...prioritaires.slice(p), ...libellesThemes.slice(n - p)] }
}

/**
 * Exemplaires reliés d’une carte et étiquettes attendues sur chacun.
 * Vide pour une carte non reliée.
 */
export function exemplairesAttendus(carte: Carte, config?: Pick<Config, 'amis' | 'limiteParExemplaire' | 'mesThemes'>): ExemplaireAttendu[] {
  const { retenues } = etiquettesDeCarte(carte, config)
  if (retenues.length === 0 || !carte.idsSite) return []
  return carte.idsSite.map((idExemplaire) => ({ idExemplaire, etiquettes: [...retenues] }))
}

/**
 * Noms exclus par la limite de noms du compte (H6). Tous les noms du registre restent sur le compte
 * et occupent des places (même s’ils ne sont plus attendus) ; il reste `limite − noms du registre`
 * places pour les nouveaux noms : les échanges d’abord, puis les thèmes par nombre
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
  const rang = (nom: string): number => (nom.startsWith(PREFIXE_ECHANGE) ? 1 : 2)
  const nouveaux = [...compte.keys()]
    .filter((nom) => !dansRegistre.has(nom))
    .sort((a, b) => rang(a) - rang(b) || (rang(a) === 2 ? (compte.get(b) ?? 0) - (compte.get(a) ?? 0) : 0) || COLLATEUR_FR.compare(a, b))
  const places = Math.max(0, Math.floor(limiteNoms) - dansRegistre.size)
  return new Set(nouveaux.slice(places))
}

/**
 * Places d’enchères : maximum = min(config, site), occupées = max(cartes `en-vente`, enchères en cours du site).
 * Fonction extraite de `construireEncheres` (T-301), même formule.
 */
export function placesEncheres(
  config: Pick<Config, 'maxVentesSimultanees' | 'ventesSite'>,
  enVente: number,
): { occupees: number; max: number } {
  return {
    occupees: Math.max(enVente, config.ventesSite?.enCours ?? 0),
    max: Math.min(config.maxVentesSimultanees, config.ventesSite?.max ?? Infinity),
  }
}

/**
 * Limite les enchères d'un lot aux places libres relues juste avant l'envoi (Alexis, 2026-11-15) : maximum = min(config,
 * site), places libres = maximum - enchères en cours. Les premières enchères (les plus chères, l'aperçu les trie ainsi)
 * sont gardées, les autres écartées ; les actions qui ne sont pas des enchères sont conservées dans leur ordre.
 */
export function limiterEncheres(
  actions: readonly Action[],
  ventes: { enCours: number; max: number },
  maxConfig: number,
): { actions: Action[]; ecartees: number; retirees: Action[] } {
  const libres = Math.max(0, Math.min(maxConfig, ventes.max) - ventes.enCours)
  let gardees = 0
  let ecartees = 0
  const sortie: Action[] = []
  const retirees: Action[] = []
  for (const a of actions) {
    if (a.type !== 'enchere') sortie.push(a)
    else if (gardees < libres) { gardees++; sortie.push(a) }
    else { ecartees++; retirees.push(a) }
  }
  return { actions: sortie, ecartees, retirees }
}

/**
 * Enchères du lot : `candidates` = cartes à vendre choisies par le joueur, reliées, sans conflit. Une enchère par
 * carte, sur le premier exemplaire de `idsSite`, les plus chères d’abord, dans la limite des places libres.
 * Une enchère est définitive côté site.
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
    // Garde-fou propre : jamais d’enchère sur un favori.
    if (estFavoriVerrouille(c)) continue
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
  const occupation = placesEncheres(config, enVente)
  const places = Math.max(0, Math.floor(occupation.max - occupation.occupees))
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
  const ecartees: CarteEcartee[] = []
  const nonPosees: EtiquetteNonPosee[] = []
  const parCarte = new Map(cartes.map((c) => [c.id, etiquettesDeCarte(c, config)] as const))
  const exclus = nomsAuDelaDeLaLimite(cartes, parCarte, registre, config.limiteNoms)
  const creesCeLot = new Set<string>()

  const dispo = (t: TypeAction): boolean => disponibles.has(t)
  const aVendre: Carte[] = []
  const defausses: Action[] = []
  const favoris: Action[] = []
  const vendre = new Set(config.selection?.vendre ?? [])
  const defausser = config.selection?.defausser ?? {}

  for (const c of cartes) {
    const ecarter = (raison: RaisonEcart): void => {
      ecartees.push({ idCarte: c.id, titre: c.titre, raison })
    }

    if (c.idsSite === null) {
      ecarter('non-reliee')
      continue
    }
    if (c.idsSite.some((id) => (proprietaires.get(id) ?? 0) > 1)) {
      ecarter('identifiant-en-conflit')
      continue
    }

    // Sélection manuelle du joueur (2026-11-14) : un favori est verrouillé sur le site, jamais vendu ni défaussé.
    const nbDefausses = Math.floor(defausser[c.id] ?? 0)
    if ((vendre.has(c.id) || nbDefausses > 0) && estFavoriVerrouille(c)) {
      ecarter('favori-verrouille')
      continue
    }
    if ((vendre.has(c.id) || nbDefausses > 0) && estACLasser(c)) {
      ecarter('a-classer')
      continue
    }
    if (nbDefausses > 0) {
      // Aucun retrait d’étiquette avant défausse (H19) : une carte défaussée n’est pas étiquetée.
      const ids = c.idsSite.slice(0, Math.min(nbDefausses, Math.max(0, c.quantite)))
      if (!(c.valeurMarchande !== null && c.valeurMarchande <= plafondDefausse({ plafondDefausse: config.plafondDefausse }))) {
        ecarter('valeur-defausse-elevee')
      } else if (dispo('defausse')) {
        for (const idExemplaire of ids) defausses.push({ type: 'defausse', idCarte: c.id, idExemplaire })
      } else {
        ecarter('action-non-disponible')
      }
      if (nbDefausses > c.idsSite.length) ecarter('exemplaires-non-relies')
      continue
    }
    if (vendre.has(c.id)) aVendre.push(c)

    // Mise en favori (Alexis, 2026-11-15) : un seul exemplaire par carte, jamais pour une carte déjà favorite
    // ni pour une carte choisie à la main pour la vente. Jamais l’inverse (aucun défavori).
    // Le choix manuel du joueur (étoile de la Collection, 2026-11-17) prime : une règle n'agit jamais sur une carte dont le choix est fait.
    const choix = c.choixFavori ?? null
    if (choix === null && !c.favori && !vendre.has(c.id) && c.idsSite.length > 0 && dispo('favori') && estAGarder(c, config.mesThemes)) {
      favoris.push({ type: 'favori', idCarte: c.id, idExemplaire: c.idsSite[0]! })
    }
    // Synchronisation du choix manuel vers le site : cocher = le premier exemplaire ; décocher = tous (on ignore lequel porte l'étoile).
    // Pas de condition « vendre » : le choix explicite du joueur passe avant ; mais une carte choisie pour la vente est écartée plus haut.
    if (choix !== null && c.idsSite.length > 0 && dispo('favori')) {
      if (choix && !c.favori) favoris.push({ type: 'favori', idCarte: c.id, idExemplaire: c.idsSite[0]!, valeur: true })
      if (!choix && c.favori) for (const ex of c.idsSite) favoris.push({ type: 'favori', idCarte: c.id, idExemplaire: ex, valeur: false })
    }

    // Étiquettes (SC-007, SC-008). Les anciennes étiquettes « Statut · … » posées par l’extension ne sont plus attendues :
    // elles sont retirées comme toute étiquette du registre qui n’est plus attendue.
    let nonDispo = false
    let tropLong = false
    let homonyme = false
    const { retenues, ecartees: ecarteesCarte } = parCarte.get(c.id) ?? { retenues: [], ecartees: [] }
    const modeEtiq = config.modeEtiquettes ?? 'poser'
    const attendus: Array<{ idExemplaire: string; etiquettes: readonly string[] }> = c.idsSite.map((idExemplaire) => ({ idExemplaire, etiquettes: modeEtiq === 'retirer-tout' ? [] : retenues }))
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

      for (const nom of modeEtiq === 'poser' ? etiquettes : []) {
        if (presents.includes(nom)) continue
        // Retirée à la main par le joueur : jamais reposée (la synchro ne défait pas ses décisions).
        if (estRefuse(registre, idExemplaire, nom)) continue
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

    // Les étiquettes retirées à la main (`registre.refus`) ne sont pas comptées à part : si le joueur retire tous les thèmes d'une carte,
    // c'est son choix, la carte n'est pas signalée.
    // Contrôle : une carte reliée doit garder au moins une étiquette de thème (hors échange) ;
    // sinon (nom trop long, homonyme, limite de noms du compte), elle est signalée dans l’aperçu.
    const estTheme = (nom: string): boolean => !nom.startsWith(PREFIXE_ECHANGE)
    if (c.idsSite.length > 0 && !retenues.some((nom) => estTheme(nom))) {
      ecarter('sans-theme-fiable')
    } else if (c.idsSite.length > 0 && !retenues.some((nom) => estTheme(nom) && !exclus.has(nom) && nom.length <= limite && !(!Object.prototype.hasOwnProperty.call(registre.etiquettes, nom) && connus.has(nom)))) {
      ecarter('sans-etiquette-theme')
    }
    if (tropLong) ecarter('nom-trop-long')
    if (homonyme) ecarter('homonyme')
    if (nonDispo) ecarter('action-non-disponible')
  }

  const encheres = construireEncheres(aVendre, config.ventesSite?.enCours ?? 0, config, disponibles)
  ecartees.push(...encheres.ecartees)

  // Une même raison n’est donnée qu’une fois par carte.
  const vues = new Set<string>()
  const ecarteesUniques = ecartees.filter((e) => {
    const cle = JSON.stringify([e.idCarte, e.raison])
    if (vues.has(cle)) return false
    vues.add(cle)
    return true
  })

  return {
    actions: [...creations, ...retraits, ...poses, ...encheres.actions, ...defausses, ...favoris],
    ecartees: ecarteesUniques,
    nonPosees,
  }
}
