import { describe, expect, it } from 'vitest';
import type { Carte } from '../../src/lib/collection';
import { compterThemes, LIBELLES_THEMES, themesDeCarte } from '../../src/lib/themes';

const themes = (description: string, titre = 'Titre fictif'): string[] => themesDeCarte({ titre, description });

describe('themesDeCarte', () => {
  it.each([
    ['homme d’État français', 'politique'],
    ['physicienne et chimiste polonaise', 'sciences'],
    ['sixième planète du Système solaire', 'espace'],
    ['espèce d’oiseaux', 'nature'],
    ['agrume', 'gastronomie'],
    ['volcan au sud-ouest de Tokyo', 'geographie'],
    ['artiste peintre mexicaine', 'arts'],
    ['film réalisé en 1986', 'cinema'],
    ['compositeur allemand', 'musique'],
    ['écrivain français', 'litterature'],
    ['école de la philosophie indienne', 'idees'],
    ['athlète belge', 'sport'],
    ['paquebot transatlantique britannique', 'bateaux'],
    ['homme d’affaires français', 'societe'],
    ['ancienne cité inca du XVe siècle', 'histoire'],
  ])('« %s » donne %s', (description, attendu) => {
    expect(themes(description)).toContain(attendu);
  });

  it.each([
    ['#Automobile', 'constructeur automobile allemand', 'automobile'],
    ['#Avion', 'avion de ligne', 'avion'],
    ['#Bateaux', 'navire de guerre', 'bateaux'],
    ['#Bus', 'autobus urbain', 'bus'],
    ['#Camion', 'camion militaire', 'camion'],
    ['#Course', 'course automobile', 'course'],
    ['#Formule 1', 'pilote de Formule 1', 'formule1'],
    ['#Grunge', 'groupe de grunge', 'grunge'],
    ['#Guerre', 'bataille de 1916', 'guerre'],
    ['#Informatique', 'logiciel libre', 'informatique'],
    ['#Jazz', 'trompettiste de jazz', 'jazz'],
    ['#Métal', 'groupe de heavy metal', 'metal'],
    ['#Moto', 'moto japonaise', 'moto'],
    ['#Musique', 'chanteuse', 'musique'],
    ['#Nascar', 'pilote de NASCAR', 'nascar'],
    ['#Nazis', 'parti nazi', 'nazis'],
    ['#Pop', 'chanteuse de pop américaine', 'pop'],
    ['#Pop Rock', 'groupe de pop rock', 'poprock'],
    ['#Rallye', 'rallye automobile', 'rallye'],
    ['#Rock', 'groupe de rock britannique', 'rock'],
    ['#Techno', 'musique électronique', 'techno'],
    ['#Tracteur', 'tracteur agricole', 'tracteur'],
    ['#Train', 'locomotive à vapeur', 'train'],
    ['#Véhicule', 'véhicule blindé', 'vehicule'],
    ['#Voiture', 'voiture de sport', 'voiture'],
  ])('reprend l’étiquette du jeu %s', (libelle, description, id) => {
    expect(LIBELLES_THEMES[id]).toBe(libelle);
    expect(themes(description)).toContain(id);
  });

  it('une étiquette précise entraîne ses étiquettes parentes', () => {
    expect(themes('groupe de rock')).toEqual(expect.arrayContaining(['rock', 'musique']));
    expect(themes('voiture de sport')).toEqual(expect.arrayContaining(['voiture', 'automobile', 'vehicule']));
  });

  it.each([
    ['population de la ville', 'pop'],
    ['métallurgie', 'metal'],
    ['technologie', 'techno'],
    ['entraînement', 'train'],
    ['abus de droit', 'bus'],
  ])('« %s » ne donne pas %s', (description, id) => {
    expect(themes(description)).not.toContain(id);
  });

  it('une carte peut avoir plusieurs thèmes', () => {
    expect(themes('physicienne et chanteuse')).toEqual(expect.arrayContaining(['sciences', 'musique']));
  });

  it('range à part une carte sans indice', () => {
    expect(themes('')).toEqual(['autres']);
  });

  it('ne confond pas le début d’un mot avec son milieu', () => {
    expect(themes('apartement')).not.toContain('arts');
    expect(themes('partie')).not.toContain('arts');
  });

  it('ignore la casse et les accents, et lit aussi le titre', () => {
    expect(themes('', 'PLANÈTE lointaine')).toContain('espace');
  });
});

describe('compterThemes', () => {
  it('compte chaque thème, y compris à zéro', () => {
    const cartes = [{ titre: 'x', description: 'agrume' }, { titre: 'y', description: 'fruit' }] as Carte[];
    const compte = compterThemes(cartes);
    expect(compte.gastronomie).toBe(2);
    expect(compte.sport).toBe(0);
  });
});
