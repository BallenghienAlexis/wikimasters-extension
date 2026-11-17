import { describe, expect, it } from 'vitest';
import type { SignauxPage } from '../../src/lib/themes';
import { verifierTitres, type Transport } from '../../src/app/verifierWikipedia';
import { themesDeCarte, definirThemesWikipedia } from '../../src/lib/themes';
import { creerPlanificateur } from '../../src/app/verifierWikipedia';
import { cacheVide, lireEntiteWikidata, lireLibellesWikidata, signauxWikipedia, urlEntiteWikidata, lireReponse, lireReponseWikidata, themesDepuisWikidata, urlRequeteWikidata, themesDepuisCategories, titresAVerifier, urlRequete, urlRequeteHomonymie, lireHomonymie, themesDepuisHomonymie, validerCache, ajouterEntree, DUREE_CACHE_MS } from '../../src/lib/wikipedia';

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

const SIG: SignauxPage = { fortes: [], faibles: [], genre: 'autre' };

describe('résumé Wikipédia', () => {
  it('complète les catégories par le résumé', () => {
    expect(themesDepuisCategories([], 'Serre-Ponçon est un barrage hydroélectrique situé dans les Alpes.')).toContain('barrage');
    expect(themesDepuisCategories(['Barrage en France'], '')).toContain('barrage');
  });
  it('relit une fois une entrée sans thème enregistrée avant le résumé', () => {
    const ancien = validerCache({ version: 1, entrees: { A: { themes: [], verifieLe: 1000 }, B: { themes: ['barrage'], verifieLe: 1000, signaux: SIG } } })!;
    // Toute entrée d'avant le filtre des noms propres est relue une fois (A sans thème, B calculée avant le filtre).
    expect(titresAVerifier(['A', 'B'], ancien, 2000)).toEqual(['A', 'B']);
    expect(titresAVerifier(['A'], ajouterEntree(ancien, 'A', [], 2000, true, SIG), 3000)).toEqual([]);
  });
});

describe('cache et surcouche', () => {
  it('ne redemande pas une entrée récente, mais une entrée périmée', () => {
    const cache = ajouterEntree(cacheVide(), 'A', ['chat'], 1000, false, SIG);
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
    expect(urlRequete('X')).toContain('exsentences=2');
  });
});

describe('Wikidata', () => {
  const reponse = (search: object[]) => ({ search });
  it('construit un GET vers wikidata.org avec le seul titre', () => {
    const url = urlRequeteWikidata('Serre-Ponçon');
    expect(url).toMatch(/^https:\/\/www\.wikidata\.org\/w\/api\.php\?action=wbsearchentities/);
    expect(url).toContain('search=Serre-Pon%C3%A7on');
  });
  it('ne retient que les descriptions des entités au même titre, sans tenir compte de la casse ni des accents', () => {
    const l = lireReponseWikidata(reponse([{ label: 'serre-ponçon', description: 'barrage hydroélectrique' }, { label: 'Autre', description: 'chat' }, { label: 'Serre-Ponçon' }]), 'Serre-Poncon');
    expect(l).toEqual({ type: 'ok', descriptions: ['barrage hydroélectrique'] });
    expect(themesDepuisWikidata(['barrage hydroélectrique'])).toContain('barrage');
  });
  it('refuse une forme inattendue', () => {
    expect(lireReponseWikidata({}, 'X').type).toBe('invalide');
    expect(lireReponseWikidata({ search: [3] }, 'X').type).toBe('invalide');
  });
  it('interroge Wikidata seulement si Wikipédia ne donne aucun thème, puis mémorise', async () => {
    const urls: string[] = [];
    const transport: Transport = async (url) => {
      urls.push(url);
      return { status: 200, json: async () => (url.includes('wikidata') ? reponse([{ label: 'A', description: 'barrage hydroélectrique' }]) : page({ categories: [] })) };
    };
    let dernier = cacheVide();
    await verifierTitres({ titres: ['A'], cache: cacheVide(), signal: new AbortController().signal, surProgres: (c) => { dernier = c; }, attendre: async () => undefined, transport, maintenant: () => 5 });
    expect(urls).toHaveLength(2);
    expect(dernier.entrees.A).toMatchObject({ avecWikidata: true });
    expect(dernier.entrees.A?.themes).toContain('barrage');
    const deja: string[] = [];
    await verifierTitres({ titres: ['B'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined, maintenant: () => 5, transport: async (u) => { deja.push(u); return { status: 200, json: async () => page({ categories: [{ title: 'Catégorie:Barrage en France' }] }) }; } });
    expect(deja).toHaveLength(1);
  });
  it('compte les échecs de Wikidata et s’arrête à 3 sans rien mémoriser', async () => {
    let dernier = cacheVide();
    const transport: Transport = async (url) => (url.includes('wikidata') ? { status: 500, json: async () => ({}) } : { status: 200, json: async () => page({ categories: [] }) });
    const r = await verifierTitres({ titres: ['A', 'B', 'C', 'D'], cache: cacheVide(), signal: new AbortController().signal, surProgres: (c) => { dernier = c; }, attendre: async () => undefined, transport });
    expect(r).toEqual({ verifiees: 0, arret: 'echecs', codeHttp: null });
    expect(Object.keys(dernier.entrees)).toEqual([]);
  });
  it('s’arrête sur 429 de Wikidata', async () => {
    const transport: Transport = async (url) => (url.includes('wikidata') ? { status: 429, json: async () => ({}) } : { status: 200, json: async () => page({ categories: [] }) });
    const r = await verifierTitres({ titres: ['A', 'B'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined, transport });
    expect(r).toEqual({ verifiees: 0, arret: 'code-http', codeHttp: 429 });
  });
  it('relit une fois une entrée sans signaux (enregistrée avant la lecture par le sens)', () => {
    const c = validerCache({ version: 1, entrees: { A: { themes: ['chat'], verifieLe: 1000, avecResume: true } } })!;
    expect(titresAVerifier(['A'], c, 2000)).toEqual(['A']);
  });
  it('relit une fois une entrée sans thème enregistrée avant Wikidata', () => {
    const c = validerCache({ version: 1, entrees: { A: { themes: [], verifieLe: 1000, avecResume: true } } })!;
    expect(titresAVerifier(['A'], c, 2000)).toEqual(['A']);
    expect(titresAVerifier(['A'], ajouterEntree(c, 'A', [], 2000, true, SIG), 3000)).toEqual([]);
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

  it('la file de fond passe après la liste, et un titre de fond redemandé par la liste passe devant', async () => {
    const vus: string[] = [];
    const transport: Transport = async (url, s) => { vus.push(/titles=([^&]*)/.exec(url)?.[1] ?? ''); return reponseOk(url, s); };
    const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport });
    p.demander(['F1', 'F2', 'F3'], true);
    p.demander(['A', 'F3']);
    await attendreFin(p);
    const ordre = vus.filter((t) => t !== '');
    // La liste (A, puis F3 repris de la file de fond) précède tout le fond (F1, F2).
    expect(ordre.slice(0, 4)).toEqual(['A', 'F3', 'F1', 'F2']);
    expect(p.etat().fond).toBe(0);
  });

  it('annuler ne coupe pas la requête de fond en vol ni la file de fond', async () => {
    const signaux: boolean[] = [];
    let liberer: () => void = () => undefined;
    const porte = new Promise<void>((r) => { liberer = r; });
    let premier = true;
    const vus: string[] = [];
    const transport: Transport = async (url, s) => {
      vus.push(/titles=([^&]*)/.exec(url)?.[1] ?? '');
      if (premier) { premier = false; await porte; signaux.push(s.aborted); }
      return reponseOk(url, s);
    };
    const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport });
    p.demander(['F1', 'F2'], true);
    for (let i = 0; i < 20 && vus.length === 0; i++) await new Promise((r) => setTimeout(r, 1));
    p.annuler();
    liberer();
    await attendreFin(p);
    expect(signaux).toEqual([false]);
    expect(vus.filter((t) => t !== '')).toEqual(['F1', 'F2']);
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

  it('annuler vide la file, laisse finir la requête en vol et permet de redemander les titres annulés', async () => {
    const vus: string[] = [];
    let liberer: () => void = () => undefined;
    const porte = new Promise<void>((r) => { liberer = r; });
    let premier = true;
    const transport: Transport = async (url, s) => {
      vus.push(url);
      if (premier) { premier = false; await porte; }
      return reponseOk(url, s);
    };
    const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport });
    p.demander(['A', 'B', 'C']);
    for (let i = 0; i < 20 && vus.length === 0; i++) await new Promise((r) => setTimeout(r, 1));
    expect(vus).toHaveLength(1);
    p.annuler();
    liberer();
    await attendreFin(p);
    // Seule la requête en vol est allée à son terme : B et C ne sont jamais partis.
    expect(vus).toHaveLength(1);
    expect(p.etat().enCours).toBe(false);
    p.demander(['A', 'B', 'C']);
    await attendreFin(p);
    // A est déjà tenté ; B et C, annulés, sont redemandés au retour.
    expect(vus).toHaveLength(3);
  });
  describe('annulation et cadence (T-312)', () => {
    const sansCategorie = { query: { pages: [{ title: 'X' }] } };
    const pause = (signal: AbortSignal): Promise<void> => new Promise((r) => signal.addEventListener('abort', () => r(), { once: true }));
    const attendre = async (cond: () => boolean): Promise<void> => {
      for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 1));
    };

    it('annuler coupe la requête en vol, sans suspension, et le titre est redemandé au retour', async () => {
      const urls: string[] = [];
      let bloquer = true;
      const transport: Transport = (url, signal) => {
        urls.push(url);
        if (!bloquer) return reponseOk(url, signal);
        return new Promise((_, rejet) => signal.addEventListener('abort', () => rejet(new Error('abort')), { once: true }));
      };
      const p = creerPlanificateur({ chargerCache: async () => cacheVide(), surCache: () => undefined, attendre: sansPause, transport, maintenant: () => 0 });
      p.demander(['A']);
      await attendre(() => urls.length === 1);
      p.annuler();
      await attendreFin(p);
      expect(p.etat().suspendue).toBeNull();
      expect(p.etat().enCours).toBe(false);
      bloquer = false;
      p.demander(['A']);
      await attendreFin(p);
      expect(urls).toHaveLength(2);
    });

    it('annuler pendant la pause avant Wikidata : aucune requête Wikidata ne part', async () => {
      const urls: string[] = [];
      const transport: Transport = async (url) => { urls.push(url); return { status: 200, json: async () => sansCategorie }; };
      const p = creerPlanificateur({
        chargerCache: async () => cacheVide(), surCache: () => undefined, transport, maintenant: () => 0,
        attendre: (_ms, signal) => pause(signal),
      });
      p.demander(['Zèbre']);
      await attendre(() => urls.length === 1);
      p.annuler();
      await attendreFin(p);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('wikipedia');
      expect(urls.some((u) => u.includes('wikidata'))).toBe(false);
    });

    it('respecte 1 000 ms entre deux débuts de requête après annuler() puis demander()', async () => {
      let t = 0;
      const departs: number[] = [];
      let liberer: () => void = () => undefined;
      const porte = new Promise<void>((r) => { liberer = r; });
      let premier = true;
      const transport: Transport = async (url, signal) => {
        departs.push(t);
        if (premier) {
          premier = false;
          await Promise.race([porte, new Promise<void>((_, rejet) => signal.addEventListener('abort', () => rejet(new Error('abort')), { once: true }))]);
        }
        return reponseOk(url, signal);
      };
      const p = creerPlanificateur({
        chargerCache: async () => cacheVide(), surCache: () => undefined, transport,
        maintenant: () => t, attendre: async (ms) => { t += ms; },
      });
      p.demander(['A']);
      await attendre(() => departs.length === 1);
      p.annuler();
      p.demander(['B']);
      liberer();
      await attendreFin(p);
      expect(departs.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < departs.length; i++) expect(departs[i]! - departs[i - 1]!).toBeGreaterThanOrEqual(1000);
    });
  });
});

describe('type et métier d’après Wikidata', () => {
  const sansPause = async (): Promise<void> => undefined;
  // Réponses reconstituées sur la forme relevée le 2026-11-14 (public, aucune donnée du compte).
  const pageAvecQid = { query: { pages: [{ title: 'Lions', pageprops: { wikibase_item: 'Q105334176' }, categories: [{ title: 'Catégorie:Club de hockey sur glace au Québec' }] }] } };
  const entite = { entities: { Q105334176: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q1' } } } }], P641: [{ mainsnak: { datavalue: { value: { id: 'Q2' } } } }] } } } };
  const libelles = { entities: { Q1: { labels: { fr: { value: 'équipe de hockey sur glace' } } }, Q2: { labels: { fr: { value: 'hockey sur glace' } } } } };

  it('lit l’identifiant, les classes (liste blanche de propriétés) et le caractère humain', () => {
    expect(lireReponse(pageAvecQid)).toMatchObject({ type: 'ok', qid: 'Q105334176' });
    expect(lireEntiteWikidata(entite, 'Q105334176')).toEqual({ humain: false, classes: ['Q1', 'Q2'] });
    const humain = { entities: { Q9: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }], P999: [{ mainsnak: { datavalue: { value: { id: 'Q7' } } } }] } } } };
    expect(lireEntiteWikidata(humain, 'Q9')).toEqual({ humain: true, classes: [] });
    expect(lireEntiteWikidata({ entities: {} }, 'Q9')).toBeNull();
    expect(lireLibellesWikidata(libelles)).toEqual(['équipe de hockey sur glace', 'hockey sur glace']);
    expect(urlEntiteWikidata('Q1')).toBe('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=Q1');
  });
  it('lit les classes en 2 GET, les met dans les signaux, et le caractère humain fixe la nature', async () => {
    const urls: string[] = [];
    const transport: Transport = async (url) => {
      urls.push(url);
      return { status: 200, json: async () => (url.includes('fr.wikipedia') ? pageAvecQid : url.includes('props=claims') ? entite : libelles) };
    };
    let dernier = cacheVide();
    const r = await verifierTitres({ titres: ['Lions'], cache: cacheVide(), signal: new AbortController().signal, surProgres: (c) => { dernier = c; }, attendre: sansPause, transport });
    expect(r).toEqual({ verifiees: 1, arret: null, codeHttp: null });
    expect(urls).toHaveLength(3);
    expect(dernier.entrees.Lions?.signaux?.fortes).toContain('hockey');
    expect(dernier.entrees.Lions?.signaux?.genre).toBe('organisation');
    expect(signauxWikipedia([], '', [], [], true).genre).toBe('personne');
  });
  it('un échec de Wikidata ne bloque pas la carte, un 429 arrête', async () => {
    const panne: Transport = async (url) => (url.includes('fr.wikipedia') ? { status: 200, json: async () => pageAvecQid } : { status: 500, json: async () => ({}) });
    const r = await verifierTitres({ titres: ['Lions'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: sansPause, transport: panne });
    expect(r.verifiees).toBe(1);
    const limite: Transport = async (url) => (url.includes('fr.wikipedia') ? { status: 200, json: async () => pageAvecQid } : { status: 429, json: async () => ({}) });
    const r2 = await verifierTitres({ titres: ['Lions', 'B'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: sansPause, transport: limite });
    expect(r2).toEqual({ verifiees: 0, arret: 'code-http', codeHttp: 429 });
  });
});

describe('cache calculé avant le filtre des noms propres', () => {
  it('une entrée ancienne est relue une fois', () => {
    const ancien = { version: 1 as const, entrees: { Noir: { themes: ['train'], verifieLe: 1_000, avecResume: true as const } } };
    expect(titresAVerifier(['Noir'], ancien, 2_000)).toEqual(['Noir']);
    const neuf = ajouterEntree(cacheVide(), 'Noir', ['train'], 1_000, false, SIG);
    expect(titresAVerifier(['Noir'], neuf, 2_000)).toEqual([]);
  });
});

describe('règles par catégories et classes Wikidata (classement automatique)', () => {
  it('reconnaît une spécialité culinaire, une moto, un camion, un romancier', () => {
    expect(themesDepuisWikidata(['spécialité culinaire espagnole'])).toContain('gastronomie');
    expect(themesDepuisCategories(['Motocyclette Honda'])).toContain('moto');
    expect(themesDepuisCategories(['Camion électrique'])).toContain('camion');
    expect(themesDepuisCategories(['Romancier français du XIXe siècle'])).toContain('litterature');
  });
});

describe('pages d’homonymie', () => {
  const TEXTE_ZIDANE = [
    'Zidane peut désigner :',
    '',
    '== Patronyme ==',
    'Zinédine Zidane (né en 1972), footballeur international français ;',
    'Elyaz Zidane (né en 2005), footballeur français, fils du précédent ;',
    'Luca Zidane (né en 1998), footballeur et gardien de but français ;',
    'Yazid Zidane, acteur algérien.',
    '',
    '== Voir aussi ==',
    'Bataille de Zidane, bataille imaginaire de la guerre ancienne.',
  ].join('\n');

  it('construit une requête de texte complet sur la même route, sans donnée du compte', () => {
    const url = urlRequeteHomonymie('Zidane (homonymie)');
    expect(url.startsWith('https://fr.wikipedia.org/w/api.php?')).toBe(true);
    expect(url).toContain('prop=extracts');
    expect(url).toContain('explaintext=1');
    expect(url).not.toContain('exintro');
  });
  it('lit le texte de la page (borné) et refuse une forme inattendue', () => {
    expect(lireHomonymie(page({ extract: 'abc' }))).toBe('abc');
    expect(lireHomonymie(page({ extract: 'x'.repeat(50_000) }))?.length).toBe(20_000);
    expect(lireHomonymie(page({}))).toBeNull();
    expect(lireHomonymie({})).toBeNull();
  });
  it('retient les thèmes dominants des entrées, pas ceux d’une seule', () => {
    const themes = themesDepuisHomonymie(TEXTE_ZIDANE);
    expect(themes).toContain('football');
    expect(themes).not.toContain('guerre');
    expect(themes.length).toBeLessThanOrEqual(3);
  });
  it('s’arrête avant « Voir aussi » et ne retient rien quand aucun thème ne domine', () => {
    const texte = ['X peut désigner :', 'Un film réalisé par Jean Dupont en 1990 ;', 'Un cheval de course célèbre ;', 'Un joueur de rugby français du XIXe siècle ;', 'Un cuisinier réputé du Second Empire.'].join('\n');
    expect(themesDepuisHomonymie(texte)).toEqual([]);
    expect(themesDepuisHomonymie('')).toEqual([]);
  });
  it('ignore les entrées après « Voir aussi »', () => {
    const texte = ['X peut désigner :', 'Une ville du nord de la France, commune de la Somme ;', 'Un film réalisé par Jean Dupont en 1990 ;', '== Voir aussi ==', 'Zinédine Zidane, footballeur international français ;', 'Elyaz Zidane, footballeur international français ;', 'Luca Zidane, footballeur international français.'].join('\n');
    expect(themesDepuisHomonymie(texte)).not.toContain('football');
  });
  it('classe la carte d’une page d’homonymie grâce à ses entrées (un GET de plus, thèmes dominants en signaux fiables)', async () => {
    const vus: string[] = [];
    const transport: Transport = async (url) => {
      vus.push(url);
      return { status: 200, json: async () => (url.includes('explaintext=1') && !url.includes('exintro') ? page({ extract: TEXTE_ZIDANE }) : page({ pageprops: { disambiguation: '' } })) };
    };
    let cache = cacheVide();
    const r = await verifierTitres({ titres: ['Zidane (homonymie)'], cache, signal: new AbortController().signal, surProgres: (c) => { cache = c; }, attendre: async () => undefined, transport });
    expect(r.verifiees).toBe(1);
    expect(vus).toHaveLength(2);
    expect(vus.some((u) => u.includes('wikidata'))).toBe(false);
    const entree = cache.entrees['Zidane (homonymie)'];
    expect(entree?.themes).toContain('football');
    expect(entree?.signaux?.fortes).toContain('football');
    expect(entree?.avecHomonymie).toBe(true);
  });
  it('sans entrée exploitable, retombe sur Wikidata comme avant', async () => {
    const reponse = (search: object[]) => ({ search });
    const vus: string[] = [];
    const transport: Transport = async (url) => {
      vus.push(url);
      if (url.includes('wikidata')) return { status: 200, json: async () => reponse([{ label: 'BMS', description: 'page d’homonymie de Wikimédia' }]) };
      return { status: 200, json: async () => (url.includes('exintro') ? page({ pageprops: { disambiguation: '' } }) : page({ extract: 'BMS peut désigner :' })) };
    };
    let cache = cacheVide();
    await verifierTitres({ titres: ['BMS'], cache, signal: new AbortController().signal, surProgres: (c) => { cache = c; }, attendre: async () => undefined, transport });
    expect(vus.some((u) => u.includes('wikidata'))).toBe(true);
    expect(cache.entrees.BMS?.themes).toEqual([]);
  });
  it('un 429 en lisant les entrées arrête la vérification', async () => {
    const transport: Transport = async (url) => (url.includes('exintro') ? { status: 200, json: async () => page({ pageprops: { disambiguation: '' } }) } : { status: 429, json: async () => ({}) });
    const r = await verifierTitres({ titres: ['Zidane'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined, transport });
    expect(r.arret).toBe('code-http');
    expect(r.codeHttp).toBe(429);
  });
  it('relit une fois une entrée sans thème enregistrée avant la lecture des homonymies', () => {
    const ancien = validerCache({ version: 1, entrees: { Z: { themes: [], verifieLe: 1000, avecResume: true, avecWikidata: true, nomsPropres: true, signaux: SIG } } })!;
    expect(titresAVerifier(['Z'], ancien, 2000)).toEqual(['Z']);
    expect(titresAVerifier(['Z'], ajouterEntree(ancien, 'Z', [], 2000, true, SIG), 3000)).toEqual([]);
  });
});
