// Mesure avant/après de la reprise des recommandations des POC (2026-11-19) sur les 277 cartes réelles du banc.
// « Avant » : le code de production tel qu'il était avant la reprise (copie dans AVANT, variable d'environnement).
// « Après » : le code actuel, avec ses thèmes par classes Wikidata lus dans le graphe du POC (aucun réseau).
//   AVANT=/chemin/vers/copie/src npx vitest run --config specs/poc-themes/poc-b/vitest.config.ts mesure-production
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { themesDeGraphe, type GrapheWikidata } from '../../../src/lib/classesWikidata';
import { definirSignauxWikipedia, parentsDe, themesPrincipaux } from '../../../src/lib/themes';
import { evaluer, formaterRapport } from '../../../tests/benchmark-themes/scoring';
// @ts-expect-error module JS sans types
import { chargerGraphe } from './classer.mjs';

type C = { titre: string; description: string; wikipedia: string };
interface Graphe { titres: Record<string, { qid: string | null; homonymie: boolean }>; entites: GrapheWikidata }

it('avant / après', async () => {
  const { AVANT, SORTIE } = process.env;
  const graphe = chargerGraphe('specs/poc-themes/poc-b/graphe.json') as Graphe;
  const wikidata = (c: C): string[] => {
    const info = graphe.titres[c.wikipedia] ?? graphe.titres[c.wikipedia.replaceAll("'", '’')] ?? graphe.titres[c.wikipedia.replaceAll('’', "'")];
    return info?.qid && !info.homonymie ? themesDeGraphe(graphe.entites, info.qid, parentsDe) : [];
  };
  const apresSansWikidata = (c: C): string[] => { definirSignauxWikipedia(new Map()); return themesPrincipaux(c); };
  const apres = (c: C): string[] => {
    definirSignauxWikipedia(new Map([[c.titre, { fortes: [], faibles: [], genre: 'autre', wikidata: wikidata(c) }]]));
    return themesPrincipaux(c);
  };
  const lignes: [string, (c: C) => string[]][] = [['Après : titre + description seuls', apresSansWikidata], ['Après : production, sinon Wikidata', apres], ['Wikidata seul', wikidata]];
  if (AVANT) {
    const vieux = await import(/* @vite-ignore */ `${AVANT}/lib/themes.ts`);
    lignes.unshift(['Avant : production', (c) => vieux.themesPrincipaux(c)]);
  }
  const opts = { source: 'reelle' as const, fiabiliteMin: 'moyenne' as const };
  const sortie: string[] = [];
  for (const [nom, f] of lignes) {
    const r = await evaluer(f, opts);
    const g = r.global;
    sortie.push(`${nom}\t${(g.precision * 100).toFixed(1)}\t${(g.rappel * 100).toFixed(1)}\t${(g.f1 * 100).toFixed(1)}\t${(g.tauxSansThemeATort * 100).toFixed(1)}\t${((g.tauxCartesAvecFauxTheme) * 100).toFixed(1)}\t${g.cartes}`);
    if (SORTIE) writeFileSync(`${SORTIE}/${nom.replace(/\W+/g, '-')}.txt`, formaterRapport(r, nom));
  }
  writeFileSync(SORTIE ? `${SORTIE}/avant-apres.tsv` : '/tmp/avant-apres.tsv', ['méthode\tprécision\trappel\tF1\tsans thème à tort\tcartes avec faux thème\tcartes', ...sortie].join('\n'));
});
