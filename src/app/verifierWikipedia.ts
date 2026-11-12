// Exécuteur de la vérification Wikipédia : seul fichier de l'application qui appelle `fetch` vers Wikipédia.
// GET en lecture seule vers fr.wikipedia.org, un titre de carte par requête, sans cookie ni en-tête ajouté.
import { ajouterEntree, lireReponse, lireReponseWikidata, themesDepuisCategories, themesDepuisWikidata, titresAVerifier, urlRequete, urlRequeteWikidata, type CacheWikipedia } from '../lib/wikipedia';

export type Transport = (url: string, signal: AbortSignal) => Promise<{ status: number; json: () => Promise<unknown> }>;

const transportReel: Transport = (url, signal) => fetch(url, { method: 'GET', credentials: 'omit', redirect: 'error', signal });

export type RaisonArret = 'manuel' | 'code-http' | 'echecs';

export interface ResultatVerification {
  verifiees: number;
  arret: RaisonArret | null;
  codeHttp: number | null;
}

export interface OptionsVerification {
  titres: string[];
  cache: CacheWikipedia;
  signal: AbortSignal;
  /** Appelé après chaque page lue, avec le cache à jour (à enregistrer). */
  surProgres: (cache: CacheWikipedia, faites: number) => void | Promise<void>;
  maintenant?: () => number;
  attendre?: (ms: number, signal: AbortSignal) => Promise<void>;
  transport?: Transport;
}

/** Cadence fixe : une requête à la fois, une par seconde. */
export const PAUSE_MS = 1000;
const MAX_ECHECS = 3;

const attendreReel = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const minuteur = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(minuteur); resolve(); }, { once: true });
  });

export async function verifierTitres(options: OptionsVerification): Promise<ResultatVerification> {
  const { titres, signal, surProgres, maintenant = Date.now, attendre = attendreReel, transport = transportReel } = options;
  let cache = options.cache;
  let verifiees = 0;
  let echecs = 0;
  for (const titre of titres) {
    if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
    // MediaWiki découpe `titles` sur « | » : un tel titre interrogerait plusieurs pages, on le saute.
    if (titre.includes('|')) {
      cache = ajouterEntree(cache, titre, [], maintenant());
      await surProgres(cache, ++verifiees);
      continue;
    }
    let reponse;
    try {
      reponse = await transport(urlRequete(titre), signal);
    } catch {
      if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
      if (++echecs >= MAX_ECHECS) return { verifiees, arret: 'echecs', codeHttp: null };
      await attendre(PAUSE_MS, signal);
      continue;
    }
    // 403 et 429 : Wikipédia demande de ralentir ou refuse ; on s'arrête sans insister.
    if (reponse.status === 403 || reponse.status === 429) return { verifiees, arret: 'code-http', codeHttp: reponse.status };
    let lecture;
    try {
      lecture = reponse.status === 200 ? lireReponse(await reponse.json()) : ({ type: 'invalide' } as const);
    } catch {
      lecture = { type: 'invalide' } as const;
    }
    if (lecture.type === 'invalide') {
      if (++echecs >= MAX_ECHECS) return { verifiees, arret: 'echecs', codeHttp: null };
    } else {
      echecs = 0;
      // Page absente ou ambiguë : on mémorise « aucun thème » pour ne pas la redemander avant 30 jours.
      let themes = lecture.type === 'ok' ? themesDepuisCategories(lecture.categories, lecture.resume) : [];
      // Wikipédia n'a rien donné : courte description Wikidata (même cadence, titre seul), sinon l'entrée sera relue une fois.
      let wikidata = themes.length > 0;
      if (themes.length === 0) {
        await attendre(PAUSE_MS, signal);
        let r2;
        try {
          r2 = await transport(urlRequeteWikidata(titre), signal);
        } catch {
          if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
          r2 = null;
        }
        if (r2 && (r2.status === 403 || r2.status === 429)) return { verifiees, arret: 'code-http', codeHttp: r2.status };
        if (r2 && r2.status === 200) {
          try {
            const l2 = lireReponseWikidata(await r2.json(), titre);
            if (l2.type === 'ok') {
              themes = themesDepuisWikidata(l2.descriptions);
              wikidata = true;
            }
          } catch {
            // Réponse illisible : l'entrée reste sans marque Wikidata et sera relue.
          }
        }
      }
      cache = ajouterEntree(cache, titre, themes, maintenant(), wikidata);
      verifiees += 1;
      await surProgres(cache, verifiees);
    }
    await attendre(PAUSE_MS, signal);
  }
  return { verifiees, arret: null, codeHttp: null };
}

export interface EtatPlanificateur {
  enCours: boolean;
  /** Message d'arrêt tant que la vérification est suspendue (jusqu'au rechargement de la page). */
  suspendue: string | null;
  faites: number;
  total: number;
}

export interface OptionsPlanificateur {
  chargerCache: () => Promise<CacheWikipedia>;
  /** Appelé avec le cache à jour après chaque page lue (à enregistrer et à afficher). */
  surCache: (cache: CacheWikipedia) => void | Promise<void>;
  maintenant?: () => number;
  attendre?: (ms: number, signal: AbortSignal) => Promise<void>;
  transport?: Transport;
}

export interface Planificateur {
  /** Met en file les titres jamais tentés depuis le chargement de la page ; sans effet si c'est suspendu. */
  demander: (titres: string[]) => void;
  etat: () => EtatPlanificateur;
  abonner: (rappel: () => void) => () => void;
}

const MESSAGE_CODE = (code: number | null): string => `Wikipédia a refusé (${code ?? '?'}) : vérification suspendue jusqu’au rechargement de la page.`;
const MESSAGE_ECHECS = 'Vérification suspendue : trop d’échecs de lecture. Elle reprendra au rechargement de la page.';

/**
 * File unique des vérifications : une seule exécution à la fois, un titre jamais redemandé dans la session,
 * suspension définitive (jusqu'au rechargement) sur 403/429 ou 3 échecs de suite. À créer une seule fois par page.
 */
export function creerPlanificateur(options: OptionsPlanificateur): Planificateur {
  const { chargerCache, surCache, maintenant = Date.now, attendre, transport } = options;
  const file: string[] = [];
  const tentes = new Set<string>();
  const ecouteurs = new Set<() => void>();
  let etat: EtatPlanificateur = { enCours: false, suspendue: null, faites: 0, total: 0 };
  let cache: CacheWikipedia | null = null;

  const changer = (suite: Partial<EtatPlanificateur>): void => {
    etat = { ...etat, ...suite };
    ecouteurs.forEach((rappel) => rappel());
  };

  async function boucle(): Promise<void> {
    changer({ enCours: true, faites: 0, total: file.length });
    let echecs = 0;
    try {
      cache ??= await chargerCache();
      const signal = new AbortController().signal;
      while (file.length > 0) {
        const titre = file.shift() as string;
        if (titresAVerifier([titre], cache, maintenant()).length === 0) continue;
        const r = await verifierTitres({
          titres: [titre],
          cache,
          signal,
          maintenant,
          ...(attendre ? { attendre } : {}),
          ...(transport ? { transport } : {}),
          surProgres: async (nouveau) => {
            cache = nouveau;
            await surCache(nouveau);
          },
        });
        if (r.arret === 'code-http') return void changer({ suspendue: MESSAGE_CODE(r.codeHttp) });
        // Aucune page lue et aucun arrêt : réponse illisible ou erreur réseau.
        echecs = r.verifiees === 0 ? echecs + 1 : 0;
        if (echecs >= 3) return void changer({ suspendue: MESSAGE_ECHECS });
        changer({ faites: etat.faites + 1, total: etat.faites + 1 + file.length });
      }
    } catch {
      changer({ suspendue: 'Enregistrement du cache Wikipédia impossible : vérification suspendue.' });
    } finally {
      file.length = 0;
      changer({ enCours: false });
    }
  }

  return {
    demander(titres) {
      if (etat.suspendue !== null) return;
      for (const titre of titres) {
        if (tentes.has(titre)) continue;
        tentes.add(titre);
        file.push(titre);
      }
      if (!etat.enCours && file.length > 0) void boucle();
      else if (etat.enCours) changer({ total: etat.faites + file.length });
    },
    etat: () => etat,
    abonner(rappel) {
      ecouteurs.add(rappel);
      return () => ecouteurs.delete(rappel);
    },
  };
}
