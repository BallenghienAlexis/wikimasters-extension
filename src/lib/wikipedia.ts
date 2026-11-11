// Vérification des thèmes d'une carte d'après les catégories de sa vraie page Wikipédia.
// Logique pure (URL, lecture de la réponse, cache) : l'appel réseau est dans `src/app/verifierWikipedia.ts`.
import { IDS_THEMES, themesDeTexte } from './themes';

export const HOTE_WIKIPEDIA = 'https://fr.wikipedia.org';
/** Durée de validité d'une entrée du cache : 30 jours. */
export const DUREE_CACHE_MS = 30 * 24 * 3600 * 1000;
const MAX_ENTREES = 20_000;
const MAX_CATEGORIES = 500;

export interface EntreeWikipedia {
  /** Identifiants de thèmes (parents compris) ; liste vide = page lue, aucun thème reconnu. */
  themes: string[];
  verifieLe: number;
}

export interface CacheWikipedia {
  version: 1;
  /** Clé : titre de la carte (= titre de la page Wikipédia). */
  entrees: Record<string, EntreeWikipedia>;
}

export type LectureWikipedia =
  | { type: 'ok'; categories: string[] }
  | { type: 'introuvable' }
  | { type: 'ambigue' }
  | { type: 'invalide' };

export const cacheVide = (): CacheWikipedia => ({ version: 1, entrees: {} });

/** GET en lecture seule : catégories visibles et indicateur d'homonymie de la page, redirections suivies. */
export function urlRequete(titre: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'categories|pageprops',
    ppprop: 'disambiguation',
    cllimit: 'max',
    clshow: '!hidden',
    titles: titre,
  });
  return `${HOTE_WIKIPEDIA}/w/api.php?${params.toString()}`;
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Liste blanche : seuls les titres de catégories sont retenus, tout le reste de la réponse est ignoré. */
export function lireReponse(brut: unknown): LectureWikipedia {
  if (!estObjet(brut) || !estObjet(brut.query) || !Array.isArray(brut.query.pages) || brut.query.pages.length !== 1) return { type: 'invalide' };
  const page: unknown = brut.query.pages[0];
  if (!estObjet(page)) return { type: 'invalide' };
  if (page.missing === true || page.invalid === true) return { type: 'introuvable' };
  if (estObjet(page.pageprops) && 'disambiguation' in page.pageprops) return { type: 'ambigue' };
  if (page.categories === undefined) return { type: 'ok', categories: [] };
  if (!Array.isArray(page.categories) || page.categories.length > MAX_CATEGORIES) return { type: 'invalide' };
  const categories: string[] = [];
  for (const c of page.categories) {
    if (!estObjet(c) || typeof c.title !== 'string' || c.title.length > 300) return { type: 'invalide' };
    categories.push(c.title.replace(/^[^:]+:/, ''));
  }
  return { type: 'ok', categories };
}

// Catégories de maintenance ou d'organisation du site : aucune information sur le sujet.
const CATEGORIE_TECHNIQUE = /^(articles? |pages? |wikipedia|portail|ebauche|homonymie)/;

/** Thèmes déduits des catégories, avec les mêmes règles que les mots-clés locaux. */
export function themesDepuisCategories(categories: string[]): string[] {
  const utiles = categories.filter((c) => !CATEGORIE_TECHNIQUE.test(c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));
  return themesDeTexte(utiles.join(' . '), true);
}

export function validerCache(brut: unknown): CacheWikipedia | null {
  if (!estObjet(brut) || brut.version !== 1 || !estObjet(brut.entrees)) return null;
  const cles = Object.keys(brut.entrees);
  if (cles.length > MAX_ENTREES) return null;
  const connus = new Set(IDS_THEMES);
  const entrees: Record<string, EntreeWikipedia> = Object.create(null) as Record<string, EntreeWikipedia>;
  for (const cle of cles) {
    const e = brut.entrees[cle];
    if (!estObjet(e) || !Array.isArray(e.themes) || typeof e.verifieLe !== 'number' || !Number.isSafeInteger(e.verifieLe) || e.verifieLe < 0) return null;
    // Un identifiant inconnu (thème retiré depuis) est écarté sans invalider le reste.
    entrees[cle] = { themes: e.themes.filter((t): t is string => typeof t === 'string' && connus.has(t)), verifieLe: e.verifieLe };
  }
  return { version: 1, entrees: { ...entrees } };
}

export function ajouterEntree(cache: CacheWikipedia, titre: string, themes: string[], maintenant: number): CacheWikipedia {
  return { version: 1, entrees: { ...cache.entrees, [titre]: { themes: [...themes], verifieLe: maintenant } } };
}

/** Titres sans entrée valide dans le cache, sans doublon, dans l'ordre des cartes. */
export function titresAVerifier(titres: string[], cache: CacheWikipedia, maintenant: number): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const titre of titres) {
    if (vus.has(titre)) continue;
    vus.add(titre);
    const entree = Object.hasOwn(cache.entrees, titre) ? cache.entrees[titre] : undefined;
    if (entree === undefined || maintenant - entree.verifieLe >= DUREE_CACHE_MS) resultat.push(titre);
  }
  return resultat;
}

export function themesParTitre(cache: CacheWikipedia): Map<string, string[]> {
  return new Map(Object.entries(cache.entrees).map(([titre, e]) => [titre, e.themes]));
}
