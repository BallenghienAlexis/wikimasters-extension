// Exécutant : reçoit les ordres de la page de gestion par un port ouvert par l'extension.
// Les ordres ne viennent QUE de ce port : aucun écouteur sur la page du site, qui est hostile.
// Par défaut, aucune requête n'est émise : `emettre` renvoie « action non disponible ».
import type { Action, ResultatAction } from '../lib/actions';
import { NOM_PORT, idDeMessage, messageBonjour, messageResultat, validerOrdre } from '../lib/messages';
import { CLES_STOCKAGE } from '../lib/stockage';

export type Emettre = (ordre: Action) => Promise<ResultatAction>;

export interface OptionsExecutant {
  emettre?: Emettre;
}

export const CAUSE_NON_DISPONIBLE = 'action non disponible';
const CAUSE_ERREUR = 'erreur d’émission';

const emettreParDefaut: Emettre = async () => ({ classe: 'echec', codeHttp: null, cause: CAUSE_NON_DISPONIBLE });

/** Démarre l'exécutant ; renvoie une fonction d'arrêt. */
export function demarrerExecutant(options: OptionsExecutant = {}): () => void {
  const emettre = options.emettre ?? emettreParDefaut;
  let port: chrome.runtime.Port | null = null;
  let arrete = false;

  const traiter = (courant: chrome.runtime.Port, brut: unknown): void => {
    const ordre = validerOrdre(brut);
    if (ordre === null) return;
    const id = idDeMessage(brut) ?? undefined;
    void (async () => {
      let resultat: ResultatAction;
      try {
        resultat = await emettre(ordre);
      } catch {
        // Aucun détail de l'erreur ne quitte le content script.
        resultat = { classe: 'inconnu', codeHttp: null, cause: CAUSE_ERREUR };
      }
      try {
        courant.postMessage(messageResultat(resultat, id));
      } catch {
        // Port fermé entre-temps : la page a déjà conclu à l'interruption.
      }
    })();
  };

  const connecter = (): void => {
    if (arrete || port !== null) return;
    try {
      const courant = chrome.runtime.connect({ name: NOM_PORT });
      port = courant;
      courant.onMessage.addListener((brut: unknown) => traiter(courant, brut));
      courant.onDisconnect.addListener(() => {
        if (port === courant) port = null;
      });
      courant.postMessage(messageBonjour());
    } catch {
      // Extension rechargée : ce content script est orphelin, l'onglet doit être rechargé.
      port = null;
    }
  };

  // Un onglet déjà ouvert se reconnecte quand la page de gestion le demande.
  const surChangement = (changements: Record<string, chrome.storage.StorageChange>, zone: string): void => {
    if (zone === 'local' && changements[CLES_STOCKAGE.signalSynchro]) connecter();
  };
  try {
    chrome.storage.onChanged.addListener(surChangement);
  } catch {
    // Contexte orphelin.
  }

  connecter();

  return () => {
    arrete = true;
    try {
      chrome.storage.onChanged.removeListener(surChangement);
      port?.disconnect();
    } catch {
      // Contexte orphelin.
    }
    port = null;
  };
}
