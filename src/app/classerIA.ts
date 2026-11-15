// Exécuteur du classement par l’API Claude : seul fichier de l’application qui appelle `fetch` vers api.anthropic.com.
// POST d’un lot de cartes (titre et description publics, rien du compte) avec la clé API d’Alexis, saisie à chaque utilisation
// et jamais stockée, journalisée ni recopiée dans un message d’erreur. Voir AGENTS.md § Classement par l’API Claude.
import { ajouterAuCache, corpsRequete, decouperEnLotsIA, lireReponseIA, URL_API_IA, VERSION_API_IA, type CacheIA, type CarteAClasser } from '../lib/classificationIA';

export type TransportIA = (url: string, init: { headers: Record<string, string>; body: string }, signal: AbortSignal) => Promise<{ status: number; json: () => Promise<unknown> }>;

const transportReel: TransportIA = (url, init, signal) => fetch(url, { method: 'POST', headers: init.headers, body: init.body, credentials: 'omit', redirect: 'error', signal });

export type RaisonArretIA = 'manuel' | 'code-http' | 'echecs';

export interface ResultatClassement {
  /** Cartes dont la réponse a été lue et mise en cache (thèmes vides compris). */
  lues: number;
  arret: RaisonArretIA | null;
  codeHttp: number | null;
  cache: CacheIA;
}

export interface OptionsClassement {
  cartes: readonly CarteAClasser[];
  /** Clé API de l’utilisateur : envoyée dans l’en-tête `x-api-key` seulement. */
  cle: string;
  cache: CacheIA;
  signal: AbortSignal;
  /** Appelé après chaque lot, avec le cache à jour (à enregistrer). */
  surProgres: (cache: CacheIA, lues: number) => void | Promise<void>;
  transport?: TransportIA;
  attendre?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/** Une requête à la fois, une demi-seconde entre deux. */
export const PAUSE_IA_MS = 500;
const MAX_ECHECS = 3;

const attendreReel = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const minuteur = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(minuteur); resolve(); }, { once: true });
  });

export async function classerCartes(options: OptionsClassement): Promise<ResultatClassement> {
  const { cartes, cle, signal, surProgres, transport = transportReel, attendre = attendreReel } = options;
  let cache = options.cache;
  let lues = 0;
  let echecs = 0;
  const fini = (arret: RaisonArretIA | null, codeHttp: number | null): ResultatClassement => ({ lues, arret, codeHttp, cache });
  for (const lot of decouperEnLotsIA(cartes)) {
    if (signal.aborted) return fini('manuel', null);
    let reponse;
    try {
      reponse = await transport(
        URL_API_IA,
        { headers: { 'x-api-key': cle, 'anthropic-version': VERSION_API_IA, 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(corpsRequete(lot)) },
        signal,
      );
    } catch {
      if (signal.aborted) return fini('manuel', null);
      if (++echecs >= MAX_ECHECS) return fini('echecs', null);
      continue;
    }
    // Clé refusée, accès interdit, limite de débit ou crédit épuisé : inutile d’insister.
    if (reponse.status === 401 || reponse.status === 403 || reponse.status === 429 || reponse.status === 402) return fini('code-http', reponse.status);
    let corps: unknown = null;
    if (reponse.status === 200) {
      try {
        corps = await reponse.json();
      } catch {
        corps = null;
      }
    }
    const resultats = reponse.status === 200 ? lireReponseIA(corps, lot) : new Map<string, string[]>();
    if (resultats.size === 0) {
      if (++echecs >= MAX_ECHECS) return fini('echecs', reponse.status === 200 ? null : reponse.status);
    } else {
      echecs = 0;
      cache = ajouterAuCache(cache, resultats);
      lues += resultats.size;
      await surProgres(cache, lues);
    }
    await attendre(PAUSE_IA_MS, signal);
  }
  return fini(null, null);
}
