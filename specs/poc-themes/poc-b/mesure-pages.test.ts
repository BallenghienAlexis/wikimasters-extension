// Mesure avant/après AVEC les pages Wikipédia réelles des 277 cartes (cache rempli) : effet des catégories en confirmation,
// du seuil de 60 % et des noms de lieux, puis de Wikidata en repli. À lancer avec les pages collectées par poc/collecter.mjs :
//   AVANT=/chemin/copie/src PAGES=pages.json SORTIE=/chemin/dossier npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts mesure-pages
// Le résumé est coupé à deux phrases, comme la requête de production (`exsentences: 2`).
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { themesDeGraphe, type GrapheWikidata } from '../../../src/lib/classesWikidata';
import { definirSignauxWikipedia, parentsDe, themesPrincipaux } from '../../../src/lib/themes';
import { signauxWikipedia } from '../../../src/lib/wikipedia';
import { evaluer, formaterRapport } from '../../../tests/benchmark-themes/scoring';
import type { Page } from '../poc/types';
// @ts-expect-error module JS sans types
import { chargerGraphe } from './classer.mjs';

type C = { titre: string; description: string; wikipedia: string };
interface Graphe { titres: Record<string, { qid: string | null; homonymie: boolean }>; entites: GrapheWikidata }

const deuxPhrases = (t: string): string => t.split(/(?<=[.!?])\s+(?=\p{Lu})/u).slice(0, 2).join(' ');

it('avant / après, pages réelles', async () => {
  const { AVANT, PAGES, SORTIE } = process.env;
  if (!AVANT || !PAGES) return;
  const jeu = JSON.parse(readFileSync(PAGES, 'utf8')) as { cartes: { page: Page }[] };
  const pages = new Map(jeu.cartes.map((c) => [c.page.titre, c.page]));
  const graphe = chargerGraphe('specs/poc-themes/poc-b/graphe.json') as Graphe;
  const vieuxThemes = await import(/* @vite-ignore */ `${AVANT}/lib/themes.ts`);
  const vieuxWiki = await import(/* @vite-ignore */ `${AVANT}/lib/wikipedia.ts`);
  const qid = (c: C): string | null => {
    const info = graphe.titres[c.wikipedia] ?? graphe.titres[c.wikipedia.replaceAll("'", '’')] ?? graphe.titres[c.wikipedia.replaceAll('’', "'")];
    return info?.qid && !info.homonymie ? info.qid : null;
  };
  const wikidata = (c: C): string[] => { const q = qid(c); return q ? themesDeGraphe(graphe.entites, q, parentsDe) : []; };
  const avant = (c: C): string[] => {
    const p = pages.get(c.titre);
    vieuxThemes.definirSignauxWikipedia(new Map(p && !p.homonymie ? [[c.titre, vieuxWiki.signauxWikipedia(p.categories, deuxPhrases(p.resume), [], p.classesWikidata, p.humain)]] : []));
    return vieuxThemes.themesPrincipaux(c);
  };
  const apres = (avecClasses: boolean) => (c: C): string[] => {
    const p = pages.get(c.titre);
    definirSignauxWikipedia(new Map(p && !p.homonymie ? [[c.titre, signauxWikipedia(p.categories, deuxPhrases(p.resume), [], p.classesWikidata, p.humain, avecClasses ? wikidata(c) : [])]] : []));
    return themesPrincipaux(c);
  };
  const lignes: [string, (c: C) => string[]][] = [['Avant : production avec pages Wikipédia', avant], ['Après : règles anti-faux thèmes, sans classes Wikidata', apres(false)], ['Après : règles anti-faux thèmes et Wikidata en repli', apres(true)]];
  const opts = { source: 'reelle' as const, fiabiliteMin: 'moyenne' as const };
  const sortie: string[] = [`Pages collectées : ${pages.size}`];
  for (const [nom, f] of lignes) {
    const r = await evaluer(f, opts);
    const g = r.global;
    sortie.push(`${nom}\t${(g.precision * 100).toFixed(1)}\t${(g.rappel * 100).toFixed(1)}\t${(g.f1 * 100).toFixed(1)}\t${(g.tauxSansThemeATort * 100).toFixed(1)}\t${(g.tauxCartesAvecFauxTheme * 100).toFixed(1)}\t${g.cartes}`);
    if (SORTIE) writeFileSync(`${SORTIE}/pages-${nom.replace(/\W+/g, '-')}.txt`, formaterRapport(r, nom));
  }
  writeFileSync(`${SORTIE ?? '/tmp'}/avant-apres-pages.tsv`, ['méthode\tprécision\trappel\tF1\tsans thème à tort\tcartes avec faux thème\tcartes', ...sortie].join('\n'));
});
