// Exécuteur du classement par l’API Claude : seul fichier de l’application qui appelle `fetch` vers api.anthropic.com.
// POST d’un lot de cartes (titre et description publics, rien du compte) avec la clé API d’Alexis, saisie à chaque utilisation
// et jamais stockée, journalisée ni recopiée dans un message d’erreur. Voir AGENTS.md § Classement par l’API Claude.
import { ajouterAuCache, corpsRequete, decouperEnLotsIA, lireReponseIA, URL_API_IA, VERSION_API_IA, type CacheIA, type CarteAClasser } from '../lib/classificationIA';

export type TransportIA = (url: string, init: { headers: Record<string, string>; body: string }, signal: AbortSignal) => Promise<{ status: number; json: () => Promise<unknown> }>;

const transportReel: TransportIA = (url, init, signal) => fetch(url, { method: 'POST', headers: init.headers, body: init.body, credentials: 'omit', redirect: 'error', signal });

export type RaisonArretIA = 'manuel' | 'code-http' | 'echecs' | 'aucune-lue';

/** Texte d’erreur affichable : sans clé (ni la clé saisie, ni rien qui ressemble à « sk-ant-… »), sur une ligne, tronqué. */
export function assainirDetail(brut: string, cle: string): string {
  let t = brut.replace(/\s+/g, ' ').trim();
  if (cle.length >= 4) t = t.split(cle).join('[clé]');
  return t.replace(/sk-ant-[\w-]+/gi, '[clé]').slice(0, 200);
}

/** Type et message d’une réponse d’erreur de l’API (`{"error":{"type":…,"message":…}}`), sinon chaîne vide. */
function detailApi(corps: unknown): string {
  const e = typeof corps === 'object' && corps !== null ? (corps as Record<string, unknown>)['error'] : null;
  if (typeof e !== 'object' || e === null) return '';
  const { type, message } = e as Record<string, unknown>;
  return [typeof type === 'string' ? type : '', typeof message === 'string' ? message : ''].filter(Boolean).join(' : ');
}

export interface ResultatClassement {
  /** Cartes dont la réponse a été lue et mise en cache (thèmes vides compris). */
  lues: number;
  arret: RaisonArretIA | null;
  codeHttp: number | null;
  /** Lots sautés (erreur réseau, serveur ou réponse inexploitable) pendant l’exécution. */
  sautes: number;
  /** Dernière erreur lisible (code, type et message de l’API ou erreur réseau), sans clé. */
  detail: string | null;
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
/** Échecs d’affilée tolérés (réponse mal formée, erreur réseau ou serveur) : le lot en cause est sauté, la suite continue. */
const MAX_ECHECS = 5;

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
  let detail: string | null = null;
  let sautes = 0;
  const fini = (arret: RaisonArretIA | null, codeHttp: number | null): ResultatClassement => ({ lues, arret, codeHttp, sautes, detail, cache });
  for (const lot of decouperEnLotsIA(cartes)) {
    if (signal.aborted) return fini('manuel', null);
    let reponse;
    try {
      reponse = await transport(
        URL_API_IA,
        { headers: { 'x-api-key': cle, 'anthropic-version': VERSION_API_IA, 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(corpsRequete(lot)) },
        signal,
      );
    } catch (e) {
      if (signal.aborted) return fini('manuel', null);
      detail = assainirDetail(`Requête impossible (${e instanceof Error ? `${e.name} : ${e.message}` : 'erreur réseau'})`, cle);
      sautes++;
      if (++echecs >= MAX_ECHECS) return fini('echecs', null);
      await attendre(PAUSE_IA_MS, signal);
      continue;
    }
    let corps: unknown;
    try {
      corps = await reponse.json();
    } catch {
      corps = null;
    }
    if (reponse.status !== 200) detail = assainirDetail(`HTTP ${reponse.status}${detailApi(corps) ? ` — ${detailApi(corps)}` : ''}`, cle);
    // Clé refusée, accès interdit, limite de débit ou crédit épuisé : inutile d’insister.
    if (reponse.status === 401 || reponse.status === 403 || reponse.status === 429 || reponse.status === 402) return fini('code-http', reponse.status);
    // Autre refus 4xx (400, 404, 413…) : la requête elle-même est refusée, la réessayer serait inutile.
    if (reponse.status >= 400 && reponse.status < 500) return fini('code-http', reponse.status);
    const resultats = reponse.status === 200 ? lireReponseIA(corps, lot) : new Map<string, string[]>();
    if (reponse.status === 200 && resultats.size === 0) detail = 'Réponse reçue mais inexploitable (JSON attendu absent ou invalide).';
    if (resultats.size === 0) {
      sautes++;
      if (++echecs >= MAX_ECHECS) return fini('echecs', reponse.status === 200 ? null : reponse.status);
    } else {
      echecs = 0;
      cache = ajouterAuCache(cache, resultats);
      lues += resultats.size;
      await surProgres(cache, lues);
    }
    await attendre(PAUSE_IA_MS, signal);
  }
  // Aucun lot lu alors qu’il y en avait à lire : ce n’est pas un succès, l’échec est annoncé avec son détail.
  return lues === 0 && echecs > 0 ? fini('aucune-lue', null) : fini(null, null);
}
