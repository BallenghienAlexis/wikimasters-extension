// Exécuteur de la vérification Wikipédia : seul fichier de l'application qui appelle `fetch` vers Wikipédia.
// GET en lecture seule vers fr.wikipedia.org, un titre de carte par requête, sans cookie ni en-tête ajouté.
import { ajouterEntree, lireReponse, themesDepuisCategories, urlRequete, type CacheWikipedia } from '../lib/wikipedia';

export type Transport = (url: string, signal: AbortSignal) => Promise<{ status: number; json: () => Promise<unknown> }>;

const transportReel: Transport = (url, signal) => fetch(url, { method: 'GET', credentials: 'omit', signal });

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
      cache = ajouterEntree(cache, titre, lecture.type === 'ok' ? themesDepuisCategories(lecture.categories) : [], maintenant());
      verifiees += 1;
      await surProgres(cache, verifiees);
    }
    await attendre(PAUSE_MS, signal);
  }
  return { verifiees, arret: null, codeHttp: null };
}
