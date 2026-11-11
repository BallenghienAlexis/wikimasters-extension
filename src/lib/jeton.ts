// Seul module autorisé à lire le jeton de session du site (AGENTS.md, « Ne jamais faire »).
// Le jeton n’est jamais gardé, journalisé, stocké ni renvoyé ailleurs qu’à l’appelant.
// Le jeton est lu dans le cookie de session du site (relevé du 2026-11-11), en mémoire seulement :
// seuls `access_token` et l’identifiant du joueur (`sub`) sont extraits, jamais le jeton de rafraîchissement.
import { NOM_COOKIE_SESSION, ORIGINE_REST } from '../config/synchro';

export type SourceJeton = () => string | null;

/** Source par défaut : ne lit rien. */
export const SOURCE_NON_RELEVEE: SourceJeton = () => null;

const ORIGINE_SITE = 'https://www.wiki-masters.com';
/** Origines vers lesquelles l’en-tête d’authentification peut partir : le site et son hôte REST. */
const ORIGINES_AUTORISEES: readonly string[] = [ORIGINE_SITE, ORIGINE_REST];

function origineDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * En-tête d’authentification pour une requête vers l’origine du site, ou `null`.
 * La source n’est appelée qu’après les contrôles d’origine, et à chaque appel.
 */
export function enteteAuthentification(
  url: string,
  origineOnglet: string,
  nomEntete: string,
  source: SourceJeton = SOURCE_NON_RELEVEE,
): { nom: string; valeur: string } | null {
  if (origineOnglet !== ORIGINE_SITE) return null;
  const origineUrl = origineDe(url);
  if (origineUrl === null || !ORIGINES_AUTORISEES.includes(origineUrl)) return null;
  const valeur = source();
  if (!valeur) return null;
  return { nom: nomEntete, valeur };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decoderBase64(brut: string): string | null {
  try {
    const binaire = atob(brut.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

function valeurCookie(cookies: string, nom: string): string | null {
  for (const morceau of cookies.split(';')) {
    const egal = morceau.indexOf('=');
    if (egal < 0 || morceau.slice(0, egal).trim() !== nom) continue;
    try {
      return decodeURIComponent(morceau.slice(egal + 1).trim());
    } catch {
      return morceau.slice(egal + 1).trim();
    }
  }
  return null;
}

export interface SessionLue {
  /** Jeton d’accès : à ne jamais stocker, journaliser ni afficher. */
  jeton: string;
  /** Identifiant du joueur (`sub` du jeton). */
  idJoueur: string;
}

/**
 * Lit la session dans le cookie du site (en un ou plusieurs morceaux `nom`, `nom.0`, `nom.1`…).
 * Renvoie `null` si le cookie manque, est illisible ou si le jeton a expiré.
 */
export function lireSession(cookies: string, maintenantMs: number): SessionLue | null {
  let valeur = valeurCookie(cookies, NOM_COOKIE_SESSION);
  if (valeur === null) {
    valeur = '';
    for (let n = 0; n < 10; n++) {
      const morceau = valeurCookie(cookies, `${NOM_COOKIE_SESSION}.${n}`);
      if (morceau === null) break;
      valeur += morceau;
    }
    if (valeur === '') return null;
  }
  if (!valeur.startsWith('base64-')) return null;
  const texte = decoderBase64(valeur.slice('base64-'.length));
  if (texte === null) return null;
  let session: unknown;
  try {
    session = JSON.parse(texte);
  } catch {
    return null;
  }
  if (typeof session !== 'object' || session === null) return null;
  const { access_token: jeton, expires_at: expire } = session as Record<string, unknown>;
  if (typeof jeton !== 'string' || jeton === '') return null;
  const parties = jeton.split('.');
  const charge = parties.length === 3 ? decoderBase64(parties[1]!) : null;
  if (charge === null) return null;
  try {
    const { sub, exp } = JSON.parse(charge) as Record<string, unknown>;
    // Expiration : celle de la session, à défaut celle du jeton ; sans aucune des deux, refus.
    const echeance = typeof expire === 'number' ? expire : typeof exp === 'number' ? exp : null;
    if (echeance === null || echeance * 1000 <= maintenantMs) return null;
    if (typeof sub !== 'string' || !UUID.test(sub)) return null;
    return { jeton, idJoueur: sub };
  } catch {
    return null;
  }
}

/** Session courante lue dans les cookies de la page ; jamais mise en cache. */
export function sessionCourante(): SessionLue | null {
  try {
    return lireSession(document.cookie, Date.now());
  } catch {
    return null;
  }
}
