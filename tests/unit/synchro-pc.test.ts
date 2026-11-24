import { describe, expect, it } from 'vitest';
import type { Carte } from '../../src/lib/collection';
import type { Donnees } from '../../src/lib/sauvegarde';
import { empreinte, fusionnerFichiersPc, genererNomPc, instantane, nomFichierPc, nomPcDeFichier, nomPcValide } from '../../src/lib/synchroPc';

const carte = (id: string, plus: Partial<Carte> = {}): Carte => ({
  id, titre: `Carte ${id}`, rarete: null, description: '', quantite: 1, url: null, favori: false,
  idsSite: ['secret-id'], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...plus,
});
const donnees = (cartes: Carte[]): Donnees => ({
  collection: { version: 4, cartes },
  preferences: { version: 2, mesThemes: [], amis: [] },
  syncAuto: true,
  ventes: [],
});
const T1 = new Date('2026-01-01T10:00:00Z');
const T2 = new Date('2026-01-01T11:00:00Z');
const T3 = new Date('2026-01-01T12:00:00Z');

describe('noms de fichiers', () => {
  it('reconnaît seulement wm-sync-<pc>.json (ni temporaire ni copie de conflit)', () => {
    expect(nomFichierPc('pc-bureau')).toBe('wm-sync-pc-bureau.json');
    expect(nomPcDeFichier('wm-sync-pc-bureau.json')).toBe('pc-bureau');
    expect(nomPcDeFichier('wm-sync-pc-bureau.json.crswap')).toBeNull();
    expect(nomPcDeFichier('wm-sync-pc-bureau (1).json')).toBeNull();
    expect(nomPcDeFichier('wm-sauvegarde-2026-01-02.json')).toBeNull();
  });
  it('génère un nom valide', () => {
    expect(nomPcValide(genererNomPc())).toBe(true);
    expect(nomPcValide('Bureau Alexis')).toBe(false);
  });
});

describe('instantané', () => {
  it('ne contient aucun secret ni identifiant du site (SC-003)', () => {
    const texte = instantane(donnees([carte('a', { note: 'n' })]), T1);
    expect(texte).not.toContain('secret-id');
    expect(texte).not.toMatch(/token|cookie|jwt|apikey|authorization/i);
  });
  it('a la même empreinte à la date près', () => {
    const d = donnees([carte('a')]);
    expect(empreinte(instantane(d, T1))).toBe(empreinte(instantane(d, T2)));
  });
});

describe('fusion des fichiers des autres PC', () => {
  it('le fichier plus récent que mon dernier envoi gagne sur une carte en conflit (SC-001)', () => {
    const locales = donnees([carte('a', { note: 'ici' })]);
    const autre = instantane(donnees([carte('a', { note: 'là-bas' })]), T3);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    expect(r.donnees.collection.cartes[0]!.note).toBe('là-bas');
    expect(r.fusionnes).toEqual(['pc-autre']);
    expect(r.changements).toBe(true);
  });
  it('un fichier plus ancien laisse l’édition locale mais apporte les cartes absentes', () => {
    const locales = donnees([carte('a', { note: 'ici' })]);
    const autre = instantane(donnees([carte('a', { note: 'là-bas' }), carte('b')]), T1);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    expect(r.donnees.collection.cartes.find((c) => c.id === 'a')!.note).toBe('ici');
    expect(r.donnees.collection.cartes.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });
  it('ignore mon propre fichier, un fichier déjà lu, et ne change rien (idempotent)', () => {
    const locales = donnees([carte('a')]);
    const autre = instantane(donnees([carte('a', { note: 'x' })]), T3);
    const premier = fusionnerFichiersPc(locales, [{ nom: 'pc-moi', texte: autre }, { nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T1.toISOString());
    expect(premier.fusionnes).toEqual(['pc-autre']);
    const second = fusionnerFichiersPc(premier.donnees, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', premier.lus, T2.toISOString());
    expect(second.fusionnes).toEqual([]);
    expect(second.changements).toBe(false);
  });
  it('ignore un fichier illisible ou d’un format inconnu sans rien modifier (SC-002)', () => {
    const locales = donnees([carte('a', { note: 'ici' })]);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-x', texte: '{ pas du json' }, { nom: 'pc-y', texte: '{"format":"autre"}' }], 'pc-moi', {}, null);
    expect(r.ignores.map((i) => i.nom)).toEqual(['pc-x', 'pc-y']);
    expect(r.donnees).toBe(locales);
    expect(r.changements).toBe(false);
  });
  it('est indépendante de l’ordre de lecture pour deux PC plus récents (SC-001)', () => {
    const locales = donnees([carte('a')]);
    const f1 = { nom: 'pc-1', texte: instantane(donnees([carte('a', { note: 'un' })]), T2) };
    const f2 = { nom: 'pc-2', texte: instantane(donnees([carte('a', { note: 'deux' })]), T3) };
    const r1 = fusionnerFichiersPc(locales, [f1, f2], 'pc-moi', {}, T1.toISOString());
    const r2 = fusionnerFichiersPc(locales, [f2, f1], 'pc-moi', {}, T1.toISOString());
    expect(r1.donnees.collection.cartes[0]!.note).toBe('deux');
    expect(r2.donnees.collection.cartes[0]!.note).toBe('deux');
  });
});
