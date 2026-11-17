// Verrou de requête partagé entre la synchro globale et le suivi des mises en vente (Alexis, 2026-11-17).
// Il ne remplace pas le bail de la synchro (qui couvre toute une exécution) : il ne tient que le temps d’UNE requête,
// pour qu’il n’y ait jamais deux requêtes en vol vers le site, sans que le suivi attende la fin d’une synchro globale.
// Il tient aussi l’heure du dernier début de requête : 0,2 s plus gigue au minimum entre deux requêtes de l’extension.
// Logique pure : horloge et stockage injectés, aucune requête ici.

/** Durée de vie d’un verrou : un onglet fermé en pleine requête ne bloque personne plus longtemps. */
export const DUREE_VERROU_REQUETE_MS = 20_000;
/** Intervalle de sondage quand le verrou est tenu par un autre onglet. */
export const SONDAGE_VERROU_MS = 100;

export interface EtatVerrouRequete {
  /** Propriétaire courant (identifiant aléatoire de l’appelant), `null` si libre. */
  proprio: string | null;
  /** Fin de validité du verrou. */
  jusqua: number;
  /** Début de la dernière requête partie sous ce verrou. */
  derniere: number;
}

export interface DependancesVerrouRequete {
  now: () => number;
  attendre: (ms: number) => Promise<void>;
  gigue: () => number;
  /** Intervalle minimal entre deux débuts de requête. */
  intervalle: number;
  lire: () => Promise<EtatVerrouRequete | null>;
  ecrire: (e: EtatVerrouRequete) => Promise<void>;
  identifiant: () => string;
}

export type AvecVerrouRequete = <T>(requete: () => Promise<T>) => Promise<T>;

/**
 * Renvoie un exécuteur : `avec(f)` prend le verrou (attente illimitée, il expire de lui-même), respecte l’intervalle
 * depuis la dernière requête de l’extension, exécute `f`, puis libère. Chaîne locale : deux appels du même onglet
 * ne se chevauchent pas.
 */
export function creerVerrouRequete(deps: DependancesVerrouRequete): AvecVerrouRequete {
  let chaine: Promise<unknown> = Promise.resolve();

  async function prendre(moi: string): Promise<void> {
    for (;;) {
      const actuel = await deps.lire().catch(() => null);
      const maintenant = deps.now();
      const libre = actuel === null || actuel.proprio === null || actuel.proprio === moi || actuel.jusqua <= maintenant;
      if (libre) {
        const derniere = actuel?.derniere ?? 0;
        await deps.ecrire({ proprio: moi, jusqua: maintenant + DUREE_VERROU_REQUETE_MS, derniere });
        // Relu : si un autre onglet a écrit entre-temps, on recommence.
        const relu = await deps.lire().catch(() => null);
        if (relu !== null && relu.proprio === moi) return;
      }
      await deps.attendre(SONDAGE_VERROU_MS);
    }
  }

  return async function avec<T>(requete: () => Promise<T>): Promise<T> {
    const tour = chaine.then(async () => {
      const moi = deps.identifiant();
      await prendre(moi);
      try {
        const etat = await deps.lire().catch(() => null);
        const derniere = etat?.derniere ?? 0;
        const depart = derniere + deps.intervalle + deps.gigue();
        if (depart > deps.now()) await deps.attendre(depart - deps.now());
        await deps.ecrire({ proprio: moi, jusqua: deps.now() + DUREE_VERROU_REQUETE_MS, derniere: deps.now() });
        return await requete();
      } finally {
        const fin = await deps.lire().catch(() => null);
        if (fin !== null && fin.proprio === moi) await deps.ecrire({ ...fin, proprio: null }).catch(() => undefined);
      }
    });
    chaine = tour.catch(() => undefined);
    return tour;
  };
}
