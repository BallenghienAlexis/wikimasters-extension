/**
 * Surcouches de thèmes du content script (cache Wikipédia, classement IA, thèmes appris), lues dans `chrome.storage.local` et
 * posées en mémoire comme le fait la page de gestion (`useDonneesPage.ts`). Lecture seule, aucune requête réseau.
 * Le content script a son propre exemplaire de `themes.ts` : sans cet appel il ne connaît que les mots-clés du titre et de la
 * description, et la relance automatique ignorait les thèmes de Wikipédia (ex. « Guerre » suivi par un ami).
 */
import { themesIAParTitre } from '../lib/classificationIA';
import { chargerCacheIA, chargerCacheWikipedia, chargerThemesAppris } from '../lib/stockage';
import { definirCategoriesWikipedia, definirSignauxWikipedia, definirThemesAppris, definirThemesIA, definirThemesWikipedia } from '../lib/themes';
import { categoriesParTitre, signauxParTitre, themesParTitre } from '../lib/wikipedia';

export async function chargerSurcouchesThemes(): Promise<void> {
  // Les thèmes appris d’abord : le catalogue en mémoire les connaît avant le calcul des thèmes des cartes.
  const appris = await chargerThemesAppris();
  definirThemesAppris(appris.themes);
  const [wiki, ia] = await Promise.all([chargerCacheWikipedia(), chargerCacheIA()]);
  definirThemesWikipedia(themesParTitre(wiki));
  definirSignauxWikipedia(signauxParTitre(wiki));
  definirCategoriesWikipedia(categoriesParTitre(wiki));
  definirThemesIA(themesIAParTitre(ia));
}
