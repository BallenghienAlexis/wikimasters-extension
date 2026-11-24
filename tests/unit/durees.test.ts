import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DUREES_PAR_DEFAUT,
  MESURES_MAX,
  MESURES_MIN,
  ajouterMesures,
  creerCollecteur,
  definirMesures,
  mediane,
  mesuresVides,
  secondesPar,
  secondesParUnite,
  validerMesures,
} from '../../src/lib/durees';
import { secondesExecution } from '../../src/lib/progression';

afterEach(() => {
  definirMesures(mesuresVides());
  vi.useRealTimers();
});

describe('durées mesurées', () => {
  it('garde le tarif par défaut sans assez de mesures', () => {
    const m = ajouterMesures(mesuresVides(), { prix: Array(MESURES_MIN - 1).fill(500) });
    expect(secondesParUnite(m, 'prix')).toBe(DUREES_PAR_DEFAUT.prix);
  });

  it('utilise la médiane (robuste aux valeurs aberrantes) dès MESURES_MIN mesures', () => {
    const m = ajouterMesures(mesuresVides(), { prix: [1000, 1000, 1000, 1000, 90_000] });
    expect(secondesParUnite(m, 'prix')).toBe(1);
  });

  it('ignore les mesures invalides ou trop longues', () => {
    const m = ajouterMesures(mesuresVides(), { lecture: [0, -5, Number.NaN, 200_000, 300] });
    expect(m.lecture).toEqual([300]);
  });

  it('ne garde que les plus récentes', () => {
    let m = mesuresVides();
    for (let i = 0; i < 3; i++) m = ajouterMesures(m, { ecriture: Array(MESURES_MAX).fill(100 + i) });
    expect(m.ecriture).toHaveLength(MESURES_MAX);
    expect(m.ecriture[0]).toBe(102);
  });

  it('médiane paire et impaire', () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([1, 2, 3, 4])).toBe(2.5);
  });

  it('valide une valeur stockée illisible sans lever', () => {
    expect(validerMesures(null)).toEqual(mesuresVides());
    expect(validerMesures({ prix: 'x', lecture: [100, 'a', 200] })).toEqual({ ...mesuresVides(), lecture: [100, 200] });
  });

  it('alimente les estimations de la page', () => {
    expect(secondesExecution(100)).toBeCloseTo(25);
    definirMesures(ajouterMesures(mesuresVides(), { ecriture: Array(10).fill(400) }));
    expect(secondesPar('ecriture')).toBeCloseTo(0.4);
    expect(secondesExecution(100)).toBeCloseTo(40);
  });
});

describe('collecteur', () => {
  it('écrit par lots au seuil et vide le reste à la demande', async () => {
    const ecrire = vi.fn(async () => undefined);
    const c = creerCollecteur(ecrire, { seuil: 3, delaiMs: 60_000 });
    c.noter('prix', 100);
    c.noter('prix', 200);
    expect(ecrire).not.toHaveBeenCalled();
    c.noter('lecture', 300);
    await Promise.resolve();
    expect(ecrire).toHaveBeenCalledWith({ prix: [100, 200], lecture: [300] });
    c.noter('prix', 400);
    await c.vider();
    expect(ecrire).toHaveBeenLastCalledWith({ prix: [400] });
  });

  it('écrit après le délai et ignore une erreur d’écriture', async () => {
    vi.useFakeTimers();
    const ecrire = vi.fn(async () => {
      throw new Error('stockage');
    });
    const c = creerCollecteur(ecrire, { seuil: 10, delaiMs: 5000 });
    c.noter('wikipedia', 2000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ecrire).toHaveBeenCalledTimes(1);
  });
});
