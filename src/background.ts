// Service worker éphémère : aucun état en mémoire.
import { MESSAGE_OUVRIR_PAGE_PC } from './content/pagePc';
import { chargerSynchroPc, enregistrerPhaseDemarrage } from './lib/stockage';

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('collection.html') });
});

// Démarrage obligatoire (Alexis, 2026-11-25) : à chaque ouverture du navigateur ou mise à jour de l'extension, tout est bloqué
// jusqu'à ce que la fenêtre de démarrage ait repris le Drive, lu le site et sauvegardé. Sans dossier configuré, rien n'est bloqué.
chrome.runtime.onStartup.addListener(() => void enregistrerPhaseDemarrage('bloque').catch(() => undefined));
chrome.runtime.onInstalled.addListener(() => void enregistrerPhaseDemarrage('bloque').catch(() => undefined));

/**
 * Synchro entre PC : ouvre la page de gestion en arrière-plan (onglet inactif) si elle est fermée, car elle seule lit et écrit le dossier partagé.
 * Seulement si un dossier est configuré ; jamais en double ; message accepté du seul content script de cette extension.
 */
chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (sender.id !== chrome.runtime.id || typeof message !== 'object' || message === null || (message as { type?: unknown }).type !== MESSAGE_OUVRIR_PAGE_PC) return;
  void (async () => {
    const memoire = await chargerSynchroPc();
    if (memoire?.actif !== true) return;
    const page = chrome.runtime.getURL('collection.html');
    const ouvertes = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
    if (ouvertes.some((c) => c.documentUrl?.startsWith(page))) return;
    await chrome.tabs.create({ url: page, active: (message as { premierPlan?: unknown }).premierPlan === true });
  })().catch(() => undefined);
});
