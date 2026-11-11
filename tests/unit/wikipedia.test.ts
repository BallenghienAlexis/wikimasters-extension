import { describe, expect, it } from 'vitest';
import { verifierTitres, type Transport } from '../../src/app/verifierWikipedia';
import { themesDeCarte, definirThemesWikipedia } from '../../src/lib/themes';
import { cacheVide, lireReponse, themesDepuisCategories, titresAVerifier, urlRequete, validerCache, ajouterEntree, DUREE_CACHE_MS } from '../../src/lib/wikipedia';

const page = (extra: object) => ({ query: { pages: [{ title: 'X', ...extra }] } });

describe('lireReponse', () => {
  it('retient les titres de catégories sans leur préfixe', () => {
    expect(lireReponse(page({ categories: [{ ns: 14, title: 'Catégorie:Barrage en France' }] }))).toEqual({ type: 'ok', categories: ['Barrage en France'] });
  });
  it('repère page absente, homonymie et forme inattendue', () => {
    expect(lireReponse(page({ missing: true })).type).toBe('introuvable');
    expect(lireReponse(page({ pageprops: { disambiguation: '' } })).type).toBe('ambigue');
    expect(lireReponse({}).type).toBe('invalide');
    expect(lireReponse(page({ categories: [{ title: 3 }] })).type).toBe('invalide');
  });
});

describe('themesDepuisCategories', () => {
  it('déduit les thèmes (parents compris) et ignore les catégories techniques', () => {
    const themes = themesDepuisCategories(['Barrage en France', 'Article de qualité', 'Portail:Chats']);
    expect(themes).toContain('barrage');
    expect(themes).toContain('architecture');
    expect(themes).not.toContain('chat');
  });
});

describe('cache et surcouche', () => {
  it('ne redemande pas une entrée récente, mais une entrée périmée', () => {
    const cache = ajouterEntree(cacheVide(), 'A', ['chat'], 1000);
    expect(titresAVerifier(['A', 'B', 'B'], cache, 2000)).toEqual(['B']);
    expect(titresAVerifier(['A'], cache, 1000 + DUREE_CACHE_MS)).toEqual(['A']);
  });
  it('écarte un thème inconnu du cache', () => {
    expect(validerCache({ version: 1, entrees: { A: { themes: ['chat', 'inconnu'], verifieLe: 1 } } })?.entrees.A?.themes).toEqual(['chat']);
    expect(validerCache({ version: 2, entrees: {} })).toBeNull();
  });
  it('ajoute les thèmes Wikipédia aux mots-clés', () => {
    const carte = { titre: 'Zorglub', description: 'Une chose.' };
    expect(themesDeCarte(carte)).toEqual(['autres']);
    definirThemesWikipedia(new Map([['Zorglub', ['barrage']]]));
    expect(themesDeCarte(carte)).toEqual(['barrage']);
    definirThemesWikipedia(new Map());
  });
  it('construit une URL GET vers fr.wikipedia.org', () => {
    expect(urlRequete('Tour Eiffel')).toMatch(/^https:\/\/fr\.wikipedia\.org\/w\/api\.php\?.*titles=Tour\+Eiffel/);
  });
});

describe('verifierTitres', () => {
  const sansPause = async (): Promise<void> => undefined;
  const ok = (categories: string[]): Transport => async () => ({ status: 200, json: async () => page({ categories: categories.map((title) => ({ title })) }) });
  it('remplit le cache titre par titre', async () => {
    let dernier = cacheVide();
    const r = await verifierTitres({ titres: ['A', 'B'], cache: cacheVide(), signal: new AbortController().signal, surProgres: (c) => { dernier = c; }, attendre: sansPause, transport: ok(['Catégorie:Barrage en France']), maintenant: () => 5 });
    expect(r).toEqual({ verifiees: 2, arret: null, codeHttp: null });
    expect(dernier.entrees.B?.themes).toContain('barrage');
  });
  it('s’arrête sur 429 sans réessayer', async () => {
    let appels = 0;
    const transport: Transport = async () => { appels++; return { status: 429, json: async () => ({}) }; };
    const r = await verifierTitres({ titres: ['A', 'B'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: sansPause, transport });
    expect(r).toEqual({ verifiees: 0, arret: 'code-http', codeHttp: 429 });
    expect(appels).toBe(1);
  });
  it('s’arrête après 3 échecs et sur demande', async () => {
    const echec: Transport = async () => { throw new Error('réseau'); };
    const r = await verifierTitres({ titres: ['A', 'B', 'C', 'D'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: sansPause, transport: echec });
    expect(r.arret).toBe('echecs');
    const c = new AbortController();
    c.abort();
    expect((await verifierTitres({ titres: ['A'], cache: cacheVide(), signal: c.signal, surProgres: () => undefined, transport: ok([]) })).arret).toBe('manuel');
  });
});

describe('cas limites', () => {
  it('ne confond pas un titre avec une propriété héritée du cache', () => {
    expect(titresAVerifier(['constructor', 'toString'], cacheVide(), 1)).toEqual(['constructor', 'toString']);
    const cache = validerCache(JSON.parse('{"version":1,"entrees":{"__proto__":{"themes":["chat"],"verifieLe":1}}}'));
    expect(cache && Object.getPrototypeOf(cache.entrees)).toBe(Object.prototype);
  });
  it('saute un titre contenant « | » sans requête', async () => {
    let appels = 0;
    const transport: Transport = async () => { appels++; return { status: 200, json: async () => ({}) }; };
    const r = await verifierTitres({ titres: ['A|B'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined, transport });
    expect(appels).toBe(0);
    expect(r.verifiees).toBe(1);
  });
  it('garde une catégorie de sujet commençant par « Projet » et ignore « Match de barrage »', () => {
    expect(themesDepuisCategories(['Projet de fusée européenne'])).toContain('fusee');
    expect(themesDepuisCategories(['Match de barrage de football'])).not.toContain('barrage');
  });
});
