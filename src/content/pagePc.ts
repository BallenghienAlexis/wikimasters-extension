// Synchro entre PC : le dossier partagé n'est lisible et inscriptible que par la page de gestion (poignée gardée dans l'IndexedDB de l'extension).
// Le content script demande donc au service worker de l'ouvrir en arrière-plan quand elle est fermée ; aucune requête réseau.
import { demarragePermet, FUSION_PC_RECENTE_MS, synchroPcAJour } from '../lib/stockage';

export const MESSAGE_OUVRIR_PAGE_PC = 'wm-ouvrir-page-synchro-pc';
const VERIFICATION_MS = 60_000;

/** Demande d'ouverture ; sans effet si la page est déjà ouverte (le service worker le vérifie). */
export function demanderPageSynchroPc(premierPlan = false): void {
  try {
    void chrome.runtime.sendMessage({ type: MESSAGE_OUVRIR_PAGE_PC, premierPlan }).catch(() => undefined);
  } catch {
    // Contexte d'extension invalidé (rechargement) : rien à faire.
  }
}

/** Tant que l'onglet WikiMasters est ouvert : si la synchro entre PC est configurée et que les autres PC ne sont plus lus, rouvre la page. */
export function garderPageSynchroPcOuverte(
  demander: (premierPlan?: boolean) => void = demanderPageSynchroPc,
  controle: () => Promise<boolean> = () => synchroPcAJour(Date.now(), FUSION_PC_RECENTE_MS),
  demarrageFait: () => Promise<boolean> = () => demarragePermet('pret'),
): () => void {
  // Démarrage obligatoire non fait : la fenêtre de démarrage doit être visible, la page passe au premier plan.
  const verifier = (): void =>
    void demarrageFait()
      .then(async (fait) => {
        if (!fait) demander(true);
        else if (!(await controle())) demander();
      })
      .catch(() => undefined);
  const minuteur = setInterval(verifier, VERIFICATION_MS);
  verifier();
  return () => clearInterval(minuteur);
}
