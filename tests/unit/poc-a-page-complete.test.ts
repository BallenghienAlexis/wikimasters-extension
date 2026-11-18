// POC A (page Wikipédia complète) : découpage de la page, scoring par canaux, et évaluation sur le banc d’essai si des pages réelles sont fournies.
// Les pages ci-dessous sont des FIXTURES rédigées à la main (non relevées) : elles vérifient le code, pas la qualité réelle.
// Évaluation réelle : POC_PAGES=<pages.json produit par collecter.mjs> npx vitest run tests/unit/poc-a-page-complete.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyserReponseParse, enTexteBrut, lireInfobox } from '../../specs/poc-themes/poc-a-page-complete/page';
import { deduirePage, VARIANTES } from '../../specs/poc-themes/poc-a-page-complete/methode';
import { urlParse, lireTitres } from '../../specs/poc-themes/poc-a-page-complete/collecter.mjs';
import { evaluer, formaterRapport } from '../benchmark-themes/scoring';
import { deductionProduction } from '../benchmark-themes/production';

const WIKITEXTE = `{{Infobox Musique (artiste)
| nom = Groupe fictif
| genre = [[Metalcore]], [[heavy metal|metal]]
| années actives = 2000-2010
}}
Le '''Groupe fictif''' est un groupe de [[metalcore]] français.<ref>note</ref> Il a sorti trois albums.

== Histoire ==
Le groupe est formé à Lyon.

== Notes et références ==
{{Références}}
`;
const REPONSE = { parse: { wikitext: WIKITEXTE, categories: [{ category: 'Groupe_français_de_metalcore' }, { category: 'Article_caché', hidden: true }], sections: [{ line: 'Histoire' }, { line: 'Notes et références' }], links: [{ ns: 0, title: 'Lyon' }, { ns: 14, title: 'Catégorie:X' }], properties: [] } };

describe('page.ts', () => {
  it('retire liens, balises et modèles', () => {
    expect(enTexteBrut("Le '''chat''' [[Félin|félin]] [[Lyon]]<ref>x</ref> {{m}}.")).toBe('Le chat félin Lyon .');
  });
  it('lit le modèle et les champs utiles de l’infobox', () => {
    const i = lireInfobox(WIKITEXTE);
    expect(i.modele).toBe('Infobox Musique (artiste)');
    expect(i.valeurs).toEqual(['Metalcore, metal']);
  });
  it('découpe la réponse en canaux', () => {
    const p = analyserReponseParse(REPONSE, 'Groupe fictif');
    expect(p?.definition).toMatch(/^Le Groupe fictif est un groupe de metalcore français\./);
    expect(p?.categories).toEqual(['Groupe français de metalcore']);
    expect(p?.sections).toEqual(['Histoire']);
    expect(p?.liens).toEqual(['Lyon']);
  });
  it('rend null pour une réponse sans wikitexte', () => {
    expect(analyserReponseParse({ erreurHttp: 500 }, 'x')).toBeNull();
    expect(analyserReponseParse({ parse: {} }, 'x')).toBeNull();
  });
});

describe('methode.ts', () => {
  it('pose metalcore (le plus précis) sans ses parents', () => {
    const p = analyserReponseParse(REPONSE, 'Groupe fictif')!;
    const { themes, canaux } = deduirePage(p, VARIANTES['A3 page complète']!);
    expect(themes).toContain('metalcore');
    expect(themes).not.toContain('metal');
    expect(canaux.metalcore).toEqual(expect.arrayContaining(['definition', 'infobox', 'categories']));
  });
  it('ne pose rien pour une page d’homonymie', () => {
    const p = { ...analyserReponseParse(REPONSE, 'x')!, homonymie: true };
    expect(deduirePage(p, VARIANTES['A3 page complète']!).themes).toEqual([]);
  });
  it('ne pose rien sans canal fort', () => {
    const p = { ...analyserReponseParse(REPONSE, 'x')!, definition: '', infoboxModele: '', infoboxValeurs: [], categories: [], intro: '', corps: 'metalcore metalcore', sections: ['Metalcore'] };
    expect(deduirePage(p, VARIANTES['A3 page complète']!).themes).toEqual([]);
  });
});

describe('collecter.mjs', () => {
  it('construit une seule requête GET de lecture avec le titre seul', () => {
    const u = new URL(urlParse('Wagon'));
    expect(u.hostname).toBe('fr.wikipedia.org');
    expect(u.searchParams.get('page')).toBe('Wagon');
    expect([...u.searchParams.keys()].sort()).toEqual(['action', 'disabletoc', 'format', 'formatversion', 'page', 'prop', 'redirects']);
  });
  it('lit des titres de plusieurs formes sans doublon', () => {
    expect(lireTitres(['A', { wikipedia: 'B' }, { titre: 'A' }])).toEqual(['A', 'B']);
  });
});

const CHEMIN = process.env.POC_PAGES;
describe.skipIf(!CHEMIN)('évaluation sur pages réelles (POC_PAGES)', () => {
  it('compare les variantes au banc d’essai', async () => {
    const brut = JSON.parse(readFileSync(CHEMIN!, 'utf8')) as Record<string, unknown>;
    const sortie: Record<string, unknown> = {};
    for (const [nom, options] of Object.entries(VARIANTES)) {
      const rapport = await evaluer(({ wikipedia }) => {
        const page = analyserReponseParse(brut[wikipedia], wikipedia);
        return page ? deduirePage(page, options).themes : [];
      });
      console.log(formaterRapport(rapport, nom));
      sortie[nom] = rapport;
    }
    if (process.env.POC_SORTIE) writeFileSync(process.env.POC_SORTIE, JSON.stringify(sortie, null, 1));
    expect(Object.keys(sortie).length).toBe(Object.keys(VARIANTES).length);
  }, 300_000);
  it('compare les hybrides production + page', async () => {
    const brut = JSON.parse(readFileSync(CHEMIN!, 'utf8')) as Record<string, unknown>;
    const A = (w: string, v: string): string[] => { const p = analyserReponseParse(brut[w], w); return p ? deduirePage(p, VARIANTES[v]!).themes : []; };
    const A3 = 'A3 page complète';
    const A5 = 'A5 complète, 2 canaux forts, seuil 5';
    const methodes: Record<string, (c: { titre: string; description: string; wikipedia: string }) => string[]> = {
      'P production': (c) => deductionProduction(c) as string[],
      'H1 production, puis A5 si vide': (c) => { const p = deductionProduction(c) as string[]; return p.length > 0 ? p : A(c.wikipedia, A5); },
      'H2 production filtrée par A3': (c) => { const a = new Set(A(c.wikipedia, A3)); return (deductionProduction(c) as string[]).filter((x) => a.has(x)); },
      'H3 H2, puis A5 si vide': (c) => { const a = new Set(A(c.wikipedia, A3)); const r = (deductionProduction(c) as string[]).filter((x) => a.has(x)); return r.length > 0 ? r : A(c.wikipedia, A5); },
    };
    for (const [nom, f] of Object.entries(methodes)) console.log(formaterRapport(await evaluer(f), nom, 0));
  }, 300_000);
});
