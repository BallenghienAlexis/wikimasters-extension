// Attente réelle interruptible, partagée par les exécuteurs de fond (Wikipédia, classement par l’IA).

/** Attend `ms` millisecondes ; se termine tout de suite si `signal` est interrompu. */
export const attendreReel = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const minuteur = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(minuteur); resolve(); }, { once: true });
  });
