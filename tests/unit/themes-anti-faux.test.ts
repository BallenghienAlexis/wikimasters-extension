// Correctifs anti-faux thèmes (rapport poc-themes/diagnostic-faux-themes-2026-11-19) : noms propres de lieux, catégories en confirmation, seuil de 60 %.
import { afterEach, describe, expect, it } from 'vitest';
import { definirSignauxWikipedia, themesDeTexte, themesDirectsDeTexte, themesPrincipaux } from '../../src/lib/themes';
import { signauxWikipedia } from '../../src/lib/wikipedia';

afterEach(() => definirSignauxWikipedia(new Map()));

describe('noms propres de lieux composés', () => {
  it.each([
    ['Château de Saint-Denis', 'religion'],
    ['Basilique de Sainte-Anne-de-Beaupré', 'religion'],
    ['Mont-de-Marsan est une commune', 'montagne'],
    ['Mont-Saint-Michel', 'religion'],
    ['Fond du Lac', 'lac'],
    ['Bonne-Pays-Bas', 'pays'],
    ['Les Pays-Bas', 'pays'],
    ['territoire d’outre-mer', 'ocean'],
    ['Dives-sur-Mer', 'geographie'],
  ])('« %s » ne donne pas « %s »', (texte, interdit) => {
    expect(themesDirectsDeTexte(texte)).not.toContain(interdit);
  });
  it('garde les mots ordinaires : un saint, une montagne, un lac', () => {
    expect(themesDirectsDeTexte('un saint de l’Église catholique')).toContain('religion');
    expect(themesDirectsDeTexte('Le mont Blanc est une montagne des Alpes')).toContain('montagne');
    expect(themesDirectsDeTexte('Le lac Léman est un lac')).toContain('lac');
  });
  it('garde Saint-Siège et Saint-Empire', () => {
    expect(themesDirectsDeTexte('Le Saint-Siège')).toContain('religion');
  });
  it('ne décale pas les indices : un nom propre à côté d’un mot-clé ne le fait pas disparaître', () => {
    expect(themesDeTexte('Saint-Denis, un barrage hydroélectrique')).toContain('barrage');
  });
});

describe('catégories Wikipédia : confirmation seulement', () => {
  const lire = (titre: string, description: string, resume: string, categories: string[]) => {
    definirSignauxWikipedia(new Map([[titre, signauxWikipedia(categories, resume)]]));
    return themesPrincipaux({ titre, description });
  };
  it('une catégorie n’ajoute pas un thème secondaire à une personne (Einstein)', () => {
    const themes = lire('Albert Einstein', 'physicien théoricien', 'Albert Einstein, né le 14 mars 1879, est un physicien théoricien.', ['Physicien allemand', 'Lauréat du prix Nobel de physique', 'Pacifiste', 'Personnalité de la politique israélienne', 'Violoniste allemand']);
    expect(themes).not.toContain('politique');
    expect(themes).not.toContain('musique');
    expect(themes).toContain('physique');
  });
  it('une catégorie confirme un thème déjà établi', () => {
    const themes = lire('Serre-Ponçon', 'barrage hydroélectrique', 'Serre-Ponçon est un barrage hydroélectrique.', ['Barrage en France']);
    expect(themes).toContain('barrage');
  });
  it('une catégorie sert de dernier recours quand rien d’autre ne donne de thème', () => {
    expect(lire('Inconnu', '', 'Page sans définition claire.', ['Barrage en France'])).toContain('barrage');
  });
  it('le thème de Wikidata passe avant les seules catégories', () => {
    definirSignauxWikipedia(new Map([['Inconnu', { ...signauxWikipedia(['Barrage en France'], ''), wikidata: ['metalcore'] }]]));
    expect(themesPrincipaux({ titre: 'Inconnu', description: '' })).toEqual(['metalcore']);
  });
});

describe('seuil de 60 %', () => {
  it('écarte un thème venu seulement du texte quand la définition en établit un autre', () => {
    definirSignauxWikipedia(new Map([['Marie Curie', signauxWikipedia(['Chimiste polonais', 'Enseignant à l’université de Paris'], 'Marie Curie est une physicienne et chimiste polonaise naturalisée française.')]]));
    const themes = themesPrincipaux({ titre: 'Marie Curie', description: 'physicienne et chimiste, enseignante à l’université' });
    expect(themes).not.toContain('education');
  });
});
