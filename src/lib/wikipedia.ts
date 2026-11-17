// Vérification des thèmes d'une carte d'après les catégories de sa vraie page Wikipédia.
// Logique pure (URL, lecture de la réponse, cache) : l'appel réseau est dans `src/app/verifierWikipedia.ts`.
import { normaliser } from './collection';
import { definition, genreDe, type Genre } from './sens';
import { IDS_THEMES, themesDeTexte, themesDirectsDeTexte, type SignauxPage } from './themes';
import { estObjet } from './valider';

export const HOTE_WIKIPEDIA = 'https://fr.wikipedia.org';
export const HOTE_WIKIDATA = 'https://www.wikidata.org';
/** Durée de validité d'une entrée du cache : 30 jours. */
export const DUREE_CACHE_MS = 30 * 24 * 3600 * 1000;
const MAX_ENTREES = 20_000;
const MAX_CATEGORIES = 500;
const MAX_RESUME = 2000;
const cle = (texte: string): string => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export interface EntreeWikipedia {
  /** Identifiants de thèmes (parents compris) ; liste vide = page lue, aucun thème reconnu. */
  themes: string[];
  verifieLe: number;
  /** Vrai quand le résumé de la page a aussi servi (entrées plus anciennes : catégories seules, relues une fois). */
  avecResume?: true;
  /** Vrai quand Wikidata a été interrogé (page Wikipédia sans thème) ; sans lui, une entrée sans thème est relue une fois. */
  avecWikidata?: true;
  /** Signaux lus par le sens (définition, catégories, nature du sujet) ; absents des entrées plus anciennes. */
  signaux?: SignauxPage;
  /** Vrai quand la lecture des entrées d'une page d'homonymie a été prévue (entrées plus anciennes sans thème : relues une fois, 2026-11-17). */
  avecHomonymie?: true;
  /** Vrai quand le thème « Noms et prénoms » existait au moment de la lecture ; sans lui, une entrée sans thème est relue une fois (2026-11-17). */
  avecNoms?: true;
  /** Catégories utiles de la page (titres publics de Wikipédia, 40 au plus) : base des thèmes appris ; absentes des entrées plus anciennes, relues une fois (2026-11-17). */
  categories?: string[];
  /** Vrai quand les thèmes ont été calculés sans compter les noms propres composés (« Bee Train ») ; sinon relue une fois (2026-11-14). */
  nomsPropres?: true;
}

export interface CacheWikipedia {
  version: 1;
  /** Clé : titre de la carte (= titre de la page Wikipédia). */
  entrees: Record<string, EntreeWikipedia>;
}

export type LectureWikipedia =
  | { type: 'ok'; categories: string[]; resume: string; qid?: string }
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
    ppprop: 'disambiguation|wikibase_item',
    cllimit: 'max',
    clshow: '!hidden',
    titles: titre,
  });
  return `${HOTE_WIKIPEDIA}/w/api.php?${params.toString()}`;
}

/** GET en lecture seule : texte complet d'une page d'homonymie (liste de ses entrées), même route que la requête principale. */
export function urlRequeteHomonymie(titre: string): string {
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'extracts', explaintext: '1', titles: titre });
  return `${HOTE_WIKIPEDIA}/w/api.php?${params.toString()}`;
}

/** Liste blanche : seul le texte brut de la page est retenu (borné) ; null si la forme est inattendue. */
export function lireHomonymie(brut: unknown): string | null {
  if (!estObjet(brut) || !estObjet(brut.query) || !Array.isArray(brut.query.pages) || brut.query.pages.length !== 1) return null;
  const page: unknown = brut.query.pages[0];
  if (!estObjet(page) || typeof page.extract !== 'string') return null;
  return page.extract.slice(0, MAX_HOMONYMIE);
}

const MAX_HOMONYMIE = 20_000;
const MAX_ENTREES_HOMONYMIE = 60;
const FIN_ENTREES = /^={2,}\s*(voir aussi|notes? et references?|articles? connexes?|liens? externes?)\b/;

/**
 * Thèmes dominants des entrées listées par une page d'homonymie (« Zidane peut désigner : … footballeur … »).
 * Une entrée = une ligne assez longue ; un thème est retenu s'il apparaît dans au moins 2 entrées (ou l'unique entrée)
 * et dans 30 % des entrées au moins. Au plus 3 thèmes, les plus fréquents d'abord ; liste vide si rien ne domine.
 * Seuls des identifiants du catalogue sortent ; les parents ne sont pas ajoutés.
 */
export function themesDepuisHomonymie(texte: string): string[] {
  const entrees: string[] = [];
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    if (FIN_ENTREES.test(cle(ligne))) break;
    // Les titres de section (« == Patronyme == »), les phrases d'introduction et les lignes très courtes ne sont pas des entrées.
    if (ligne.length < 25 || ligne.startsWith('=') || /peut (?:aussi )?(?:designer|faire reference)/.test(cle(ligne))) continue;
    entrees.push(ligne);
    if (entrees.length >= MAX_ENTREES_HOMONYMIE) break;
  }
  if (entrees.length === 0) return nomOuPrenom(texte);
  const compte = new Map<string, number>();
  for (const ligne of entrees) for (const id of themesDirectsDeTexte(ligne)) compte.set(id, (compte.get(id) ?? 0) + 1);
  const minimum = Math.max(entrees.length === 1 ? 1 : 2, Math.ceil(entrees.length * 0.3));
  const dominants = [...compte.entries()]
    .filter(([, n]) => n >= minimum)
    .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b))
    .slice(0, 3)
    .map(([id]) => id);
  return dominants.length > 0 ? dominants : nomOuPrenom(texte);
}

/** Aucun domaine ne domine : une page qui parle d'un patronyme ou d'un prénom relève du thème « Noms et prénoms » (Alexis, 2026-11-17). */
const nomOuPrenom = (texte: string): string[] => (/patronyme|nom de famille|(?:^|[^a-z])prenoms?(?![a-z])/.test(cle(texte)) ? ['noms'] : []);

/** GET en lecture seule : recherche d'une entité par son titre ; seuls l'étiquette et la courte description sont lues. */
export function urlRequeteWikidata(titre: string): string {
  const params = new URLSearchParams({ action: 'wbsearchentities', format: 'json', language: 'fr', uselang: 'fr', type: 'item', limit: '5', search: titre });
  return `${HOTE_WIKIDATA}/w/api.php?${params.toString()}`;
}

// Propriétés Wikidata qui disent ce qu'est la carte : instance de, occupation, genre, sport.
const PROPRIETES = ['P31', 'P106', 'P136', 'P641'] as const;
const PAR_PROPRIETE = 5;
const MAX_CLASSES = 20;

/** GET en lecture seule : les déclarations d'une entité (l'identifiant vient de la page Wikipédia, jamais d'une donnée du compte). */
export function urlEntiteWikidata(qid: string): string {
  return `${HOTE_WIKIDATA}/w/api.php?${new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims', ids: qid }).toString()}`;
}

export interface EntiteWikidata {
  /** Instance de « être humain » (Q5). */
  humain: boolean;
  /** Identifiants des classes, métiers, genres et sports (liste blanche de propriétés, bornée). */
  classes: string[];
}

export function lireEntiteWikidata(brut: unknown, qid: string): EntiteWikidata | null {
  if (!estObjet(brut) || !estObjet(brut.entities)) return null;
  const entite = brut.entities[qid];
  if (!estObjet(entite)) return null;
  const claims = estObjet(entite.claims) ? entite.claims : {};
  const classes: string[] = [];
  let humain = false;
  for (const prop of PROPRIETES) {
    const liste = claims[prop];
    if (!Array.isArray(liste)) continue;
    for (const c of liste.slice(0, PAR_PROPRIETE)) {
      const id: unknown = estObjet(c) && estObjet(c.mainsnak) && estObjet(c.mainsnak.datavalue) && estObjet(c.mainsnak.datavalue.value) ? c.mainsnak.datavalue.value.id : undefined;
      if (typeof id !== 'string' || !/^Q\d{1,12}$/.test(id)) continue;
      if (prop === 'P31' && id === 'Q5') humain = true;
      else if (classes.length < MAX_CLASSES && !classes.includes(id)) classes.push(id);
    }
  }
  return { humain, classes };
}

/** GET en lecture seule : libellés français des classes (au plus 20 identifiants). */
export function urlLibellesWikidata(ids: string[]): string {
  return `${HOTE_WIKIDATA}/w/api.php?${new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'labels', languages: 'fr', ids: ids.slice(0, MAX_CLASSES).join('|') }).toString()}`;
}

export function lireLibellesWikidata(brut: unknown): string[] | null {
  if (!estObjet(brut) || !estObjet(brut.entities)) return null;
  const libelles: string[] = [];
  for (const e of Object.values(brut.entities)) {
    if (!estObjet(e) || !estObjet(e.labels) || !estObjet(e.labels.fr)) continue;
    const v = e.labels.fr.value;
    if (typeof v === 'string' && v.length <= 200) libelles.push(v);
  }
  return libelles;
}

export type LectureWikidata = { type: 'ok'; descriptions: string[] } | { type: 'invalide' };


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


/** Liste blanche : seuls les titres de catégories sont retenus, tout le reste de la réponse est ignoré. */
export function lireReponse(brut: unknown): LectureWikipedia {
  if (!estObjet(brut) || !estObjet(brut.query) || !Array.isArray(brut.query.pages) || brut.query.pages.length !== 1) return { type: 'invalide' };
  const page: unknown = brut.query.pages[0];
  if (!estObjet(page)) return { type: 'invalide' };
  if (page.missing === true || page.invalid === true) return { type: 'introuvable' };
  if (estObjet(page.pageprops) && 'disambiguation' in page.pageprops) return { type: 'ambigue' };
  // Résumé : introduction de la page en texte brut, bornée ; utile quand les catégories ne disent rien.
  const resume = typeof page.extract === 'string' ? page.extract.slice(0, MAX_RESUME) : '';
  const qid = estObjet(page.pageprops) && typeof page.pageprops.wikibase_item === 'string' && /^Q\d{1,12}$/.test(page.pageprops.wikibase_item) ? page.pageprops.wikibase_item : undefined;
  if (page.categories === undefined) return { type: 'ok', categories: [], resume, ...(qid ? { qid } : {}) };
  if (!Array.isArray(page.categories) || page.categories.length > MAX_CATEGORIES) return { type: 'invalide' };
  const categories: string[] = [];
  for (const c of page.categories) {
    if (!estObjet(c) || typeof c.title !== 'string' || c.title.length > 300) return { type: 'invalide' };
    categories.push(c.title.replace(/^[^:]+:/, ''));
  }
  return { type: 'ok', categories, resume, ...(qid ? { qid } : {}) };
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

function lireSignaux(brut: unknown, connus: Set<string>): SignauxPage | null {
  if (!estObjet(brut) || !Array.isArray(brut.fortes) || !Array.isArray(brut.faibles) || !GENRES.includes(brut.genre as Genre)) return null;
  const ids = (a: unknown[]): string[] => a.filter((t): t is string => typeof t === 'string' && connus.has(t));
  return { fortes: ids(brut.fortes), faibles: ids(brut.faibles), genre: brut.genre as Genre };
}

const GENRES: readonly Genre[] = ['personne', 'oeuvre', 'organisation', 'produit', 'notion', 'lieu', 'espece', 'autre'];

/** Signaux par le sens : thèmes de la définition (fiables) et des catégories (à recouper), nature du sujet. */
export function signauxWikipedia(categories: string[], resume: string, descriptionsWikidata: string[] = [], classes: string[] = [], humain = false): SignauxPage {
  const utiles = categories.filter((c) => !CATEGORIE_TECHNIQUE.test(c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));
  const def = definition(resume);
  const fortes = new Set(themesDirectsDeTexte(def));
  // Une courte description Wikidata (« film américain de 2005 ») est une classification : elle compte comme une définition.
  // Classes Wikidata (« film », « équipe de hockey sur glace », « personnalité politique ») : libellés courts et classificatoires.
  const textes = [...descriptionsWikidata, ...classes];
  for (const d of textes) for (const id of themesDirectsDeTexte(d)) fortes.add(id);
  const depuisResume = genreDe(resume, def);
  const genre: Genre = humain ? 'personne' : (classes.map((d) => genreDe(d)).find((g) => g !== 'autre') ?? (depuisResume !== 'autre' ? depuisResume : (descriptionsWikidata.map((d) => genreDe(d)).find((g) => g !== 'autre') ?? 'autre')));
  return { fortes: [...fortes], faibles: themesDirectsDeTexte(utiles.join(' . '), true), genre };
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
      ...(lireSignaux(e.signaux, connus) ? { signaux: lireSignaux(e.signaux, connus) as SignauxPage } : {}),
      ...(e.avecHomonymie === true ? { avecHomonymie: true as const } : {}),
      ...(e.avecNoms === true ? { avecNoms: true as const } : {}),
      ...(e.nomsPropres === true ? { nomsPropres: true as const } : {}),
      ...(Array.isArray(e.categories) ? { categories: e.categories.filter((c): c is string => typeof c === 'string' && c.length <= 120).slice(0, MAX_CATEGORIES_GARDEES) } : {}),
    };
  }
  return { version: 1, entrees: { ...entrees } };
}

/** Catégories gardées dans le cache pour les thèmes appris. */
const MAX_CATEGORIES_GARDEES = 40;

/** Catégories utiles (sans maintenance du site), bornées, pour le cache. */
export function categoriesUtiles(categories: readonly string[]): string[] {
  return categories
    .filter((c) => !CATEGORIE_TECHNIQUE.test(c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) && c.length <= 120)
    .slice(0, MAX_CATEGORIES_GARDEES);
}

export function ajouterEntree(cache: CacheWikipedia, titre: string, themes: string[], maintenant: number, wikidata = false, signaux?: SignauxPage, categories: readonly string[] = []): CacheWikipedia {
  const entree: EntreeWikipedia = { themes: [...themes], verifieLe: maintenant, avecResume: true, avecHomonymie: true, avecNoms: true, nomsPropres: true, categories: categoriesUtiles(categories), ...(wikidata ? { avecWikidata: true as const } : {}), ...(signaux ? { signaux } : {}) };
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
    // Une entrée calculée avant le filtre des noms propres est relue une fois.
    if (entree !== undefined && (entree.nomsPropres !== true || entree.categories === undefined)) { resultat.push(titre); continue }
    // Une entrée sans thème et sans résumé (ancienne version) est relue une fois pour profiter du résumé.
    if (entree === undefined || entree.signaux === undefined || maintenant - entree.verifieLe >= DUREE_CACHE_MS || (entree.themes.length === 0 && (entree.avecResume !== true || entree.avecWikidata !== true || entree.avecHomonymie !== true || entree.avecNoms !== true))) resultat.push(titre);
  }
  return resultat;
}

export function signauxParTitre(cache: CacheWikipedia): Map<string, SignauxPage> {
  const m = new Map<string, SignauxPage>();
  for (const [titre, e] of Object.entries(cache.entrees)) if (e.signaux) m.set(titre, e.signaux);
  return m;
}

export function themesParTitre(cache: CacheWikipedia): Map<string, string[]> {
  return new Map(Object.entries(cache.entrees).map(([titre, e]) => [titre, e.themes]));
}

/** Catégories normalisées de chaque titre (celles du cache), pour reconnaître les thèmes appris. */
export function categoriesParTitre(cache: CacheWikipedia): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [titre, e] of Object.entries(cache.entrees)) if (e.categories && e.categories.length > 0) m.set(titre, e.categories.map(normaliser));
  return m;
}
