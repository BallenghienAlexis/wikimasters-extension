import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { Carte } from '../../src/lib/collection';
import {
  ajouterAuCache, cacheIAVide, cartesAClasser, corpsRequete, decouperEnLotsIA, estimerCout, exporterCartesAClasser, lireImportThemes, PROMPT_EXPORT, IDS_CATALOGUE_IA, lireReponseIA, PROMPT_SYSTEME, TAILLE_LOT_IA, themesIAParTitre, validerCacheIA,
} from '../../src/lib/classificationIA';
import { definirThemesIA, sansThemeLocal, themesDeCarte, themesPrincipaux, versionThemes } from '../../src/lib/themes';
import { classerCartes, type TransportIA } from '../../src/app/classerIA';

const lot = [{ titre: 'Honda CB 900', description: '' }, { titre: 'Morcilla', description: 'spécialité' }, { titre: 'Zzz', description: '' }];
const reponse = (texte: string): unknown => ({ content: [{ type: 'text', text: texte }] });

afterEach(() => definirThemesIA(new Map()));

describe('prompt et requête', () => {
  it('le prompt est fixe et cite tout le catalogue', () => {
    expect(PROMPT_SYSTEME).toContain('moto : Moto');
    for (const id of IDS_CATALOGUE_IA) expect(PROMPT_SYSTEME).toContain(`${id} : `);
    expect(PROMPT_SYSTEME).toBe(corpsRequete(lot).system);
  });
  it('n’envoie que numéro, titre et description, corps stable', () => {
    const c = corpsRequete(lot);
    expect(c.messages[0]?.content).toBe('Cartes à classer :\n1. Honda CB 900\n2. Morcilla — spécialité\n3. Zzz');
    expect(corpsRequete(lot)).toEqual(c);
  });
  it('découpe en lots de 40', () => {
    const cartes = Array.from({ length: 95 }, (_, i) => ({ titre: `t${i}`, description: '' }));
    expect(decouperEnLotsIA(cartes).map((l) => l.length)).toEqual([TAILLE_LOT_IA, TAILLE_LOT_IA, 15]);
  });
});

describe('lireReponseIA', () => {
  it('lit un objet JSON valide, même entouré de texte', () => {
    const r = lireReponseIA(reponse('Voici : {"1":["moto"],"2":["gastronomie"],"3":[]}'), lot);
    expect([...r]).toEqual([['Honda CB 900', ['moto']], ['Morcilla', ['gastronomie']], ['Zzz', []]]);
  });
  it('ignore identifiant inconnu, plus de 4 thèmes, rang hors lot, JSON cassé et réponse inattendue', () => {
    expect(lireReponseIA(reponse('{"1":["inconnu"]}'), lot).size).toBe(0);
    expect(lireReponseIA(reponse('{"1":["moto","rock","jazz","rap","pop"]}'), lot).size).toBe(0);
    expect(lireReponseIA(reponse('{"9":["moto"]}'), lot).size).toBe(0);
    expect(lireReponseIA(reponse('{"1":'), lot).size).toBe(0);
    expect(lireReponseIA(null, lot).size).toBe(0);
    expect(lireReponseIA({ content: 'x' }, lot).size).toBe(0);
  });
  it('retire les doublons', () => {
    expect(lireReponseIA(reponse('{"1":["moto","moto"]}'), lot).get('Honda CB 900')).toEqual(['moto']);
  });
});

describe('cache', () => {
  it('valide et rejette', () => {
    const c = ajouterAuCache(cacheIAVide(), new Map([['A', ['moto']]]));
    expect(validerCacheIA(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(validerCacheIA({ ...c, version: 2 })).toBeNull();
    expect(Object.keys(validerCacheIA({ ...c, entrees: { A: ['nimporte'], B: ['moto'], C: 'moto' } })?.entrees ?? {})).toEqual(['B']);
    expect(validerCacheIA(null)).toBeNull();
  });
  it('les listes vides restent au cache mais ne donnent aucun thème', () => {
    const c = ajouterAuCache(cacheIAVide(), new Map([['A', ['moto']], ['B', []]]));
    expect([...themesIAParTitre(c).keys()]).toEqual(['A']);
  });
});

const carte = (titre: string, extra: Partial<Carte> = {}): Carte => ({ id: `c|${titre}`, titre, rarete: 'commune', description: '', quantite: 1, url: null, favori: false, idsSite: ['x'], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...extra });

describe('cartesAClasser et estimation', () => {
  it('ne garde que les cartes reliées, sans thème local, hors cache, une fois par titre', () => {
    const cartes = [carte('Zzz'), carte('Zzz'), carte('Chien', { description: 'race de chien' }), carte('Yyy', { idsSite: null }), carte('Déjà')];
    const cache = ajouterAuCache(cacheIAVide(), new Map([['Déjà', []]]));
    expect(cartesAClasser(cartes, cache, sansThemeLocal).map((c) => c.titre)).toEqual(['Zzz']);
  });
  it('estime un coût croissant avec le nombre de cartes', () => {
    const petit = estimerCout(lot);
    const grand = estimerCout(Array.from({ length: 400 }, (_, i) => ({ titre: `t${i}`, description: 'une description' })));
    expect(petit.requetes).toBe(1);
    expect(grand.requetes).toBe(10);
    expect(grand.cout).toBeGreaterThan(petit.cout);
  });
});

describe('surcouche IA dans les thèmes', () => {
  it('sert de dernier recours et ne remplace jamais un thème local', () => {
    const inconnue = carte('Qwxz');
    expect(themesPrincipaux(inconnue)).toEqual([]);
    const v = versionThemes();
    definirThemesIA(new Map([['Qwxz', ['moto', 'sport']], ['Chien', ['moto']]]));
    expect(versionThemes()).toBe(v + 1);
    expect(themesPrincipaux(inconnue)).toEqual(['moto', 'sport']);
    expect(sansThemeLocal(inconnue)).toBe(true);
    expect(themesDeCarte(inconnue)).toEqual(expect.arrayContaining(['moto', 'vehicule', 'sport']));
    expect(themesPrincipaux(carte('Chien', { description: 'race de chien' }))).not.toContain('moto');
  });
});

describe('classerCartes (transport simulé)', () => {
  const ok = (texte: string): TransportIA => async () => ({ status: 200, json: async () => reponse(texte) });
  const base = { cle: 'cle-test', cache: cacheIAVide(), signal: new AbortController().signal, surProgres: () => undefined, attendre: async () => undefined };

  it('classe, met en cache et envoie la clé dans l’en-tête seulement', async () => {
    const appels: { url: string; headers: Record<string, string>; body: string }[] = [];
    const transport: TransportIA = async (url, init) => { appels.push({ url, ...init }); return { status: 200, json: async () => reponse('{"1":["moto"],"2":["gastronomie"],"3":[]}') }; };
    const r = await classerCartes({ ...base, cartes: lot, transport });
    expect(r.arret).toBeNull();
    expect(r.lues).toBe(3);
    expect(r.cache.entrees['Honda CB 900']).toEqual(['moto']);
    expect(appels[0]?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(appels[0]?.headers['x-api-key']).toBe('cle-test');
    expect(appels[0]?.body).not.toContain('cle-test');
  });
  it('s’arrête sur 401, 429 sans rien lire ni recopier la clé', async () => {
    for (const status of [401, 429]) {
      const r = await classerCartes({ ...base, cartes: lot, transport: async () => ({ status, json: async () => ({ error: 'cle-test' }) }) });
      expect(r).toMatchObject({ arret: 'code-http', codeHttp: status, lues: 0 });
      expect(JSON.stringify(r)).not.toContain('cle-test');
    }
  });
  it('un refus 400 s’arrête tout de suite avec le message de l’API, sans la clé', async () => {
    const r = await classerCartes({ ...base, cartes: lot, transport: async () => ({ status: 400, json: async () => ({ error: { type: 'invalid_request_error', message: 'model: inconnu cle-test sk-ant-usr-abc' } }) }) });
    expect(r).toMatchObject({ arret: 'code-http', codeHttp: 400 });
    expect(r.detail).toContain('HTTP 400');
    expect(r.detail).toContain('invalid_request_error');
    expect(r.detail).not.toContain('cle-test');
    expect(r.detail).not.toContain('sk-ant');
  });
  it('une erreur réseau est expliquée et un échec isolé ne stoppe pas la suite', async () => {
    const cartes = Array.from({ length: 80 }, (_, i) => ({ titre: `t${i}`, description: '' }));
    let n = 0;
    const transport: TransportIA = async () => { if (n++ === 0) throw new TypeError('Failed to fetch'); return { status: 200, json: async () => reponse('{"1":["moto"]}') }; };
    const r = await classerCartes({ ...base, cartes, transport });
    expect(r.arret).toBeNull();
    expect(r.lues).toBe(1);
    const t: TransportIA = async () => { throw new TypeError('Failed to fetch'); };
    const r2 = await classerCartes({ ...base, cartes, transport: t });
    expect(r2.arret).toBe('aucune-lue');
    expect(r2.detail).toContain('Failed to fetch');
  });
  it('saute un lot en 529 puis reprend, attend entre deux requêtes et compte le lot sauté', async () => {
    const cartes = Array.from({ length: 80 }, (_, i) => ({ titre: `t${i}`, description: '' }));
    let n = 0;
    let pauses = 0;
    const transport: TransportIA = async () => (n++ === 0 ? { status: 529, json: async () => ({ error: { type: 'overloaded_error', message: 'surcharge' } }) } : { status: 200, json: async () => reponse('{"1":["moto"]}') });
    const r = await classerCartes({ ...base, cartes, transport, attendre: async () => { pauses++; } });
    expect(r).toMatchObject({ arret: null, lues: 1, sautes: 1 });
    expect(r.detail).toContain('overloaded_error');
    expect(pauses).toBe(2);
    pauses = 0;
    await classerCartes({ ...base, cartes: [{ titre: 'a', description: '' }, ...cartes], transport: async () => { throw new TypeError('x'); }, attendre: async () => { pauses++; } });
    expect(pauses).toBe(3);
  });
  it('s’arrête après 5 réponses inexploitables', async () => {
    const cartes = Array.from({ length: 400 }, (_, i) => ({ titre: `t${i}`, description: '' }));
    let n = 0;
    const r = await classerCartes({ ...base, cartes, transport: async () => { n++; return { status: 200, json: async () => reponse('rien') }; } });
    expect(r.arret).toBe('echecs');
    expect(n).toBe(5);
    expect(r.detail).toContain('inexploitable');
  });
  it('s’arrête quand on l’interrompt', async () => {
    const ctl = new AbortController();
    ctl.abort();
    expect((await classerCartes({ ...base, cartes: lot, signal: ctl.signal, transport: ok('{}') })).arret).toBe('manuel');
  });
  it('est reproductible : même entrée, même cache', async () => {
    const t = ok('{"1":["moto"],"2":["gastronomie"],"3":[]}');
    const a = await classerCartes({ ...base, cartes: lot, transport: t });
    const b = await classerCartes({ ...base, cartes: lot, transport: t });
    expect(a.cache).toEqual(b.cache);
  });
});

describe('mémo des étiquettes de la carte', () => {
  it('se périme quand une surcouche de thèmes change', async () => {
    const { etiquettesDeCarte } = await import('../../src/lib/lot');
    const c = carte('Qwxz');
    expect(etiquettesDeCarte(c).retenues).toEqual([]);
    definirThemesIA(new Map([['Qwxz', ['moto']]]));
    expect(etiquettesDeCarte(c).retenues).toEqual(['#Moto']);
  });
});

describe('robustesse', () => {
  it('un titre comme « constructor » ou « __proto__ » est classable et mis en cache', () => {
    const cache = ajouterAuCache(cacheIAVide(), new Map([['__proto__', ['moto']], ['constructor', []]]));
    expect(Object.keys(cache.entrees).sort()).toEqual(['__proto__', 'constructor']);
    expect(cartesAClasser([carte('constructor'), carte('toString')], cacheIAVide(), sansThemeLocal).map((c) => c.titre)).toEqual(['constructor', 'toString']);
  });
  it('themesDeCarte n’ajoute les thèmes IA que sans thème local', () => {
    definirThemesIA(new Map([['Chien', ['moto']]]));
    expect(themesDeCarte(carte('Chien', { description: 'race de chien' }))).not.toContain('moto');
  });
});

describe('export / import sans clé', () => {
  it('exporte titre et description courte seulement', () => {
    const brut = JSON.parse(exporterCartesAClasser([{ titre: 'Morcilla', description: '  spécialité\n  espagnole ' }]));
    expect(brut.cartes).toEqual([{ id: 1, titre: 'Morcilla', description: 'spécialité espagnole' }]);
  });
  it('le fichier exporté contient le prompt, le catalogue et la règle des 1 à 4 thèmes', () => {
    const brut = JSON.parse(exporterCartesAClasser([{ titre: 'Morcilla', description: '' }]));
    expect(brut.prompt).toBe(PROMPT_EXPORT);
    expect(brut.prompt).toContain('TITRES EXACTS');
    expect(brut.prompt).toContain('de 1 à 4 thèmes');
    expect(brut.prompt).toContain('Autres');
    for (const id of IDS_CATALOGUE_IA) expect(brut.prompt).toContain(`${id} : `);
  });
  it('importe une réponse d’IA entourée de texte, en bloc de code ou en plusieurs objets', () => {
    const connus = new Set(['A', 'B', 'C {x}']);
    const r = lireImportThemes('Voici le résultat :\n```json\n{"A":["moto"],"C {x}":["rock"]}\n```\nLot 2 :\n{"B":["jazz"]}\nBonne journée !', connus);
    expect(r.type).toBe('ok');
    if (r.type !== 'ok') return;
    expect([...r.resultats.keys()].sort()).toEqual(['A', 'B', 'C {x}']);
    expect(r.ignores).toBe(0);
  });
  it('importe 1 à 4 thèmes du catalogue pour des cartes connues et compte le reste', () => {
    const connus = new Set(['Honda CB 900', 'Morcilla', 'Zzz']);
    const r = lireImportThemes('{"Honda CB 900":["moto"],"Morcilla":["gastronomie","gastronomie"],"Zzz":[],"Inconnue":["moto"],"__proto__":["moto"]}', connus);
    expect(r.type).toBe('ok');
    if (r.type !== 'ok') return;
    expect([...r.resultats.keys()]).toEqual(['Honda CB 900']);
    expect(r.ignores).toBe(4);
  });
  it('refuse thème hors liste, plus de 4 thèmes, JSON invalide ou tableau', () => {
    const connus = new Set(['A']);
    expect(lireImportThemes('{"A":["inventé"]}', connus).type).toBe('invalide');
    expect(lireImportThemes(`{"A":${JSON.stringify(IDS_CATALOGUE_IA.slice(0, 5))}}`, connus).type).toBe('invalide');
    expect(lireImportThemes('pas du json', connus).type).toBe('invalide');
    expect(lireImportThemes('{"A":["moto"', connus).type).toBe('invalide');
    expect(lireImportThemes('[]', connus).type).toBe('invalide');
  });
  it('le prompt de docs/classement-par-ia.md cite tout le catalogue', () => {
    const doc = fs.readFileSync('docs/classement-par-ia.md', 'utf8');
    expect(doc).toContain(PROMPT_EXPORT);
    expect(PROMPT_EXPORT).not.toContain('liste vide pour cette carte');
    for (const id of IDS_CATALOGUE_IA) expect(doc).toContain(`${id} : `);
    expect(doc).toContain('Exporter les cartes sans thème');
  });
});
