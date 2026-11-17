import { afterEach, describe, expect, it } from 'vitest';
import { categoriesUtiles } from '../../src/lib/wikipedia';
import { definirCategoriesWikipedia, definirThemesAppris, IDS_THEMES, LIBELLES_THEMES, themesDeCarte, themesPrincipaux } from '../../src/lib/themes';
import { categorieUtilisable, erreurDeNom, etatApprisVide, fusionner, libelleDepuisCategorie, proposerThemes, renommer, retablir, supprimer, validerEtatAppris } from '../../src/lib/themesAppris';
import { enfantsDe } from '../../src/lib/arbreThemes';

afterEach(() => {
  definirThemesAppris([]);
  definirCategoriesWikipedia(new Map());
});

const entrees = (n: number, categories: string[], themes: string[] = ['alcool', 'gastronomie']) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`Carte ${i}`, { categories, themes }]));

describe('thèmes appris', () => {
  it('une catégorie inconnue sur 5 cartes devient un thème rangé dans la famille des cartes', () => {
    const etat = proposerThemes(entrees(5, ['Spécialité artisanale']), etatApprisVide(), 1000);
    expect(etat.themes).toHaveLength(1);
    expect(etat.themes[0]).toMatchObject({ libelle: '#Spécialité artisanale', cartes: 5, etat: 'actif', parents: ['alcool', 'gastronomie'] });
    expect(etat.journal[0]?.texte).toContain('Thème appris');
  });
  it('sous le seuil, une catégorie connue du catalogue, une année ou « par pays » ne donnent rien', () => {
    expect(proposerThemes(entrees(4, ['Spécialité artisanale']), etatApprisVide(), 1).themes).toHaveLength(0);
    expect(proposerThemes(entrees(9, ['Rhum']), etatApprisVide(), 1).themes).toHaveLength(0);
    expect(proposerThemes(entrees(9, ['Naissance en 1950', 'Chanteur par pays', 'Personnalité née à Lyon']), etatApprisVide(), 1).themes).toHaveLength(0);
    expect(categorieUtilisable('Ébauche tennis')).toBeNull();
  });
  it('une carte reçoit le thème appris et ses parents ; la fusion et la suppression changent le résultat', () => {
    const etat = proposerThemes(entrees(5, ['Spécialité artisanale']), etatApprisVide(), 1);
    definirThemesAppris(etat.themes);
    definirCategoriesWikipedia(new Map([['Zorglub', ['specialite artisanale']]]));
    const carte = { titre: 'Zorglub', description: '' };
    const id = etat.themes[0]!.id;
    expect(themesDeCarte(carte)).toEqual(expect.arrayContaining([id, 'alcool', 'gastronomie']));
    expect(themesPrincipaux(carte)).toEqual([id]);
    expect(LIBELLES_THEMES[id]).toBe('#Spécialité artisanale');
    expect(IDS_THEMES).toContain(id);
    expect(enfantsDe('alcool')).toContain(id);
    const fusionne = fusionner(etat, id, 'rhum', 2);
    definirThemesAppris(fusionne.themes);
    expect(themesPrincipaux(carte)).toEqual(['rhum']);
    expect(IDS_THEMES).not.toContain(id);
    const supprime = supprimer(etat, id, 3);
    definirThemesAppris(supprime.themes);
    expect(themesDeCarte(carte)).toEqual(['autres']);
    expect(proposerThemes(entrees(8, ['Spécialité artisanale']), supprime, 4).themes).toHaveLength(1);
    expect(retablir(supprime, id, 5).themes[0]?.etat).toBe('actif');
  });
  it('renommer refuse un nom déjà pris et valide le nouveau', () => {
    const etat = proposerThemes(entrees(5, ['Spécialité artisanale']), etatApprisVide(), 1);
    const id = etat.themes[0]!.id;
    expect(erreurDeNom('Rhum', etat, id)).not.toBeNull();
    expect(renommer(etat, id, 'Spécialité maison', 2).themes[0]?.libelle).toBe('#Spécialité maison');
    expect(renommer(etat, id, 'Rhum', 2)).toBe(etat);
  });
  it('libellé propre : majuscule, parenthèses retirées, longueur bornée', () => {
    expect(libelleDepuisCategorie('cocktail à base de rhum (boisson)')).toBe('#Cocktail à base de rhum');
    expect(libelleDepuisCategorie('x'.repeat(60))).toBeNull();
  });
  it('valide l’état stocké et écarte les valeurs illisibles', () => {
    const etat = proposerThemes(entrees(5, ['Spécialité artisanale']), etatApprisVide(), 1);
    expect(validerEtatAppris(JSON.parse(JSON.stringify(etat)))).toEqual(etat);
    expect(validerEtatAppris({ version: 1, themes: [{ id: 'x' }], journal: [] })).toBeNull();
    expect(validerEtatAppris(null)).toBeNull();
  });
  it('les catégories de maintenance ne sont pas gardées dans le cache', () => {
    expect(categoriesUtiles(['Article à référence nécessaire', 'Spécialité artisanale'])).toEqual(['Spécialité artisanale']);
  });
});

describe('noms réservés et validation', () => {
  it('refuse les noms qui ont un sens pour l’extension ou des caractères invisibles', () => {
    const etat = proposerThemes(entrees(5, ['Spécialité artisanale']), etatApprisVide(), 1);
    const id = etat.themes[0]!.id;
    for (const nom of ['À classer', 'Autres', 'À échanger Léa', 'Statut · Vendre', 'À vendre', 'Nom‮ca']) expect(erreurDeNom(nom, etat, id), nom).not.toBeNull();
    expect(erreurDeNom('Spécialité maison', etat, id)).toBeNull();
  });
  it('écarte un identifiant de fusion illisible', () => {
    const etat = proposerThemes(entrees(5, ['Spécialité artisanale']), etatApprisVide(), 1);
    const brut = JSON.parse(JSON.stringify(etat)) as { themes: Record<string, unknown>[] };
    brut.themes[0]!.fusionneVers = '__proto__ ';
    expect(validerEtatAppris(brut)).toBeNull();
  });
});

describe('fusion en chaîne et cache', () => {
  it('suit la chaîne de fusion jusqu’à un thème actif, et perd la catégorie si la fin est supprimée', () => {
    const base = proposerThemes({ ...entrees(5, ['Spécialité artisanale']), ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`Autre ${i}`, { categories: ['Conserve maison'], themes: ['gastronomie'] }])) }, etatApprisVide(), 1);
    const [a, b] = base.themes;
    expect(a && b).toBeTruthy();
    definirCategoriesWikipedia(new Map([['Zed', [a!.categorie]]]));
    const chaine = fusionner(base, a!.id, b!.id, 2);
    definirThemesAppris(chaine.themes);
    expect(themesPrincipaux({ titre: 'Zed', description: '' })).toEqual([b!.id]);
    definirThemesAppris(supprimer(chaine, b!.id, 3).themes);
    expect(themesDeCarte({ titre: 'Zed', description: '' })).toEqual(['autres']);
  });
  it('les catégories du cache sont validées, relues si absentes et indexées normalisées', async () => {
    const { validerCache, categoriesParTitre, titresAVerifier, ajouterEntree, cacheVide } = await import('../../src/lib/wikipedia');
    const cache = ajouterEntree(cacheVide(), 'Carte', ['rhum'], 1000, true, { fortes: [], faibles: [], genre: 'autre' }, ['Spécialité artisanale', 'Article de qualité']);
    expect(cache.entrees['Carte']?.categories).toEqual(['Spécialité artisanale']);
    expect(validerCache(JSON.parse(JSON.stringify(cache)))?.entrees['Carte']?.categories).toEqual(['Spécialité artisanale']);
    expect(categoriesParTitre(cache).get('Carte')).toEqual(['specialite artisanale']);
    const ancienne = { version: 1 as const, entrees: { Carte: { ...cache.entrees['Carte']!, categories: undefined } } };
    delete (ancienne.entrees.Carte as { categories?: string[] }).categories;
    expect(titresAVerifier(['Carte'], ancienne, 1001)).toEqual(['Carte']);
    expect(titresAVerifier(['Carte'], cache, 1001)).toEqual([]);
  });
});
