// POC thèmes — signaux indépendants. Chaque signal ne voit qu'une source et propose des thèmes du catalogue ;
// il ne décide rien : la décision est dans vote.ts. Les motifs viennent du catalogue de production (src/lib/themes.ts), en lecture seule.
import { normaliser } from '../../../src/lib/collection';
import { definition, genreDe, type Genre } from '../../../src/lib/sens';
import { parentsDe, themesDirectsDeTexte } from '../../../src/lib/themes';
import type { Page, Signaux } from './types';

const TECHNIQUE = /^(articles? |pages? |wikipedia|portail|ebauche|homonymie)/;

export const categoriesUtiles = (categories: readonly string[]): string[] => categories.filter((c) => !TECHNIQUE.test(normaliser(c)));

/** Tous les ancêtres d'un thème (fermeture transitoire, sans boucle). */
export function ancetres(id: string, vus = new Set<string>()): Set<string> {
  for (const p of parentsDe(id)) {
    if (vus.has(p)) continue;
    vus.add(p);
    ancetres(p, vus);
  }
  return vus;
}

const phrases = (texte: string): string[] => texte.replaceAll('’', "'").split(/(?<=[.!?])\s+(?=\p{Lu})/u).map((p) => p.trim()).filter((p) => p !== '');

/**
 * Classifieur local léger sur le texte complet de l'introduction : un thème est retenu s'il est porté par la première phrase,
 * ou par au moins deux phrases distinctes, et si son poids atteint 40 % du meilleur. Une mention isolée plus loin dans le texte
 * (« …tirait le wagon comme une voiture ») ne suffit donc pas.
 */
export function signalLexical(resume: string): string[] {
  const poids = new Map<string, { score: number; phrases: Set<number>; premiere: boolean }>();
  phrases(resume).forEach((p, i) => {
    for (const id of themesDirectsDeTexte(p)) {
      const e = poids.get(id) ?? { score: 0, phrases: new Set<number>(), premiere: false };
      e.score += i === 0 ? 3 : 1;
      e.phrases.add(i);
      if (i === 0) e.premiere = true;
      poids.set(id, e);
    }
  });
  const meilleur = Math.max(0, ...[...poids.values()].map((e) => e.score));
  return [...poids.entries()].filter(([, e]) => (e.premiere || e.phrases.size >= 2) && e.score * 5 >= meilleur * 2).map(([id]) => id);
}

export function calculerSignaux(page: Page): Signaux {
  const def = definition(page.resume);
  return {
    site: themesDirectsDeTexte(definition(page.descriptionSite)),
    definition: themesDirectsDeTexte(def),
    wikidata: [...new Set([...page.descriptionWikidata, ...page.classesWikidata].flatMap((t) => themesDirectsDeTexte(t)))],
    categories: themesDirectsDeTexte(categoriesUtiles(page.categories).join(' . '), true),
    lexical: signalLexical(page.resume),
  };
}

export function genreDePage(page: Page): Genre {
  if (page.humain) return 'personne';
  const def = definition(page.resume);
  const g = genreDe(page.resume, def);
  if (g !== 'autre') return g;
  const wd = [...page.classesWikidata, ...page.descriptionWikidata].map((t) => genreDe(t)).find((x) => x !== 'autre');
  return wd ?? genreDe(page.descriptionSite);
}
