import { describe, expect, it } from 'vitest';
import { verifierTitres, type Transport } from '../../src/app/verifierWikipedia';
import { themesDeCarte, definirThemesWikipedia } from '../../src/lib/themes';
import { creerPlanificateur } from '../../src/app/verifierWikipedia';
import { cacheVide, lireReponse, themesDepuisCategories, titresAVerifier, urlRequete, validerCache, ajouterEntree, DUREE_CACHE_MS } from '../../src/lib/wikipedia';

const page = (extra: object) => ({ query: { pages: [{ title: 'X', ...extra }] } });

describe('lireReponse', () => {
  it('retient les titres de catégories sans leur préfixe', () => {
    expect(lireReponse(page({ categories: [{ ns: 14, title: 'Catégorie:Barrage en France' }] }))).toEqual({ type: 'ok', categories: ['Barrage en France'], resume: '' });
  });
  it('retient le résumé de la page, borné', () => {
    expect(lireReponse(page({ extract: 'Un barrage.' }))).toEqual({ type: 'ok', categories: [], resume: 'Un barrage.' });
    const long = lireReponse(page({ extract: 'x'.repeat(5000) }));
    expect(long.type === 'ok' && long.resume.length).toBe(2000);
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

describe('résumé Wikipédia', () => {
  it('complète les catégories par le résumé', () => {
    expect(themesDepuisCategories([], 'Le Mont Blanc est un massif dominé par le ski et les barrages.')).toContain('barrage');
    expect(themesDepuisCategories(['Barrage en France'], '')).toContain('barrage');
  });
  it('relit une fois une entrée sans thème enregistrée avant le résumé', () => {
    const ancien = validerCache({ version: 1, entrees: { A: { themes: [], verifieLe: 1000 }, B: { themes: ['barrage'], verifieLe: 1000 } } })!;
    expect(titresAVerifier(['A', 'B'], ancien, 2000)).toEqual(['A']);
    expect(titresAVerifier(['A'], ajouterEntree(ancien, 'A', [], 2000), 3000)).toEqual([]);
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

describe('creerPlanificateur', () => {
  const sansPause = async (): Promise<void> => undefined;
  const reponseOk: Transport = async () => ({ status: 200, json: async () => page({ categories: [{ title: 'Catégorie:Barrage en France' }] }) });
  const attendreFin = async (p: ReturnType<typeof creerPlanificateur>): Promise<void> => {
    for (let i = 0; i < 50 && (p.etat().enCours || i === 0); i++) await new Promise((r) => setTimeout(r, 1));
  };

  it('traite 60 titres un par un, une seule fois chacun, avec au plus une requête en vol', async () => {
    let enVol = 0, maxVol = 0, appels = 0;
    const transport: Transport = async (url, s) => { enVol++; maxVol = Math.max(maxVol, enVol); appels++; await Promise.resolve(); enVol--; return reponseOk(url, s); };
    const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport });
    const titres = Array.from({ length: 60 }, (_, i) => `Carte ${i}`);
    p.demander(titres);
    p.demander(titres);
    await attendreFin(p);
    expect(appels).toBe(60);
    expect(maxVol).toBe(1);
    p.demander(titres);
    await attendreFin(p);
    expect(appels).toBe(60);
  });

  it('reste suspendu après un 429, même si on redemande', async () => {
    let appels = 0;
    const transport: Transport = async () => { appels++; return { status: 429, json: async () => ({}) }; };
    const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport });
    p.demander(['A', 'B']);
    await attendreFin(p);
    expect(p.etat().suspendue).toContain('429');
    p.demander(['C']);
    await attendreFin(p);
    expect(appels).toBe(1);
  });

  it('se suspend après 3 échecs de suite', async () => {
    let appels = 0;
    const transport: Transport = async () => { appels++; throw new Error('réseau'); };
    const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport });
    p.demander(['A', 'B', 'C', 'D', 'E']);
    await attendreFin(p);
    expect(p.etat().suspendue).toContain('échecs');
    expect(appels).toBe(3);
  });
});
