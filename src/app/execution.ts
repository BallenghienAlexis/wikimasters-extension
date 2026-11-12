// Exécution côté page de gestion : accepte les ports des onglets WikiMasters, fournit le
// transport à la file, tient le verrou d'exécution unique et clôt les exécutions orphelines.
// Aucune requête ici : les ordres passent par le content script.
import { ORIGINE_SITE } from '../config/synchro';
import type { Action, EtatExecution, ResultatAction } from '../lib/actions';
import type { Horloge } from '../lib/file';
import { cloreInterrompues as cloreJournal, type Journal } from '../lib/journal';
import { ID_MAX, NOM_PORT, idDeMessage, messageOrdre, validerResultat } from '../lib/messages';
import {
  chargerExecution,
  chargerJournal,
  enregistrerExecution,
  enregistrerJournal,
  enregistrerSignalSynchro,
} from '../lib/stockage';

export { ORIGINE_SITE };
export const NOM_VERROU = 'wm-collection-execution';
/** Nombre maximal d’ordres en attente de résultat en même temps (garde-fou de la file parallèle). */
export const MAX_ORDRES_EN_ATTENTE = 4;

interface Chrono {
  now: () => number;
}

/**
 * Horloge monotone : `performance.now()` ne recule pas si l’heure système change.
 * Délai fixe, sans aléa ; l’échéance est revérifiée après chaque réveil du minuteur.
 */
export function creerHorloge(chrono: Chrono, minuteur: (rappel: () => void, delai: number) => unknown): Horloge {
  const now = (): number => chrono.now();
  return {
    now,
    async attendreJusqua(echeance) {
      while (now() < echeance) {
        await new Promise<void>((resoudre) => void minuteur(resoudre, echeance - now()));
      }
    },
  };
}

export const horlogeReelle: Horloge = creerHorloge(performance, (rappel, delai) => setTimeout(rappel, delai));

export type RaisonDesactivation = 'aucun-onglet' | 'plusieurs-onglets' | 'execution-en-cours';

interface PortPage {
  name?: string;
  sender?: { id?: string; url?: string; tab?: { id?: number } };
  postMessage: (message: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (rappel: (message: unknown) => void) => void };
  onDisconnect: { addListener: (rappel: () => void) => void };
}

interface RuntimePage {
  id: string;
  onConnect: {
    addListener: (rappel: (port: PortPage) => void) => void;
    removeListener: (rappel: (port: PortPage) => void) => void;
  };
}

interface Verrous {
  request: <T>(nom: string, options: { ifAvailable: true }, rappel: (verrou: unknown) => Promise<T>) => Promise<T>;
}

export interface DependancesExecution {
  runtime: RuntimePage;
  verrous: Verrous;
  chargerExecution: () => Promise<EtatExecution | null>;
  enregistrerExecution: (etat: EtatExecution) => Promise<void>;
  chargerJournal: () => Promise<Journal>;
  enregistrerJournal: (journal: Journal) => Promise<void>;
  enregistrerSignalSynchro: (horodatage: number) => Promise<void>;
  now: () => number;
}

export interface Execution {
  /** Écoute les connexions des content scripts ; renvoie la fonction d'arrêt. */
  ecouter: () => () => void;
  nbOngletsWikiMasters: () => number;
  raisonsDesactivation: () => RaisonDesactivation[];
  abonner: (rappel: () => void) => () => void;
  /** Transport pour `file.ts` : ordre → port → résultat classé. */
  transport: (ordre: Action) => Promise<ResultatAction>;
  /** Exécute `corps` sous le verrou unique ; le signal s'interrompt si un port se ferme. */
  demarrer: <T>(corps: (interruption: AbortSignal) => Promise<T>) => Promise<T>;
  /** À l'ouverture : une exécution « en cours » sans verrou détenu est close « interrompue » (SC-013). */
  cloreInterrompues: () => Promise<void>;
  /** Demande aux onglets déjà ouverts de se reconnecter. */
  signaler: () => Promise<void>;
}

const origineValide = (url: string | undefined): boolean => {
  if (url === undefined) return false;
  try {
    return new URL(url).origin === ORIGINE_SITE;
  } catch {
    return false;
  }
};

export function creerExecution(deps: DependancesExecution): Execution {
  const { runtime, verrous } = deps;
  const ports = new Map<number, Set<PortPage>>();
  const abonnes = new Set<() => void>();
  let enCours = false;
  let interruption: AbortController | null = null;
  interface Attente {
    port: PortPage;
    resoudre: (r: ResultatAction) => void;
    rejeter: (e: Error) => void;
  }
  /** Ordres envoyés dont le résultat n’est pas revenu, par numéro de corrélation. */
  const attentes = new Map<number, Attente>();
  let prochainId = 0;

  const notifier = (): void => abonnes.forEach((rappel) => rappel());

  const accepter = (port: PortPage): void => {
    const sender = port.sender;
    const tab = sender?.tab?.id;
    if (port.name !== NOM_PORT || sender?.id !== runtime.id || !origineValide(sender.url) || typeof tab !== 'number') {
      port.disconnect();
      return;
    }
    const groupe = ports.get(tab) ?? new Set<PortPage>();
    groupe.add(port);
    ports.set(tab, groupe);
    port.onMessage.addListener((brut) => {
      const resultat = validerResultat(brut);
      if (resultat === null) return;
      // Le résultat reprend le numéro de l’ordre. Sans numéro, il n’est admis que s’il n’y a qu’un seul ordre en attente.
      const recu = idDeMessage(brut);
      let id: number | undefined;
      if (recu !== null) id = recu;
      else if (attentes.size === 1) id = [...attentes.keys()][0];
      const courante = id === undefined ? undefined : attentes.get(id);
      if (id === undefined || courante === undefined || courante.port !== port) return;
      attentes.delete(id);
      courante.resoudre(resultat);
    });
    port.onDisconnect.addListener(() => {
      groupe.delete(port);
      if (groupe.size === 0) ports.delete(tab);
      for (const [id, courante] of [...attentes]) {
        if (courante.port !== port) continue;
        attentes.delete(id);
        courante.rejeter(new Error('Onglet WikiMasters déconnecté.'));
      }
      if (enCours) interruption?.abort();
      notifier();
    });
    notifier();
  };

  const nbOngletsWikiMasters = (): number => ports.size;

  return {
    ecouter() {
      runtime.onConnect.addListener(accepter);
      return () => runtime.onConnect.removeListener(accepter);
    },
    nbOngletsWikiMasters,
    raisonsDesactivation() {
      const raisons: RaisonDesactivation[] = [];
      if (ports.size === 0) raisons.push('aucun-onglet');
      if (ports.size > 1) raisons.push('plusieurs-onglets');
      if (enCours) raisons.push('execution-en-cours');
      return raisons;
    },
    abonner(rappel) {
      abonnes.add(rappel);
      return () => void abonnes.delete(rappel);
    },
    transport(ordre) {
      if (ports.size !== 1) return Promise.reject(new Error('Un seul onglet WikiMasters est requis.'));
      if (attentes.size >= MAX_ORDRES_EN_ATTENTE) return Promise.reject(new Error('Trop d’ordres en attente.'));
      const port = [...[...ports.values()][0]!][0]!;
      const id = prochainId;
      prochainId = prochainId >= ID_MAX ? 0 : prochainId + 1;
      return new Promise<ResultatAction>((resoudre, rejeter) => {
        attentes.set(id, { port, resoudre, rejeter });
        try {
          port.postMessage(messageOrdre(ordre, id));
        } catch (e) {
          attentes.delete(id);
          rejeter(e instanceof Error ? e : new Error('Envoi impossible.'));
        }
      });
    },
    async demarrer(corps) {
      if (enCours) throw new Error('Une exécution est déjà en cours.');
      enCours = true;
      notifier();
      try {
        return await verrous.request(NOM_VERROU, { ifAvailable: true }, async (verrou) => {
          if (verrou === null) throw new Error('Une exécution est déjà en cours dans un autre onglet.');
          interruption = new AbortController();
          return corps(interruption.signal);
        });
      } finally {
        enCours = false;
        interruption = null;
        const restantes = [...attentes.values()];
        attentes.clear();
        for (const restante of restantes) restante.rejeter(new Error('Exécution terminée.'));
        notifier();
      }
    },
    async cloreInterrompues() {
      await verrous.request(NOM_VERROU, { ifAvailable: true }, async (verrou) => {
        // Verrou détenu ailleurs : l'exécution est bien vivante, on n'y touche pas.
        if (verrou === null) return;
        const etat = await deps.chargerExecution();
        if (etat === null || etat.etat !== 'en-cours') return;
        await deps.enregistrerJournal(cloreJournal(await deps.chargerJournal(), etat.idLot));
        await deps.enregistrerExecution({ ...etat, etat: 'arretee' });
      });
    },
    signaler() {
      return deps.enregistrerSignalSynchro(deps.now());
    },
  };
}

/** Assemblage réel : `chrome.runtime`, `navigator.locks` et le stockage de l'extension. */
export function creerExecutionReelle(): Execution {
  return creerExecution({
    runtime: chrome.runtime as unknown as RuntimePage,
    verrous: navigator.locks as unknown as Verrous,
    chargerExecution,
    enregistrerExecution,
    chargerJournal,
    enregistrerJournal,
    enregistrerSignalSynchro,
    now: () => Date.now(),
  });
}
