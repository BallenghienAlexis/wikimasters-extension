import { describe, expect, it } from 'vitest';
import { ajouterEvenement, conseillerDelai, estHeureForte, histogramme, MAX_EVENEMENTS, validerEvenements, type EvenementVente } from '../../src/lib/affluence';

// Mardi 2026-11-10 à 20 h locales, puis à 15 h.
const soir = new Date(2026, 10, 10, 20, 0).getTime();
const apresMidi = new Date(2026, 10, 10, 15, 0).getTime();

describe('estHeureForte', () => {
  it('utilise les créneaux par défaut sous le minimum d’observations', () => {
    expect(estHeureForte(soir, [])).toBe(true);
    expect(estHeureForte(apresMidi, [])).toBe(false);
  });

  it('déduit les heures fortes des ventes au-delà du minimum', () => {
    const ev: EvenementVente[] = [];
    for (let i = 0; i < 25; i++) ev.push({ type: 'debut', at: apresMidi });
    ev.push({ type: 'debut', at: soir });
    expect(estHeureForte(apresMidi, ev)).toBe(true);
    expect(estHeureForte(soir, ev)).toBe(false);
  });
});

describe('histogramme', () => {
  it('compte par jour et heure locale', () => {
    const h = histogramme([{ type: 'debut', at: soir }, { type: 'fin', at: soir }]);
    expect(h[2]![20]).toBe(2);
  });
});

describe('conseillerDelai', () => {
  it('chère en heure forte : 1 h', () => expect(conseillerDelai(500, soir, []).delaiHeures).toBe(1));
  it('chère hors heure forte : attendre', () => expect(conseillerDelai(500, apresMidi, []).delaiHeures).toBeNull());
  it('peu chère sur temps libre : 3 h', () => expect(conseillerDelai(30, apresMidi, []).delaiHeures).toBe(3));
  it('peu chère en heure forte : réservée aux chères', () => expect(conseillerDelai(30, soir, []).delaiHeures).toBeNull());
  it('valeur inconnue : pas de délai', () => expect(conseillerDelai(null, soir, []).delaiHeures).toBeNull());
});

describe('journal', () => {
  it('ignore les entrées illisibles', () => {
    expect(validerEvenements([{ type: 'debut', at: 5 }, { type: 'x', at: 1 }, null, { type: 'fin', at: -1 }])).toEqual([{ type: 'debut', at: 5 }]);
    expect(validerEvenements('nope')).toEqual([]);
  });
  it('borne la taille', () => {
    let ev: EvenementVente[] = [];
    for (let i = 0; i < MAX_EVENEMENTS + 5; i++) ev = ajouterEvenement(ev, { type: 'debut', at: i });
    expect(ev).toHaveLength(MAX_EVENEMENTS);
  });
});

describe('cas limites', () => {
  it('ignore une date hors plage de Date', () => {
    expect(validerEvenements([{ type: 'debut', at: 9e15 }])).toEqual([]);
  });
  it('un créneau à une seule vente n’est jamais fort (égalités)', () => {
    const ev: EvenementVente[] = [];
    for (let i = 0; i < 20; i++) ev.push({ type: 'debut', at: new Date(2026, 10, 2 + (i % 5), 8 + i).getTime() });
    expect(estHeureForte(new Date(2026, 10, 2, 8).getTime(), ev)).toBe(false);
  });
  it('les évènements fin comptent dans les heures fortes', () => {
    const ev: EvenementVente[] = [];
    for (let i = 0; i < 20; i++) ev.push({ type: 'debut', at: new Date(2026, 10, 2 + (i % 5), 8 + i % 3).getTime() });
    for (let i = 0; i < 3; i++) ev.push({ type: 'fin', at: apresMidi });
    expect(estHeureForte(apresMidi, ev)).toBe(true);
  });
});
