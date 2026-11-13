/**
 * Exécuteur à cadence fixe de la synchronisation complète.
 *
 * Logique pure : horloge, transport, revérification, application
 * locale et journal sont **injectés**. Aucun accès à `chrome.*`, au réseau ni au
 * jeton. Cadence : 0,2 s au minimum entre deux débuts de requête (décision d’Alexis du
 * 2026-11-12, toutes actions), plus un délai
 * supplémentaire variable fourni par l’appelant (décision d’Alexis du 2026-11-11),
 * si bien que ce module ne tire aucun nombre aléatoire lui-même. Les échéances sont en temps absolu, si bien qu’un minuteur
 * ralenti (onglet masqué) ne peut jamais rendre l’exécution plus rapide.
 *
 * Pas de reprise automatique après interruption, et jamais de relance d’une
 * requête dont le résultat est inconnu.
 */

import { CODES_CARTE_INDISPONIBLE, type Action, type EtatExecution, type FamilleLot, type LotExecution, type ResultatAction } from './actions'
import { decouperEnLots, familleDe } from './familles'

/** Intervalle minimal entre deux débuts de requête. */
export const INTERVALLE_MS = 200
/** Délai supplémentaire maximal, ajouté à l’intervalle minimal (jamais en dessous de l’intervalle minimal). */
export const SUPPLEMENT_MAX_MS = 100
// Plus de plafond de requêtes par minute (décision d’Alexis, 2026-11-12) : seul l’intervalle minimal limite le débit.
/** Nombre d’échecs cumulés (actions passées exclues) qui arrête la file. */
export const MAX_ECHECS = 3
/** Codes HTTP qui arrêtent la file dès la première occurrence. */
export const CODES_ARRET: readonly number[] = [401, 403, 429]
/** Conflit (409) : arrête aussi le lot, mais seulement pour une enchère ou une défausse (premier lot réel, 2026-11-11). */
export const CODE_CONFLIT = 409
export const arreteLeLot = (action: Action, codeHttp: number | null): boolean =>
  codeHttp !== null && (CODES_ARRET.includes(codeHttp) || (codeHttp === CODE_CONFLIT && (action.type === 'enchere' || action.type === 'defausse')))
/**
 * Refus par carte (403, 404) sur une action visant un exemplaire : le plus souvent l’exemplaire a été vendu ou
 * défaussé depuis la dernière synchro. L’action est abandonnée, la carte marquée indisponible localement et le lot
 * continue. Une session ou un jeton refusés répondent 403 à toutes les cartes : `MAX_REFUS_CARTE_CONSECUTIFS`
 * refus d’affilée (sans succès entre deux) arrêtent le lot comme avant.
 */
export { CODES_CARTE_INDISPONIBLE }
export const MAX_REFUS_CARTE_CONSECUTIFS = 3
/** Plafond de refus par carte sur tout un lot, qu’un succès intercalé ne remet jamais à zéro. */
export const MAX_REFUS_CARTE_PAR_LOT = 5
const TYPES_PAR_EXEMPLAIRE: readonly string[] = ['pose-etiquette', 'retrait-etiquette', 'enchere', 'defausse']
export const refusParCarte = (action: Action, codeHttp: number | null): boolean =>
  codeHttp !== null && CODES_CARTE_INDISPONIBLE.includes(codeHttp) && TYPES_PAR_EXEMPLAIRE.includes(action.type)
/** Libellé fixe d’un résultat d’arrêt sans requête émise (jeton absent). */
export const CAUSE_JETON_ABSENT = 'jeton-absent'

const VERSION_ETAT = 1

export interface Horloge {
  /** Date courante, en millisecondes. */
  now: () => number
  /** Résout dès que `now() >= echeance` (échéance absolue). */
  attendreJusqua: (echeance: number) => Promise<void>
}

export type Verification = 'ok' | 'passee'

type Ou<T> = T | Promise<T>

/** Rang de l’action dans son lot (à partir de 1), taille et famille du lot : complète l’entrée de journal (T-313). */
export interface ContexteJournal {
  rang: number
  total: number
  lot: FamilleLot
}

export interface JournalFile {
  /** Écrit une entrée « en cours » avant l’envoi et renvoie son identifiant. */
  ouvrir: (action: Action, contexte?: ContexteJournal) => Ou<string>
  completer: (id: string, resultat: ResultatAction) => Ou<void>
  /** Inscrit l’entrée en « passée » (action non envoyée). */
  passer: (id: string) => Ou<void>
}

/** Nombre maximal d’écritures d’étiquettes simultanément en vol (décision d’Alexis, 2026-11-12). */
export const CONCURRENCE_MAX = 4

/** Seules les poses et retraits d’étiquettes (selon leur type) peuvent partir en parallèle ; tout le reste est un point de passage. */
const parallelisable = (action: Action): boolean => action.type === 'pose-etiquette' || action.type === 'retrait-etiquette'

export interface DependancesFile {
  /** Écritures d’étiquettes en vol en même temps (1 à `CONCURRENCE_MAX`) ; absent : 1 (une seule requête en vol). */
  concurrence?: number
  horloge: Horloge
  transport: (ordre: Action) => Promise<ResultatAction>
  /**
   * Revérifie l’action. Appelée deux fois par action (avant l’attente de cadence, puis juste avant
   * l’envoi) : elle doit être sans effet de bord.
   */
  reverifier: (action: Action) => Ou<Verification>
  appliquer: (action: Action, resultat: ResultatAction) => Ou<void>
  journal: JournalFile
  /**
   * Délai supplémentaire (ms) avant la requête suivante, tiré par l'appelant. Borné à
   * [0, SUPPLEMENT_MAX_MS] et arrondi ; absent ou invalide : 0.
   */
  delaiSupplementaire?: () => number
}

export type RaisonArret =
  | 'manuel'
  | 'echecs'
  | 'code-http'
  | 'resultat'
  | 'ecriture'
  | 'transport'
  | 'verification'

/** Durée maximale d’une pause du joueur : au-delà, arrêt `manuel` (H18) ; l’appelant libère alors le bail. */
export const DUREE_PAUSE_MAX_MS = 15 * 60_000

/** Contexte de l’action qui a arrêté l’exécution (hors arrêt manuel). Aucun identifiant d’exemplaire n’en est tiré par le stockage. */
export interface ContexteErreur {
  action: Action
  famille: FamilleLot
  /** Numéro du lot de la famille dans l’exécution, à partir de 1. */
  indexLot: number
  nbLots: number
  /** Rang de l’action dans son lot, à partir de 1. */
  rang: number
  totalLot: number
  codeHttp: number | null
  cause: RaisonArret
  reussies: number
  /** Autres requêtes du même lot parallèle déjà parties et non réussies. */
  autresEchecsEnVol: number
  /** Présent (vrai) seulement si l’arrêt vient du seuil de refus par carte : la pause de 30 min s’applique alors. */
  seuilRefus?: true
}

/** Reprise de la même exécution : identifiant et compteurs conservés (`total` vient de la suite). */
export interface SuiteExecution {
  traitees: number
  total: number
  lots: readonly LotExecution[]
  reussies: number
}

export interface EtatFile extends EtatExecution {
  raison: RaisonArret | null
  /** Vrai tant que la file est en pause du joueur (aucun nouveau départ). */
  enPause: boolean
  /** Un lot par famille, dans l’ordre de première apparition. */
  lots: LotExecution[]
  /** Actions réussies de l’exécution (suite comprise). */
  reussies: number
  /**
   * Après un arrêt : action en erreur, ordres abandonnés puis actions non parties, dans l’ordre d’origine.
   * Les ordres déjà envoyés ne sont jamais restantes (jamais de relance d’une requête envoyée). Vide pendant l’exécution.
   */
  restantes: Action[]
  /** Renseigné pour un arrêt autre que `manuel`. */
  erreur: ContexteErreur | null
}

export interface File {
  /** Lance l’exécution ; la promesse est rejetée tant qu’une exécution est en cours. */
  demarrer: (actions: readonly Action[], idLot: string, suite?: SuiteExecution) => Promise<EtatFile>
  /** Ajoute en fin de file ; `false` si aucune exécution n’est en cours. */
  ajouter: (actions: readonly Action[]) => boolean
  arreter: () => void
  /** Cesse tout nouveau départ (requêtes en vol terminées) ; sans effet hors exécution ou déjà en pause. */
  pause: () => void
  /** Reprend la même exécution, cadence conservée ; sans effet hors pause. */
  reprendre: () => void
  etat: () => EtatFile | null
  /** Notifie chaque changement d’état ; renvoie la fonction de désabonnement. */
  abonner: (ecouteur: (etat: EtatFile) => void) => () => void
}

/** Sentinelle interne : arrêt demandé. */
class Arret extends Error {
  constructor(
    readonly raison: RaisonArret,
    readonly entree: Entree | null = null,
    readonly codeHttp: number | null = null,
  ) {
    super(raison)
  }
  /** Arrêt dû au seuil de refus par carte (3 d’affilée ou 5 par lot), quel que soit le dernier code (403 ou 404). */
  seuilRefus = false
}

/** Action de l’exécution et son suivi interne (identité propre : la même action peut figurer deux fois). */
interface Entree {
  action: Action
  rang: number
  /** Passée à `transport` (ou écartée avant) : elle ne repart jamais d’elle-même. */
  envoyee: boolean
  /** Terminée sans arrêt (réussie, échouée sans arrêt, passée). */
  traitee: boolean
  reussie: boolean
}

/** Action d’un lot parallèle abandonnée sans envoi parce qu’un autre ordre du lot a arrêté la file. */
class Annulee extends Error {}

export function creerFile(deps: DependancesFile): File {
  const { horloge, transport, reverifier, appliquer: appliquerBrut, journal: journalBrut, delaiSupplementaire } = deps
  const concurrence = Math.min(CONCURRENCE_MAX, Math.max(1, Math.floor(deps.concurrence ?? 1) || 1))

  // Les écritures locales (journal, collection, registre) sont enchaînées une à une : des ordres en vol
  // en même temps ne doivent jamais se marcher dessus (lecture puis écriture du stockage).
  let chaine: Promise<unknown> = Promise.resolve()
  const serie = <T>(f: () => Ou<T>): Promise<T> => {
    const p = chaine.then(f)
    chaine = p.catch(() => undefined)
    return p
  }
  const journal: JournalFile = {
    ouvrir: (a, c) => serie(() => journalBrut.ouvrir(a, c)),
    completer: (id, r) => serie(() => journalBrut.completer(id, r)),
    passer: (id) => serie(() => journalBrut.passer(id)),
  }
  const appliquer = (a: Action, r: ResultatAction): Promise<void> => serie(() => appliquerBrut(a, r))
  /** Vrai dès qu’un ordre a arrêté la file : les ordres du lot pas encore partis ne partent pas. */
  let stoppe = false

  let enCours = false
  /** File d’attente : actions pas encore prises. */
  let file: Entree[] = []
  /** Toutes les actions de l’exécution, dans l’ordre d’origine (suites et ajouts compris). */
  let tous: Entree[] = []
  let etat: EtatFile | null = null
  let reussies = 0
  let arretDemande = false
  let reveil: () => void = () => {}
  let signalArret: Promise<void> = Promise.resolve()
  const ecouteurs = new Set<(e: EtatFile) => void>()

  // Pause du joueur : aucun nouveau départ ; `generationPause` distingue deux pauses successives.
  let enPause = false
  let generationPause = 0
  let signalPause: Promise<void> = Promise.resolve()
  let liberer: () => void = () => {}

  // Mémoire de cadence, conservée tant que la file vit (mêmes règles d’une exécution à l’autre).
  let dernierDebut = Number.NEGATIVE_INFINITY
  /** Heure réelle du dernier envoi d’un lot parallèle (garantit l’écart de 0,2 s avec l’action suivante). */
  let dernierEnvoi = Number.NEGATIVE_INFINITY
  let derniereReponse = Number.NEGATIVE_INFINITY
  /** Supplément tiré après la dernière requête, appliqué avant la suivante. */
  let supplement = 0

  function tirerSupplement(): number {
    if (!delaiSupplementaire) return 0
    let v: number
    try {
      v = delaiSupplementaire()
    } catch {
      return 0
    }
    return Number.isFinite(v) ? Math.min(SUPPLEMENT_MAX_MS, Math.max(0, Math.floor(v))) : 0
  }

  const publier = (): void => {
    if (etat === null) return
    const copie = { ...etat }
    for (const e of [...ecouteurs]) e(copie)
  }

  const changer = (changement: Partial<EtatFile>): void => {
    if (etat === null) return
    etat = { ...etat, ...changement }
    publier()
  }

  const lotDe = (action: Action): LotExecution | undefined => etat?.lots.find((l) => l.famille === familleDe(action))

  /** Ajoute une action au décompte de son lot (nouveau lot en fin de liste si la famille est absente). */
  function inscrireDansLot(lots: readonly LotExecution[], action: Action): LotExecution[] {
    const famille = familleDe(action)
    if (!lots.some((l) => l.famille === famille)) return [...lots, { famille, total: 1, traitees: 0, sautees: 0 }]
    return lots.map((l) => (l.famille === famille ? { ...l, total: l.total + 1 } : l))
  }

  /** Compte des actions terminées (lot et total). */
  function compter(entrees: readonly Entree[]): void {
    if (etat === null || entrees.length === 0) return
    const lots = etat.lots.map((l) => ({ ...l, traitees: l.traitees + entrees.filter((e) => familleDe(e.action) === l.famille).length }))
    changer({ traitees: etat.traitees + entrees.length, lots, reussies })
  }

  const contexteJournal = (entree: Entree): ContexteJournal | undefined => {
    const lot = lotDe(entree.action)
    return lot ? { rang: entree.rang, total: lot.total, lot: lot.famille } : undefined
  }

  /** Attend l’échéance, ou l’arrêt manuel s’il survient avant. */
  async function attendre(echeance: number): Promise<void> {
    // Une attente qui rend la main trop tôt (minuteur imprécis) est reprise.
    while (!arretDemande && horloge.now() < echeance) {
      await Promise.race([horloge.attendreJusqua(echeance), signalArret])
    }
    if (arretDemande) throw new Arret('manuel')
  }

  /** Point de passage avant tout départ : bloque pendant la pause, lève l’arrêt manuel s’il est demandé. */
  async function attendrePause(): Promise<boolean> {
    let attendu = false
    while (enPause && !arretDemande) {
      attendu = true
      await Promise.race([signalPause, signalArret])
    }
    if (arretDemande) throw new Arret('manuel')
    return attendu
  }

  /**
   * Après une pause réellement attendue : nouveau créneau (intervalle plus gigue) pour un ordre parallèle, puis
   * nouvelle revérification, car la carte a pu changer pendant la pause.
   */
  async function sortirDePause(entree: Entree, lotParallele: boolean): Promise<Verification> {
    if (lotParallele) {
      const creneau = Math.max(dernierDebut + INTERVALLE_MS + supplement, horloge.now())
      dernierDebut = creneau
      supplement = tirerSupplement()
      await attendre(creneau)
    }
    return verifier(entree)
  }

  /** Revérification dont l’exception est classée à part (ni écriture, ni transport). */
  async function verifier(entree: Entree): Promise<Verification> {
    try {
      return await reverifier(entree.action)
    } catch {
      throw new Arret('verification', entree)
    }
  }

  async function inscrirePassee(entree: Entree): Promise<void> {
    const id = await journal.ouvrir(entree.action, contexteJournal(entree))
    await journal.passer(id)
  }

  /** Date de début autorisée : cadence unique (0,2 s plus supplément), réponse précédente. */
  function debutAutorise(): number {
    return Math.max(dernierDebut + INTERVALLE_MS + supplement, derniereReponse, dernierEnvoi + INTERVALLE_MS)
  }

  /**
   * `lotParallele` : l’action fait partie d’un lot de poses en vol en même temps. Son créneau de départ est
   * réservé tout de suite (intervalle minimal entre deux départs), sans attendre la réponse des autres.
   */
  async function executer(entree: Entree, echecs: { n: number; refus: number; refusTotal: number }, lotParallele: boolean, apresReponse: number): Promise<void> {
    const action = entree.action
    if ((await verifier(entree)) === 'passee') return inscrirePassee(entree)

    if (lotParallele) {
      const creneau = Math.max(dernierDebut + INTERVALLE_MS + supplement, apresReponse)
      dernierDebut = creneau
      supplement = tirerSupplement()
      await attendre(creneau)
      if (stoppe) throw new Annulee()
    } else {
      await attendre(debutAutorise())
    }

    // La carte a pu changer pendant l’attente : dernière revérification avant l’envoi.
    if ((await verifier(entree)) === 'passee') return inscrirePassee(entree)
    if (stoppe) throw new Annulee()
    // Pause demandée pendant l’attente de cadence : aucune entrée de journal n’est ouverte pour rien.
    if (await attendrePause()) {
      if ((await sortirDePause(entree, lotParallele)) === 'passee') return inscrirePassee(entree)
    }
    if (stoppe) throw new Annulee()

    const id = await journal.ouvrir(action, contexteJournal(entree))
    // Pause demandée pendant l’écriture du journal : l’entrée reste « en cours » jusqu’à la reprise, ou devient « passée ».
    try {
      if (await attendrePause() && (await sortirDePause(entree, lotParallele)) === 'passee') {
        await journal.passer(id)
        return
      }
    } catch (e) {
      await journal.passer(id)
      throw e
    }
    if (stoppe) {
      // Un autre ordre du lot a reçu un arrêt pendant l’écriture du journal : rien n’est émis.
      await journal.passer(id)
      throw new Annulee()
    }
    if (arretDemande) {
      // Arrêt survenu pendant l’écriture du journal : rien n’est émis.
      await journal.passer(id)
      throw new Arret('manuel')
    }

    if (lotParallele) {
      // Le journal et les écritures locales étant en série, un départ a pu glisser : on garantit l’écart réel
      // entre deux envois juste avant d’émettre (aucun await entre la dernière vérification et l’envoi).
      while (horloge.now() < dernierEnvoi + INTERVALLE_MS) {
        await attendre(dernierEnvoi + INTERVALLE_MS)
        if (stoppe) {
          await journal.passer(id)
          throw new Annulee()
        }
      }
      dernierEnvoi = horloge.now()
    }

    const debut = horloge.now()
    let resultat: ResultatAction
    let exception = false
    entree.envoyee = true
    try {
      resultat = await transport(action)
    } catch {
      exception = true
      resultat = { classe: 'inconnu', codeHttp: null, cause: 'erreur de transport' }
    }
    // Seul l’arrêt « jeton absent » (aucune requête émise) laisse la cadence intacte.
    if (exception || !(resultat.classe === 'arret' && resultat.cause === CAUSE_JETON_ABSENT)) {
      if (!lotParallele) {
        dernierDebut = debut
        supplement = tirerSupplement()
      }
      derniereReponse = Math.max(derniereReponse, horloge.now())
    }
    // Raison d’arrêt connue dès la réponse : le drapeau passe avant toute attente de journal, pour qu’aucun
    // ordre du lot parallèle ne parte entre-temps.
    let arretApres: Arret | null = null
    let indisponible = false
    if (resultat.classe === 'reussie') {
      echecs.refus = 0
      entree.reussie = true
      reussies++
    }
    if (exception) arretApres = new Arret('transport', entree, null)
    else if (resultat.classe === 'echec') {
      if (refusParCarte(action, resultat.codeHttp)) {
        echecs.refus++
        echecs.refusTotal++
        if (echecs.refus >= MAX_REFUS_CARTE_CONSECUTIFS || echecs.refusTotal >= MAX_REFUS_CARTE_PAR_LOT) { arretApres = new Arret('code-http', entree, resultat.codeHttp); arretApres.seuilRefus = true }
        else indisponible = true
      } else if (arreteLeLot(action, resultat.codeHttp)) arretApres = new Arret('code-http', entree, resultat.codeHttp)
      else {
        echecs.n++
        if (echecs.n >= MAX_ECHECS) arretApres = new Arret('echecs', entree, resultat.codeHttp)
      }
    } else if (resultat.classe !== 'reussie') arretApres = new Arret('resultat', entree, resultat.codeHttp)
    if (arretApres) stoppe = true

    await journal.completer(id, resultat)
    if (arretApres) throw arretApres
    // Carte indisponible : l’état local est corrigé (exemplaire retiré), les actions suivantes visant ce même
    // exemplaire sont écartées par la revérification, le lot continue.
    if (resultat.classe === 'reussie' || indisponible) await appliquer(action, resultat)
  }

  /** Traite une action ; toute exception qui n’est pas un arrêt connu devient un arrêt `ecriture` rattaché à l’action. */
  async function traiter(entree: Entree, echecs: { n: number; refus: number; refusTotal: number }, lotParallele = false, apresReponse = Number.NEGATIVE_INFINITY): Promise<void> {
    try {
      await executer(entree, echecs, lotParallele, apresReponse)
    } catch (e) {
      if (e instanceof Arret || e instanceof Annulee) throw e
      throw new Arret('ecriture', entree)
    }
    entree.traitee = true
  }

  /** Prend la prochaine action, ou jusqu’à `concurrence` poses/retraits consécutifs si la file est parallèle. */
  function prendreLot(): Entree[] {
    let lot: Entree[]
    if (concurrence === 1 || !parallelisable(file[0]!.action)) lot = [file.shift()!]
    else {
      lot = []
      while (lot.length < concurrence && file.length > 0 && parallelisable(file[0]!.action)) lot.push(file.shift()!)
    }
    // Rang dans le lot de la famille : actions déjà terminées ou sautées, puis position parmi celles qui partent.
    lot.forEach((e, i) => {
      const l = lotDe(e.action)
      const avant = lot.slice(0, i).filter((x) => familleDe(x.action) === familleDe(e.action)).length
      e.rang = (l ? l.traitees + l.sautees : 0) + 1 + avant
    })
    return lot
  }

  /** Exécute une action ; si elle arrête la file, les ordres du lot encore à envoyer sont abandonnés. */
  async function suivre(f: () => Promise<void>): Promise<void> {
    try {
      await f()
    } catch (e) {
      if (e instanceof Arret) stoppe = true
      throw e
    }
  }

  async function boucle(): Promise<void> {
    const echecs = { n: 0, refus: 0, refusTotal: 0 }
    let cause: unknown = null
    let lotCourant: Entree[] = []
    try {
      while (file.length > 0) {
        if (arretDemande) throw new Arret('manuel')
        await attendrePause()
        lotCourant = prendreLot()
        if (lotCourant.length === 1) {
          await suivre(() => traiter(lotCourant[0]!, echecs))
          compter(lotCourant)
          continue
        }
        const apresReponse = derniereReponse
        const issues = await Promise.allSettled(lotCourant.map((e) => suivre(() => traiter(e, echecs, true, apresReponse))))
        compter(lotCourant.filter((_, i) => issues[i]!.status === 'fulfilled'))
        const refus = issues.flatMap((i) => (i.status === 'rejected' ? [i.reason as unknown] : []))
        if (refus.length > 0) {
          // La cause réelle de l’arrêt prime sur les ordres simplement abandonnés ; un arrêt manuel vient après.
          cause = refus.find((r) => r instanceof Arret && r.raison !== 'manuel') ?? refus.find((r) => !(r instanceof Annulee)) ?? refus[0]
          throw cause
        }
      }
    } catch (e) {
      cause = e
    }
    const arret = cause instanceof Arret ? cause : null
    const raison: RaisonArret | null = cause === null ? null : arret ? arret.raison : 'ecriture'
    const fautive = raison === null || raison === 'manuel' ? null : (arret?.entree ?? null)

    let erreur: ContexteErreur | null = null
    if (fautive !== null && etat !== null && arret !== null && raison !== null) {
      const lot = lotDe(fautive.action)
      if (lot) {
        erreur = {
          action: fautive.action,
          famille: lot.famille,
          indexLot: etat.lots.findIndex((l) => l.famille === lot.famille) + 1,
          nbLots: etat.lots.length,
          rang: fautive.rang,
          totalLot: lot.total,
          codeHttp: arret.codeHttp,
          cause: raison,
          reussies,
          autresEchecsEnVol: lotCourant.filter((x) => x !== fautive && x.envoyee && !x.reussie).length,
          ...(arret.seuilRefus ? { seuilRefus: true as const } : {}),
        }
      }
    }
    // Jamais de relance d’une requête envoyée, sauf l’action en erreur (le choix revient à l’appelant).
    const restantes = tous
      .filter((e) => (!e.envoyee && !e.traitee) || (e === fautive && !e.reussie))
      .map((e) => e.action)
    file = []
    enPause = false
    liberer()
    changer({ etat: raison === null ? 'terminee' : 'arretee', raison, enPause: false, reussies, restantes, erreur })
    enCours = false
  }

  const nouvelleEntree = (action: Action): Entree => ({ action, rang: 0, envoyee: false, traitee: false, reussie: false })

  return {
    demarrer(actions, idLot, suite) {
      if (enCours) return Promise.reject(new Error('Une exécution est déjà en cours.'))
      enCours = true
      arretDemande = false
      enPause = false
      signalArret = new Promise<void>((r) => (reveil = r))
      tous = actions.map(nouvelleEntree)
      file = [...tous]
      stoppe = false
      reussies = suite?.reussies ?? 0
      let lots: LotExecution[] = suite ? suite.lots.map((l) => ({ ...l })) : decouperEnLots([...actions]).map((l) => ({ famille: l.famille, total: l.actions.length, traitees: 0, sautees: 0 }))
      if (suite) {
        // Une action dont la famille n’est pas dans la suite l’ajoute (jamais de lot manquant).
        for (const a of actions) if (!lots.some((l) => l.famille === familleDe(a))) lots = [...lots, { famille: familleDe(a), total: 0, traitees: 0, sautees: 0 }]
      }
      etat = {
        version: VERSION_ETAT,
        idLot,
        etat: 'en-cours',
        traitees: suite?.traitees ?? 0,
        total: suite?.total ?? actions.length,
        raison: null,
        enPause: false,
        lots,
        reussies,
        restantes: [],
        erreur: null,
      }
      publier()
      return boucle().then(() => etat!)
    },
    ajouter(actions) {
      if (!enCours || arretDemande || etat === null) return false
      const nouvelles = actions.map(nouvelleEntree)
      tous.push(...nouvelles)
      file.push(...nouvelles)
      let lots = etat.lots
      for (const a of actions) lots = inscrireDansLot(lots, a)
      changer({ total: etat.total + actions.length, lots })
      return true
    },
    arreter() {
      if (!enCours) return
      arretDemande = true
      reveil()
    },
    pause() {
      if (!enCours || arretDemande || enPause) return
      enPause = true
      const generation = ++generationPause
      signalPause = new Promise<void>((r) => (liberer = r))
      changer({ enPause: true })
      // Au-delà de 15 min de pause : arrêt manuel (H18). Une reprise ou une autre pause rend ce délai caduc.
      void horloge.attendreJusqua(horloge.now() + DUREE_PAUSE_MAX_MS).then(() => {
        if (enPause && generation === generationPause) {
          arretDemande = true
          reveil()
        }
      })
    },
    reprendre() {
      if (!enCours || !enPause) return
      enPause = false
      liberer()
      changer({ enPause: false })
    },
    etat: () => (etat === null ? null : { ...etat }),
    abonner(ecouteur) {
      ecouteurs.add(ecouteur)
      return () => {
        ecouteurs.delete(ecouteur)
      }
    },
  }
}
