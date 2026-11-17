// « #Autres » n’est qu’un repli d’affichage : une carte à laquelle les signaux de la page (définition, classes Wikidata)
// donnent un thème fiable ne doit jamais y figurer, et une carte vraiment sans thème doit rester dans la lecture de fond.
import { afterEach, describe, expect, it } from 'vitest';
import { definirSignauxWikipedia, definirThemesWikipedia, sansThemeLocal, themesDeCarte, themesPrincipaux, THEME_AUTRES } from '../../src/lib/themes';

afterEach(() => {
  definirSignauxWikipedia(new Map());
  definirThemesWikipedia(new Map());
});

describe('#Autres et signaux de page', () => {
  const carte = { titre: 'Zzyx', description: 'Une carte mystérieuse.' };

  it('sans aucun signal : « autres » pour l’affichage, mais encore à classer en arrière-plan', () => {
    expect(themesDeCarte(carte)).toEqual([THEME_AUTRES]);
    expect(sansThemeLocal(carte)).toBe(true);
  });

  it('un thème fort de la page (entrée sans thèmes de catégories) sort la carte de « autres »', () => {
    definirSignauxWikipedia(new Map([['Zzyx', { fortes: ['metalcore'], faibles: [], genre: 'organisation' as const }]]));
    definirThemesWikipedia(new Map([['Zzyx', []]]));
    expect(sansThemeLocal(carte)).toBe(false);
    expect(themesPrincipaux(carte)).toContain('metalcore');
    const themes = themesDeCarte(carte);
    expect(themes).not.toContain(THEME_AUTRES);
    expect(themes).toEqual(expect.arrayContaining(['metalcore', 'metal', 'musique']));
  });
});
