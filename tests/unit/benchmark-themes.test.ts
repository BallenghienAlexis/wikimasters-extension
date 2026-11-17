// Valide le jeu de référence du banc d’essai des thèmes et son harnais (voir tests/benchmark-themes/README.md).
import { describe, expect, it } from 'vitest';
import { CARTES_REFERENCE } from '../benchmark-themes/cartes';
import { deductionProduction } from '../benchmark-themes/production';
import { comparer, evaluer, formaterRapport, scorerPredictions } from '../benchmark-themes/scoring';
import { IDS_THEMES_CHOISISSABLES } from '../../src/lib/themes';

const CATALOGUE = new Set(IDS_THEMES_CHOISISSABLES);

describe('jeu de référence', () => {
  it('compte au moins 150 cartes aux titres uniques', () => {
    expect(CARTES_REFERENCE.length).toBeGreaterThanOrEqual(150);
    const titres = CARTES_REFERENCE.map((c) => c.titre);
    expect(new Set(titres).size).toBe(titres.length);
  });
  it('n’utilise que des thèmes du catalogue, 4 au plus, sans doublon', () => {
    for (const c of CARTES_REFERENCE) {
      expect(c.themes.length, c.titre).toBeLessThanOrEqual(4);
      for (const id of [...c.themes, ...(c.acceptables ?? []), ...(c.interdits ?? [])]) expect(CATALOGUE.has(id), `${c.titre} : ${id}`).toBe(true);
      expect(new Set(c.themes).size, c.titre).toBe(c.themes.length);
      expect(c.justification.length, c.titre).toBeGreaterThan(3);
      expect(c.description.length, c.titre).toBeGreaterThan(3);
    }
  });
  it('un thème n’est ni attendu, ni toléré, ni interdit à la fois', () => {
    for (const c of CARTES_REFERENCE) {
      const ref = new Set(c.themes);
      for (const id of c.acceptables ?? []) expect(ref.has(id), `${c.titre} : ${id} toléré et attendu`).toBe(false);
      for (const id of c.interdits ?? []) {
        expect(ref.has(id), `${c.titre} : ${id} interdit et attendu`).toBe(false);
        expect((c.acceptables ?? []).includes(id), `${c.titre} : ${id} interdit et toléré`).toBe(false);
      }
    }
  });
  it('contient des cartes sans thème attendu, pour mesurer les fausses propositions', () => {
    expect(CARTES_REFERENCE.filter((c) => c.themes.length === 0).length).toBeGreaterThanOrEqual(8);
    expect(scorerPredictions({}).global.tauxFauxSurCartesVides).toBe(0);
  });
  it('contient les cas piégeux connus', () => {
    const titres = new Set(CARTES_REFERENCE.map((c) => c.titre));
    for (const t of ['Four crématoire', 'Cambuses nord-américaines', 'Malibu', 'Longmorn', 'Maitrank', 'Solution de Dakin', 'Croix de saint André', 'Adolf Hitler', 'Vera Salvequart', 'Der Angriff', 'Regelbau 602', 'Wagon']) {
      expect(titres.has(t), t).toBe(true);
    }
    expect(titres.has('Annexion de l’Alsace-Moselle (1940)')).toBe(true);
  });
});

describe('harnais de scoring', () => {
  const carte = CARTES_REFERENCE.find((c) => c.titre === 'Four crématoire')!;
  it('compare : correct, faux, manquant, interdit, toléré neutre', () => {
    const d = comparer(carte, ['technologie', 'animaux', 'societe']);
    expect(d.corrects).toEqual(['technologie']);
    expect(d.faux).toEqual(['animaux']);
    expect(d.interdits).toEqual(['animaux']);
    expect(comparer(carte, []).manquants).toEqual(['technologie']);
  });
  it('une prédiction parfaite donne 100 % partout, une prédiction vide donne 100 % de « sans thème » à tort', () => {
    const parfaite = Object.fromEntries(CARTES_REFERENCE.map((c) => [c.titre, c.themes]));
    const r = scorerPredictions(parfaite);
    expect(r.global.precision).toBe(1);
    expect(r.global.rappel).toBe(1);
    expect(r.global.tauxFauxThemes).toBe(0);
    expect(r.global.tauxPiegesDeclenches).toBe(0);
    expect(r.global.tauxExactes).toBe(1);
    const vide = scorerPredictions({});
    expect(vide.global.rappel).toBe(0);
    expect(vide.global.tauxSansThemeATort).toBe(1);
    expect(vide.global.precision).toBe(1);
  });
  it('mesure les faux thèmes et les pièges sur un petit jeu', () => {
    const jeu = [carte, CARTES_REFERENCE.find((c) => c.titre === 'Wagon')!];
    const r = scorerPredictions({ 'Four crématoire': ['animaux'], Wagon: ['train', 'voiture'] }, { cartes: jeu });
    expect(r.global.tauxFauxThemes).toBeCloseTo(2 / 3);
    expect(r.global.rappel).toBeCloseTo(0.5);
    expect(r.global.tauxPiegesDeclenches).toBe(1);
    expect(r.global.tauxCartesAvecFauxTheme).toBe(1);
    expect(r.global.tauxSansThemeATort).toBe(0);
  });
  it('filtre par fiabilité et accepte une fonction asynchrone', async () => {
    const tout = await evaluer(async () => []);
    const sur = await evaluer(() => [], { fiabiliteMin: 'haute' });
    expect(sur.global.cartes).toBeLessThan(tout.global.cartes);
    expect(tout.global.cartes).toBe(CARTES_REFERENCE.length);
  });
  it('propage ou ignore les erreurs de la fonction', async () => {
    const boum = (): string[] => { throw new Error('boum'); };
    await expect(evaluer(boum)).rejects.toThrow('boum');
    const r = await evaluer(boum, { ignorerErreurs: true });
    expect(r.global.tauxSansThemeATort).toBe(1);
  });
});

describe('ligne de base de production', () => {
  it('s’exécute et se formate (aucun seuil : c’est le point de comparaison des POC)', async () => {
    const rapport = await evaluer(deductionProduction);
    expect(rapport.global.cartes).toBe(CARTES_REFERENCE.length);
    console.info(formaterRapport(rapport, 'production (titre + description)'));
  });
});
