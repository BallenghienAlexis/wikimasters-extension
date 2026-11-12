// Vérification des thèmes d'une carte d'après les catégories de sa vraie page Wikipédia.
// Logique pure (URL, lecture de la réponse, cache) : l'appel réseau est dans `src/app/verifierWikipedia.ts`.
import { IDS_THEMES, themesDeTexte } from './themes';

export const HOTE_WIKIPEDIA = 'https://fr.wikipedia.org';
export const HOTE_WIKIDATA = 'https://www.wikidata.org';
/** Durée de validité d'une entrée du cache : 30 jours. */
export const DUREE_CACHE_MS = 30 * 24 * 3600 * 1000;
const MAX_ENTREES = 20_000;
const MAX_CATEGORIES = 500;
const MAX_RESUME = 2000;

export interface EntreeWikipedia {
  /** Identifiants de thèmes (parents compris) ; liste vide = page lue, aucun thème reconnu. */
  themes: string[];
  verifieLe: number;
  /** Vrai quand le résumé de la page a aussi servi (entrées plus anciennes : catégories seules, relues une fois). */
  avecResume?: true;
  /** Vrai quand Wikidata a été interrogé (page Wikipédia sans thème) ; sans lui, une entrée sans thème est relue une fois. */
  avecWikidata?: true;
}

export interface CacheWikipedia {
  version: 1;
  /** Clé : titre de la carte (= titre de la page Wikipédia). */
  entrees: Record<string, EntreeWikipedia>;
}

export type LectureWikipedia =
  | { type: 'ok'; categories: string[]; resume: string }
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
    prop: 'categories|pageprops|extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    ppprop: 'disambiguation',
    cllimit: 'max',
    clshow: '!hidden',
    titles: titre,
  });
  return `${HOTE_WIKIPEDIA}/w/api.php?${params.toString()}`;
}

/** GET en lecture seule : recherche d'une entité par son titre ; seuls l'étiquette et la courte description sont lues. */
export function urlRequeteWikidata(titre: string): string {
  const params = new URLSearchParams({ action: 'wbsearchentities', format: 'json', language: 'fr', uselang: 'fr', type: 'item', limit: '5', search: titre });
  return `${HOTE_WIKIDATA}/w/api.php?${params.toString()}`;
}

export type LectureWikidata = { type: 'ok'; descriptions: string[] } | { type: 'invalide' };

const cle = (texte: string): string => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Liste blanche : seules les descriptions des entités dont l'étiquette est exactement le titre sont retenues. */
export function lireReponseWikidata(brut: unknown, titre: string): LectureWikidata {
  if (!estObjet(brut) || !Array.isArray(brut.search) || brut.search.length > 50) return { type: 'invalide' };
  const descriptions: string[] = [];
  for (const e of brut.search) {
    if (!estObjet(e)) return { type: 'invalide' };
    if (typeof e.label !== 'string' || typeof e.description !== 'string' || e.description.length > 300) continue;
    if (cle(e.label) === cle(titre)) descriptions.push(e.description);
  }
  return { type: 'ok', descriptions };
}

/** Thèmes déduits des courtes descriptions Wikidata (« barrage en France »), avec les mots-clés ordinaires. */
export const themesDepuisWikidata = (descriptions: string[]): string[] => themesDeTexte(descriptions.join(' . '));

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Liste blanche : seuls les titres de catégories sont retenus, tout le reste de la réponse est ignoré. */
export function lireReponse(brut: unknown): LectureWikipedia {
  if (!estObjet(brut) || !estObjet(brut.query) || !Array.isArray(brut.query.pages) || brut.query.pages.length !== 1) return { type: 'invalide' };
  const page: unknown = brut.query.pages[0];
  if (!estObjet(page)) return { type: 'invalide' };
  if (page.missing === true || page.invalid === true) return { type: 'introuvable' };
  if (estObjet(page.pageprops) && 'disambiguation' in page.pageprops) return { type: 'ambigue' };
  // Résumé : introduction de la page en texte brut, bornée ; utile quand les catégories ne disent rien.
  const resume = typeof page.extract === 'string' ? page.extract.slice(0, MAX_RESUME) : '';
  if (page.categories === undefined) return { type: 'ok', categories: [], resume };
  if (!Array.isArray(page.categories) || page.categories.length > MAX_CATEGORIES) return { type: 'invalide' };
  const categories: string[] = [];
  for (const c of page.categories) {
    if (!estObjet(c) || typeof c.title !== 'string' || c.title.length > 300) return { type: 'invalide' };
    categories.push(c.title.replace(/^[^:]+:/, ''));
  }
  return { type: 'ok', categories, resume };
}

// Catégories de maintenance ou d'organisation du site : aucune information sur le sujet.
const CATEGORIE_TECHNIQUE = /^(articles? |pages? |wikipedia|portail|ebauche|homonymie)/;

/** Thèmes déduits des catégories, avec les mêmes règles que les mots-clés locaux. */
export function themesDepuisCategories(categories: string[], resume = ''): string[] {
  const utiles = categories.filter((c) => !CATEGORIE_TECHNIQUE.test(c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));
  const themes = new Set(themesDeTexte(utiles.join(' . '), true));
  // Le résumé complète les catégories (mots-clés ordinaires, sans les motifs réservés aux catégories).
  for (const id of themesDeTexte(resume)) themes.add(id);
  return [...themes];
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
    entrees[cle] = {
      themes: e.themes.filter((t): t is string => typeof t === 'string' && connus.has(t)),
      verifieLe: e.verifieLe,
      ...(e.avecResume === true ? { avecResume: true as const } : {}),
      ...(e.avecWikidata === true ? { avecWikidata: true as const } : {}),
    };
  }
  return { version: 1, entrees: { ...entrees } };
}

export function ajouterEntree(cache: CacheWikipedia, titre: string, themes: string[], maintenant: number, wikidata = false): CacheWikipedia {
  const entree: EntreeWikipedia = { themes: [...themes], verifieLe: maintenant, avecResume: true, ...(wikidata ? { avecWikidata: true as const } : {}) };
  return { version: 1, entrees: { ...cache.entrees, [titre]: entree } };
}

/** Titres sans entrée valide dans le cache, sans doublon, dans l'ordre des cartes. */
export function titresAVerifier(titres: string[], cache: CacheWikipedia, maintenant: number): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const titre of titres) {
    if (vus.has(titre)) continue;
    vus.add(titre);
    const entree = Object.hasOwn(cache.entrees, titre) ? cache.entrees[titre] : undefined;
    // Une entrée sans thème et sans résumé (ancienne version) est relue une fois pour profiter du résumé.
    if (entree === undefined || maintenant - entree.verifieLe >= DUREE_CACHE_MS || (entree.themes.length === 0 && (entree.avecResume !== true || entree.avecWikidata !== true))) resultat.push(titre);
  }
  return resultat;
}

export function themesParTitre(cache: CacheWikipedia): Map<string, string[]> {
  return new Map(Object.entries(cache.entrees).map(([titre, e]) => [titre, e.themes]));
}
