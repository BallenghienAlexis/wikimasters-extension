/**
 * Exécuteur à cadence fixe de la synchronisation complète.
 *
 * Logique pure : horloge, transport, confirmation, revérification, application
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

import type { Action, EtatExecution, ResultatAction } from './actions'

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
/** Libellé fixe d’un résultat d’arrêt sans requête émise (jeton absent). */
export const CAUSE_JETON_ABSENT = 'jeton-absent'

const VERSION_ETAT = 1

export interface Horloge {
  /** Date courante, en millisecondes. */
  now: () => number
  /** Résout dès que `now() >= echeance` (échéance absolue). */
  attendreJusqua: (echeance: number) => Promise<void>
}

export type Decision = 'defausser' | 'passer' | 'arreter'
export type Verification = 'ok' | 'passee'

type Ou<T> = T | Promise<T>

export interface JournalFile {
  /** Écrit une entrée « en cours » avant l’envoi et renvoie son identifiant. */
  ouvrir: (action: Action) => Ou<string>
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
  confirmer: (action: Action) => Ou<Decision>
  /**
   * Revérifie l’action. Appelée deux fois par action (avant la confirmation, puis juste avant
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
  | 'confirmation'
  | 'verification'
  | 'confirmation-indisponible'

export interface EtatFile extends EtatExecution {
  raison: RaisonArret | null
}

export interface File {
  /** Lance l’exécution ; la promesse est rejetée tant qu’une exécution est en cours. */
  demarrer: (actions: readonly Action[], idLot: string) => Promise<EtatFile>
  /** Ajoute en fin de file ; `false` si aucune exécution n’est en cours. */
  ajouter: (actions: readonly Action[]) => boolean
  arreter: () => void
  etat: () => EtatFile | null
  /** Notifie chaque changement d’état ; renvoie la fonction de désabonnement. */
  abonner: (ecouteur: (etat: EtatFile) => void) => () => void
}

/** Sentinelle interne : arrêt demandé. */
class Arret extends Error {
  constructor(readonly raison: RaisonArret) {
    super(raison)
  }
}

/** Action d’un lot parallèle abandonnée sans envoi parce qu’un autre ordre du lot a arrêté la file. */
class Annulee extends Error {}

export function creerFile(deps: DependancesFile): File {
  const { horloge, transport, confirmer, reverifier, appliquer: appliquerBrut, journal: journalBrut, delaiSupplementaire } = deps
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
    ouvrir: (a) => serie(() => journalBrut.ouvrir(a)),
    completer: (id, r) => serie(() => journalBrut.completer(id, r)),
    passer: (id) => serie(() => journalBrut.passer(id)),
  }
  const appliquer = (a: Action, r: ResultatAction): Promise<void> => serie(() => appliquerBrut(a, r))
  /** Vrai dès qu’un ordre a arrêté la file : les ordres du lot pas encore partis ne partent pas. */
  let stoppe = false

  let enCours = false
  let file: Action[] = []
  let etat: EtatFile | null = null
  let arretDemande = false
  let reveil: () => void = () => {}
  let signalArret: Promise<void> = Promise.resolve()
  const ecouteurs = new Set<(e: EtatFile) => void>()

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

  /** Attend l’échéance, ou l’arrêt manuel s’il survient avant. */
  async function attendre(echeance: number): Promise<void> {
    // Une attente qui rend la main trop tôt (minuteur imprécis) est reprise.
    while (!arretDemande && horloge.now() < echeance) {
      await Promise.race([horloge.attendreJusqua(echeance), signalArret])
    }
    if (arretDemande) throw new Arret('manuel')
  }

  /** Revérification dont l’exception est classée à part (ni écriture, ni transport). */
  async function verifier(action: Action): Promise<Verification> {
    try {
      return await reverifier(action)
    } catch {
      throw new Arret('verification')
    }
  }

  async function inscrirePassee(action: Action): Promise<void> {
    const id = await journal.ouvrir(action)
    await journal.passer(id)
  }

  /** Date de début autorisée : cadence unique (0,2 s plus supplément), réponse précédente, confirmation. */
  function debutAutorise(plancher: number): number {
    return Math.max(dernierDebut + INTERVALLE_MS + supplement, derniereReponse, plancher, dernierEnvoi + INTERVALLE_MS)
  }

  /**
   * `lotParallele` : l’action fait partie d’un lot de poses en vol en même temps. Son créneau de départ est
   * réservé tout de suite (intervalle minimal entre deux départs), sans attendre la réponse des autres.
   */
  async function traiter(action: Action, echecs: { n: number }, lotParallele = false, apresReponse = Number.NEGATIVE_INFINITY): Promise<void> {
    if ((await verifier(action)) === 'passee') return inscrirePassee(action)

    let plancher = Number.NEGATIVE_INFINITY
    if (action.type === 'defausse') {
      let decision: Decision
      try {
        decision = await confirmer(action)
      } catch {
        throw new Arret('confirmation-indisponible')
      }
      if (arretDemande) throw new Arret('manuel')
      if (decision === 'arreter') throw new Arret('confirmation')
      if (decision === 'passer') return inscrirePassee(action)
      plancher = horloge.now()
    }

    if (lotParallele) {
      const creneau = Math.max(dernierDebut + INTERVALLE_MS + supplement, apresReponse, plancher)
      dernierDebut = creneau
      supplement = tirerSupplement()
      await attendre(creneau)
      if (stoppe) throw new Annulee()
    } else {
      await attendre(debutAutorise(plancher))
    }

    // La carte a pu changer pendant la confirmation ou l’attente : dernière revérification avant l’envoi.
    if ((await verifier(action)) === 'passee') return inscrirePassee(action)
    if (stoppe) throw new Annulee()

    const id = await journal.ouvrir(action)
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
    if (exception) arretApres = new Arret('transport')
    else if (resultat.classe === 'echec') {
      if (arreteLeLot(action, resultat.codeHttp)) arretApres = new Arret('code-http')
      else {
        echecs.n++
        if (echecs.n >= MAX_ECHECS) arretApres = new Arret('echecs')
      }
    } else if (resultat.classe !== 'reussie') arretApres = new Arret('resultat')
    if (arretApres) stoppe = true

    await journal.completer(id, resultat)
    if (arretApres) throw arretApres
    if (resultat.classe === 'reussie') await appliquer(action, resultat)
  }

  /** Prend la prochaine action, ou jusqu’à `concurrence` poses/retraits consécutifs si la file est parallèle. */
  function prendreLot(): Action[] {
    if (concurrence === 1 || !parallelisable(file[0]!)) return [file.shift()!]
    const lot: Action[] = []
    while (lot.length < concurrence && file.length > 0 && parallelisable(file[0]!)) lot.push(file.shift()!)
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
    const echecs = { n: 0 }
    let raison: RaisonArret | null = null
    try {
      while (file.length > 0) {
        if (arretDemande) throw new Arret('manuel')
        const lot = prendreLot()
        if (lot.length === 1) {
          await suivre(() => traiter(lot[0]!, echecs))
          changer({ traitees: etat!.traitees + 1 })
          continue
        }
        const apresReponse = derniereReponse
        const issues = await Promise.allSettled(lot.map((a) => suivre(() => traiter(a, echecs, true, apresReponse))))
        changer({ traitees: etat!.traitees + issues.filter((i) => i.status === 'fulfilled').length })
        const refus = issues.flatMap((i) => (i.status === 'rejected' ? [i.reason as unknown] : []))
        if (refus.length > 0) {
          // La cause réelle de l’arrêt prime sur les ordres simplement abandonnés ; un arrêt manuel vient après.
          const cause = refus.find((r) => r instanceof Arret && r.raison !== 'manuel') ?? refus.find((r) => !(r instanceof Annulee)) ?? refus[0]
          throw cause
        }
      }
    } catch (e) {
      raison = e instanceof Arret ? e.raison : 'ecriture'
    }
    file = []
    changer({ etat: raison === null ? 'terminee' : 'arretee', raison })
    enCours = false
  }

  return {
    demarrer(actions, idLot) {
      if (enCours) return Promise.reject(new Error('Une exécution est déjà en cours.'))
      enCours = true
      arretDemande = false
      signalArret = new Promise<void>((r) => (reveil = r))
      file = [...actions]
      stoppe = false
      etat = {
        version: VERSION_ETAT,
        idLot,
        etat: 'en-cours',
        traitees: 0,
        total: actions.length,
        raison: null,
      }
      publier()
      return boucle().then(() => etat!)
    },
    ajouter(actions) {
      if (!enCours || arretDemande || etat === null) return false
      file.push(...actions)
      changer({ total: etat.total + actions.length })
      return true
    },
    arreter() {
      if (!enCours) return
      arretDemande = true
      reveil()
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
