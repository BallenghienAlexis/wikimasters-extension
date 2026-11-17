// POC thèmes — les méthodes comparées, sur une même carte de test.
import { definirSignauxWikipedia, themesPrincipaux } from '../../../src/lib/themes';
import { signauxWikipedia } from '../../../src/lib/wikipedia';
import { calculerSignaux } from './signaux';
import { V1, V2, voter } from './vote';
import type { Page } from './types';

/** A : la logique de production, alimentée par les mêmes données (signaux Wikipédia et Wikidata en cache, description du site). */
export function baselineProduction(page: Page): string[] {
  definirSignauxWikipedia(new Map([[page.titre, signauxWikipedia(page.categories, page.resume, page.descriptionWikidata, page.classesWikidata, page.humain)]]));
  const themes = themesPrincipaux({ titre: page.titre, description: page.descriptionSite });
  definirSignauxWikipedia(new Map());
  return themes;
}

/** V3 : vote pondéré ; s'il ne retient rien, les thèmes de production ne passent que s'ils sont portés par la définition de la page. */
export function hybride(page: Page): string[] {
  const vote = voter(page, V2);
  if (vote.length > 0) return vote;
  const def = new Set(calculerSignaux(page).definition);
  return baselineProduction(page).filter((id) => def.has(id));
}

export const METHODES: { nom: string; predire: (p: Page) => string[] }[] = [
  { nom: 'A production actuelle', predire: baselineProduction },
  { nom: V1.nom, predire: (p) => voter(p, V1) },
  { nom: V2.nom, predire: (p) => voter(p, V2) },
  { nom: 'V3 vote V2 + repli défini par la définition', predire: hybride },
];
