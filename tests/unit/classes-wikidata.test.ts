// Thèmes par les classes Wikidata (POC B repris en production, 2026-11-19) : table, lecture du graphe, repli et mémorisation.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { themesWikidataDe, MAX_ENTITES_GRAPHE } from '../../src/app/grapheWikidata';
import { ancetresAChargerDe, ciblesDeLaCarte, lireEntitesWikidata, themesDeGraphe, urlEntitesWikidata, validerGraphe, type GrapheWikidata } from '../../src/lib/classesWikidata';
import { BARRIERES, TABLE } from '../../src/lib/tableWikidata';
import { definirSignauxWikipedia, IDS_THEMES, parentsDe, themesPrincipaux } from '../../src/lib/themes';
// @ts-expect-error module JS du POC, sans types
import { chargerGraphe, themesDuTitre } from '../../specs/poc-themes/poc-b/classer.mjs';

const entite = (claims: Record<string, string[]>, rang: Record<string, string> = {}) => ({
  claims: Object.fromEntries(Object.entries(claims).map(([p, ids]) => [p, ids.map((id) => ({ rank: rang[id] ?? 'normal', mainsnak: { datavalue: { value: { id } } } }))])),
});

describe('table classe → thème', () => {
  it('ne contient que des thèmes du catalogue et des identifiants Wikidata', () => {
    const connus = new Set(IDS_THEMES);
    for (const [qid, themes] of Object.entries(TABLE)) {
      expect(qid, qid).toMatch(/^Q\d+$/);
      for (const entree of themes) expect(connus.has(entree.split(':')[0] as string), `${qid} → ${entree}`).toBe(true);
    }
    for (const q of BARRIERES) expect(q).toMatch(/^Q\d+$/);
  });
});

describe('themesDeGraphe', () => {
  it('trouve le thème précis par la classe de l’entité', () => {
    // Q183862 = metalcore (table) ; l’entité est « instance de » un groupe de metalcore, lui-même sous-classe de metalcore.
    const graphe: GrapheWikidata = { Q1: { P31: ['Q7000900'] }, Q7000900: { P279: ['Q183862'] } };
    expect(themesDeGraphe(graphe, 'Q1', parentsDe)).toEqual(['metalcore']);
  });
  it('ne remonte pas au-delà d’une barrière et ignore une entité inconnue', () => {
    expect(themesDeGraphe({ Q1: { P31: ['Q5'] }, Q5: { P279: ['Q183862'] } }, 'Q1', parentsDe)).toEqual([]);
    expect(themesDeGraphe({}, 'Q404', parentsDe)).toEqual([]);
  });
  it('garde 4 thèmes au plus, sans le parent d’un thème retenu', () => {
    const graphe: GrapheWikidata = { Q1: { P31: ['Q183862', 'Q8341'] }, Q183862: {}, Q8341: {} };
    const themes = themesDeGraphe(graphe, 'Q1', parentsDe);
    expect(themes.length).toBeLessThanOrEqual(4);
    expect(themes).not.toContain('musique');
    expect(themes).toContain('metalcore');
  });
  it('suit la chaîne du taxon parent jusqu’au règne', () => {
    const graphe: GrapheWikidata = { Q1: { P31: ['Q16521'], P171: ['Q2'] }, Q2: { P171: ['Q3'] }, Q3: { P171: ['Q729'] }, Q729: {} };
    expect(themesDeGraphe(graphe, 'Q1', parentsDe)).toContain('animaux');
  });
});

describe('lecture de la réponse Wikidata', () => {
  it('retient les identifiants des propriétés demandées seulement, sans les déclarations dépréciées', () => {
    const lu = lireEntitesWikidata({ entities: { Q1: entite({ P31: ['Q10', 'Q11'], P18: ['Q99'], P279: ['Q12'] }, { Q11: 'deprecated' }) } }, ['P31', 'P279']);
    expect(lu).toEqual({ Q1: { P31: ['Q10'], P279: ['Q12'] } });
  });
  it('refuse une forme inattendue et borne les valeurs', () => {
    expect(lireEntitesWikidata({}, ['P31'])).toBeNull();
    const beaucoup = lireEntitesWikidata({ entities: { Q1: entite({ P31: Array.from({ length: 30 }, (_, i) => `Q${i + 100}`) }) } }, ['P31']);
    expect(beaucoup?.Q1?.P31).toHaveLength(8);
  });
  it('construit une URL de 50 identifiants au plus, sur l’hôte autorisé', () => {
    const url = new URL(urlEntitesWikidata(Array.from({ length: 80 }, (_, i) => `Q${i + 1}`)));
    expect(url.origin).toBe('https://www.wikidata.org');
    expect(url.searchParams.get('ids')?.split('|')).toHaveLength(50);
    expect(url.searchParams.get('action')).toBe('wbgetentities');
  });
  it('liste les cibles à charger et les ancêtres manquants', () => {
    expect(ciblesDeLaCarte({ P31: ['Q1'], P361: ['Q9'], P106: ['Q2', 'Q1'] }).sort()).toEqual(['Q1', 'Q2']);
    expect(ancetresAChargerDe({ Q1: { P279: ['Q2', 'Q3'] }, Q2: {} }, ['Q1'])).toEqual(['Q3']);
  });
});

describe('graphe mémorisé', () => {
  it('valide la liste blanche, borne la taille et refuse une forme inattendue', () => {
    expect(validerGraphe({ Q1: { P279: ['Q2'], P31: ['Q9'] } }, 10)).toEqual({ Q1: { P279: ['Q2'] } });
    expect(validerGraphe({ Q1: { P279: ['x'] } }, 10)).toBeNull();
    expect(validerGraphe({ Q1: {}, Q2: {} }, 1)).toBeNull();
    expect(validerGraphe({}, 10)).toEqual({});
    expect(validerGraphe('x', 10)).toBeNull();
  });
});

describe('lecture du graphe d’une carte (requêtes simulées)', () => {
  const reponses: Record<string, ReturnType<typeof entite>> = {
    Q7000900: entite({ P279: ['Q7000901'] }),
    Q7000901: entite({ P279: ['Q183862'] }),
    Q183862: entite({ P279: ['Q7000902'] }),
    Q7000902: entite({}),
  };
  const faux = () => {
    const urls: string[] = [];
    const appeler = async (url: string): Promise<unknown> => {
      urls.push(url);
      const ids = (new URL(url).searchParams.get('ids') ?? '').split('|');
      return { entities: Object.fromEntries(ids.map((id) => [id, reponses[id] ?? entite({})])) };
    };
    return { urls, appeler };
  };
  it('remonte les classes par lots et trouve le thème', async () => {
    const { urls, appeler } = faux();
    const graphe: GrapheWikidata = {};
    const r = await themesWikidataDe('Q1', { P31: ['Q7000900'] }, graphe, appeler);
    expect(r?.themes).toEqual(['metalcore']);
    expect(urls.length).toBeGreaterThan(0);
    expect(Object.keys(graphe)).not.toContain('Q1'); // l’entité de la carte n’est pas mémorisée
    expect(graphe.Q7000901).toEqual({ P279: ['Q183862'] });
  });
  it('ne redemande jamais une entité déjà connue', async () => {
    const { urls, appeler } = faux();
    const graphe: GrapheWikidata = {};
    await themesWikidataDe('Q1', { P31: ['Q7000900'] }, graphe, appeler);
    const avant = urls.length;
    const r = await themesWikidataDe('Q2', { P31: ['Q7000900'] }, graphe, appeler);
    expect(r?.themes).toEqual(['metalcore']);
    expect(r?.ajoutees).toBe(0);
    expect(urls.length).toBe(avant);
  });
  it('renvoie null quand une réponse est inexploitable', async () => {
    expect(await themesWikidataDe('Q1', { P31: ['Q7000900'] }, {}, async () => null)).toBeNull();
  });
  it('laisse passer l’arrêt demandé par l’appelant (403, 429, arrêt manuel)', async () => {
    await expect(themesWikidataDe('Q1', { P31: ['Q7000900'] }, {}, async () => { throw new DOMException('arret', 'AbortError'); })).rejects.toThrow();
  });
  it('n’agrandit plus le graphe au-delà de sa borne', async () => {
    const plein: GrapheWikidata = {};
    for (let i = 0; i < MAX_ENTITES_GRAPHE; i++) plein[`Q${i + 1000}`] = {};
    const { appeler } = faux();
    await themesWikidataDe('Q1', { P31: ['Q7000900'] }, plein, appeler);
    expect(Object.keys(plein).length).toBe(MAX_ENTITES_GRAPHE);
  });
});

describe('repli « production, sinon Wikidata »', () => {
  const avec = (titre: string, wikidata: string[], extra: Partial<{ fortes: string[]; faibles: string[]; genre: 'personne' | 'autre' }> = {}) =>
    definirSignauxWikipedia(new Map([[titre, { fortes: [], faibles: [], genre: 'autre' as const, wikidata, ...extra }]]));
  it('donne les thèmes de Wikidata quand rien d’autre n’en donne', () => {
    avec('Novelists', ['metalcore']);
    expect(themesPrincipaux({ titre: 'Novelists', description: '' })).toEqual(['metalcore']);
    definirSignauxWikipedia(new Map());
  });
  it('ne remplace jamais un thème local', () => {
    avec('Daft Punk', ['rock'], { fortes: ['techno'] });
    expect(themesPrincipaux({ titre: 'Daft Punk', description: '' })).toEqual(['techno']);
    definirSignauxWikipedia(new Map());
  });
});

describe('parité avec le POC (graphe du banc réel)', () => {
  const graphe = chargerGraphe('specs/poc-themes/poc-b/graphe.json') as { titres: Record<string, { qid: string | null; homonymie: boolean }>; entites: GrapheWikidata };
  const complet: GrapheWikidata = {};
  for (const [qid, e] of Object.entries(graphe.entites)) complet[qid] = e;
  const titres = Object.keys(graphe.titres).filter((t) => graphe.titres[t]?.qid && !graphe.titres[t]?.homonymie);
  it('donne les mêmes thèmes que classer.mjs pour chaque titre récolté', () => {
    expect(titres.length).toBeGreaterThan(200);
    for (const t of titres) {
      const attendu = themesDuTitre(graphe, t, { parentsDe }).themes as string[];
      expect(themesDeGraphe(complet, graphe.titres[t]?.qid as string, parentsDe), t).toEqual(attendu);
    }
  });
  it('le fichier du POC est lisible', () => {
    expect(JSON.parse(readFileSync('specs/poc-themes/poc-b/graphe.json', 'utf8')).titres).toBeTypeOf('object');
  });
});

describe('verifierTitres avec le graphe Wikidata', () => {
  const page = { query: { pages: [{ title: 'Novelists', pageprops: { wikibase_item: 'Q1' }, categories: [] }] } };
  const transport = (urls: string[]): import('../../src/app/verifierWikipedia').Transport => async (url) => {
    urls.push(url);
    const u = new URL(url);
    if (u.hostname === 'fr.wikipedia.org') return { status: 200, json: async () => page };
    const ids = (u.searchParams.get('ids') ?? '').split('|');
    const props = u.searchParams.get('props');
    if (props === 'labels') return { status: 200, json: async () => ({ entities: Object.fromEntries(ids.map((id) => [id, { labels: { fr: { value: 'groupe' } } }])) }) };
    const parId: Record<string, ReturnType<typeof entite>> = { Q1: entite({ P31: ['Q7000900'] }), Q7000900: entite({ P279: ['Q183862'] }) };
    return { status: 200, json: async () => ({ entities: Object.fromEntries(ids.map((id) => [id, parId[id] ?? entite({})])) }) };
  };
  it('mémorise les thèmes des classes dans les signaux et agrandit le graphe', async () => {
    const { verifierTitres } = await import('../../src/app/verifierWikipedia');
    const { cacheVide } = await import('../../src/lib/wikipedia');
    const urls: string[] = [];
    const graphe: GrapheWikidata = {};
    let enregistre = 0;
    let dernier = cacheVide();
    await verifierTitres({ titres: ['Novelists'], cache: cacheVide(), signal: new AbortController().signal, surProgres: (c) => { dernier = c; }, attendre: async () => undefined, transport: transport(urls), graphe, surGraphe: () => { enregistre += 1; } });
    expect(dernier.entrees.Novelists?.signaux?.wikidata).toEqual(['metalcore']);
    expect(dernier.entrees.Novelists?.themes).toContain('metalcore');
    expect(enregistre).toBeGreaterThan(0);
    expect(graphe.Q7000900).toBeDefined();
    expect(urls.every((u) => new URL(u).hostname === 'fr.wikipedia.org' || new URL(u).hostname === 'www.wikidata.org')).toBe(true);
  });
  it('s’arrête sur 429 pendant la remontée du graphe', async () => {
    const { verifierTitres } = await import('../../src/app/verifierWikipedia');
    const { cacheVide } = await import('../../src/lib/wikipedia');
    const t: import('../../src/app/verifierWikipedia').Transport = async (url) => {
      const u = new URL(url);
      if (u.hostname === 'fr.wikipedia.org') return { status: 200, json: async () => page };
      if (u.searchParams.get('ids') === 'Q1') return { status: 200, json: async () => ({ entities: { Q1: entite({ P31: ['Q7000900'] }) } }) };
      return { status: 429, json: async () => ({}) };
    };
    const r = await verifierTitres({ titres: ['Novelists'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined, transport: t, graphe: {} });
    expect(r).toEqual({ verifiees: 0, arret: 'code-http', codeHttp: 429 });
  });
  it('sans graphe, rien ne change (aucune requête de plus)', async () => {
    const { verifierTitres } = await import('../../src/app/verifierWikipedia');
    const { cacheVide } = await import('../../src/lib/wikipedia');
    const urls: string[] = [];
    await verifierTitres({ titres: ['Novelists'], cache: cacheVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined, transport: transport(urls) });
    expect(urls.filter((u) => new URL(u).searchParams.get('props') === 'claims')).toHaveLength(1); // l’entité de la carte seulement, aucun ancêtre
  });
});
