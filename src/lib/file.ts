/**
 * Exécuteur à cadence fixe de la synchronisation complète.
 *
 * Logique pure : horloge, transport, confirmation, revérification, application
 * locale et journal sont **injectés**. Aucun accès à `chrome.*`, au réseau ni au
 * jeton. Cadence : 6 s au minimum entre deux débuts de requête, plus un délai
 * supplémentaire variable fourni par l’appelant (décision d’Alexis du 2026-11-11),
 * si bien que ce module ne tire aucun nombre aléatoire lui-même. Les échéances sont en temps absolu, si bien qu’un minuteur
 * ralenti (onglet masqué) ne peut jamais rendre l’exécution plus rapide.
 *
 * Pas de reprise automatique après interruption, et jamais de relance d’une
 * requête dont le résultat est inconnu.
 */

import type { Action, EtatExecution, ResultatAction } from './actions'

/** Intervalle minimal entre deux débuts de requête. */
export const INTERVALLE_MS = 6000
/** Délai supplémentaire maximal, ajouté à l’intervalle minimal (jamais en dessous de 6 s). */
export const SUPPLEMENT_MAX_MS = 4000
/** Fenêtre glissante et plafond de requêtes dans cette fenêtre. */
export const FENETRE_MS = 60_000
export const MAX_PAR_FENETRE = 10
/**
 * Cadence rapide des écritures d’étiquettes (Alexis, 2026-11-12 : la synchro était trop longue).
 * Ces requêtes partent vers l’hôte REST du site, comme les actions de son interface : 2 s au
 * minimum entre deux débuts, plus un supplément de 0 à 1,5 s, 30 au plus par fenêtre de 60 s.
 * Enchère, défausse et lecture gardent la cadence lente ci-dessus.
 */
export const INTERVALLE_ETIQUETTE_MS = 2000
export const SUPPLEMENT_ETIQUETTE_MAX_MS = 1500
export const MAX_ETIQUETTES_PAR_FENETRE = 30

export interface Cadence {
  intervalle: number
  supplementMax: number
  maxParFenetre: number
}
const CADENCE_LENTE: Cadence = { intervalle: INTERVALLE_MS, supplementMax: SUPPLEMENT_MAX_MS, maxParFenetre: MAX_PAR_FENETRE }
const CADENCE_ETIQUETTE: Cadence = {
  intervalle: INTERVALLE_ETIQUETTE_MS,
  supplementMax: SUPPLEMENT_ETIQUETTE_MAX_MS,
  maxParFenetre: MAX_ETIQUETTES_PAR_FENETRE,
}
/** Cadence applicable à une action : rapide pour les seules écritures d’étiquettes. */
export const cadenceDe = (action: Action): Cadence =>
  action.type === 'creation-etiquette' || action.type === 'pose-etiquette' || action.type === 'retrait-etiquette'
    ? CADENCE_ETIQUETTE
    : CADENCE_LENTE
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

export interface DependancesFile {
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
   * [0, supplément maximal de la cadence de l'action envoyée] et arrondi ; absent ou invalide : 0.
   */
  delaiSupplementaire?: (action: Action) => number
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

export function creerFile(deps: DependancesFile): File {
  const { horloge, transport, confirmer, reverifier, appliquer, journal, delaiSupplementaire } = deps

  let enCours = false
  let file: Action[] = []
  let etat: EtatFile | null = null
  let arretDemande = false
  let reveil: () => void = () => {}
  let signalArret: Promise<void> = Promise.resolve()
  const ecouteurs = new Set<(e: EtatFile) => void>()

  // Mémoire de cadence, conservée tant que la file vit (mêmes règles d’une exécution à l’autre).
  let dernierDebut = Number.NEGATIVE_INFINITY
  let derniereReponse = Number.NEGATIVE_INFINITY
  const debuts: number[] = []
  /** Supplément tiré après la dernière requête, appliqué avant la suivante. */
  let supplement = 0
  /** Cadence de la dernière requête émise : la pause qui suit est celle de la plus lente des deux actions. */
  let dernierIntervalle = INTERVALLE_MS

  function tirerSupplement(action: Action): number {
    if (!delaiSupplementaire) return 0
    let v: number
    try {
      v = delaiSupplementaire(action)
    } catch {
      return 0
    }
    return Number.isFinite(v) ? Math.min(cadenceDe(action).supplementMax, Math.max(0, Math.floor(v))) : 0
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

  /** Date de début autorisée : cadence de 6 s plus supplément, réponse précédente, confirmation, fenêtre de 60 s. */
  function debutAutorise(plancher: number, action: Action): number {
    const { intervalle, maxParFenetre } = cadenceDe(action)
    // Entre deux actions de cadences différentes, la plus lente s’applique (jamais plus rapide qu’avant).
    let debut = Math.max(dernierDebut + Math.max(intervalle, dernierIntervalle) + supplement, derniereReponse, plancher)
    const recents = debuts.filter((d) => d > debut - FENETRE_MS)
    if (recents.length >= maxParFenetre) {
      debut = Math.max(debut, recents[recents.length - maxParFenetre]! + FENETRE_MS)
    }
    return debut
  }

  async function traiter(action: Action, echecs: { n: number }): Promise<void> {
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

    await attendre(debutAutorise(plancher, action))

    // La carte a pu changer pendant la confirmation ou l’attente : dernière revérification avant l’envoi.
    if ((await verifier(action)) === 'passee') return inscrirePassee(action)

    const id = await journal.ouvrir(action)
    if (arretDemande) {
      // Arrêt survenu pendant l’écriture du journal : rien n’est émis.
      await journal.passer(id)
      throw new Arret('manuel')
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
      dernierDebut = debut
      supplement = tirerSupplement(action)
      dernierIntervalle = cadenceDe(action).intervalle
      derniereReponse = horloge.now()
      debuts.push(debut)
      if (debuts.length > MAX_ETIQUETTES_PAR_FENETRE * 2) debuts.splice(0, debuts.length - MAX_ETIQUETTES_PAR_FENETRE * 2)
    }
    await journal.completer(id, resultat)
    if (exception) throw new Arret('transport')

    switch (resultat.classe) {
      case 'reussie':
        await appliquer(action, resultat)
        return
      case 'echec':
        if (arreteLeLot(action, resultat.codeHttp)) throw new Arret('code-http')
        echecs.n++
        if (echecs.n >= MAX_ECHECS) throw new Arret('echecs')
        return
      default:
        // arrêt, forme hors contrat, redirection, délai, erreur réseau, résultat inconnu.
        throw new Arret('resultat')
    }
  }

  async function boucle(): Promise<void> {
    const echecs = { n: 0 }
    let raison: RaisonArret | null = null
    try {
      while (file.length > 0) {
        if (arretDemande) throw new Arret('manuel')
        const action = file.shift()!
        await traiter(action, echecs)
        changer({ traitees: etat!.traitees + 1 })
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
