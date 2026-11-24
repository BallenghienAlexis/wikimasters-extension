import { describe, expect, it } from 'vitest';
import type { Carte } from '../../src/lib/collection';
import type { Donnees } from '../../src/lib/sauvegarde';
import { cacheVide } from '../../src/lib/wikipedia';
import { cacheIAVide } from '../../src/lib/classificationIA';
import { etatApprisVide } from '../../src/lib/themesAppris';
import { etatInitial } from '../../src/lib/ordonnanceur';
import type { DonneesSynchro } from '../../src/lib/sauvegardeSynchro';
import { aDesSaisies, empreinte, empreinteEdition, fusionnerFichiersPc, genererNomPc, instantane, nomFichierPc, nomPcDeFichier, nomPcValide } from '../../src/lib/synchroPc';

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
  it('un fichier plus ancien laisse l’édition locale et n’ajoute aucune carte (SC-002)', () => {
    const locales = donnees([carte('a', { note: 'ici' })]);
    const autre = instantane(donnees([carte('a', { note: 'là-bas' }), carte('b')]), T1);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    expect(r.donnees.collection.cartes.find((c) => c.id === 'a')!.note).toBe('ici');
    expect(r.donnees.collection.cartes.map((c) => c.id)).toEqual(['a']);
  });
  it('un PC sans modification locale connue (neuf) prend la valeur de l’autre PC', () => {
    const locales = donnees([carte('a', { note: 'périmée' })]);
    const autre = instantane(donnees([carte('a', { note: 'récente' })]), T1);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, null);
    expect(r.donnees.collection.cartes[0]!.note).toBe('récente');
  });
  it('aller-retour : la note changée sur A arrive sur B et ne revient pas en arrière sur A', () => {
    const a1 = donnees([carte('x', { note: 'new' })]);
    const fichierA = instantane(a1, T2); // A a modifié à T1 et écrit à T2
    const b = donnees([carte('x', { note: 'old' })]);
    const surB = fusionnerFichiersPc(b, [{ nom: 'pc-a', texte: fichierA }], 'pc-b', {}, T1.toISOString()); // B n'a rien modifié depuis T1
    expect(surB.donnees.collection.cartes[0]!.note).toBe('new');
    const fichierB = instantane(surB.donnees, T3);
    const surA = fusionnerFichiersPc(a1, [{ nom: 'pc-b', texte: fichierB }], 'pc-a', {}, T1.toISOString()); // A a modifié à T1, B écrit à T3
    expect(surA.donnees.collection.cartes[0]!.note).toBe('new');
  });
  it('un PC qui réécrit son fichier sans rien saisir ne fait pas perdre la saisie de l’autre', () => {
    const a = donnees([carte('x', { note: 'new' })]); // A a saisi à T1
    const fichierB = instantane(donnees([carte('x', { note: 'old' })]), T2, T1.toISOString().replace('10:00', '09:00')); // B réécrit à T2, sa dernière saisie date d'avant
    const surA = fusionnerFichiersPc(a, [{ nom: 'pc-b', texte: fichierB }], 'pc-a', {}, T1.toISOString());
    expect(surA.donnees.collection.cartes[0]!.note).toBe('new');
  });
  it('un PC dont la saisie est plus récente l’emporte, quelle que soit la date d’écriture', () => {
    const surA = fusionnerFichiersPc(donnees([carte('x', { note: 'old' })]), [{ nom: 'pc-b', texte: instantane(donnees([carte('x', { note: 'new' })]), T2, T2.toISOString()) }], 'pc-a', {}, T1.toISOString());
    expect(surA.donnees.collection.cartes[0]!.note).toBe('new');
  });
  it('détecte les saisies existantes', () => {
    expect(aDesSaisies(donnees([carte('a')]))).toBe(false);
    expect(aDesSaisies(donnees([carte('a', { note: 'n' })]))).toBe(true);
  });
  it('empreinte d’édition : insensible aux relevés du site, sensible à une note', () => {
    const base = donnees([carte('a')]);
    expect(empreinteEdition(donnees([carte('a', { valeurMarchande: 9, quantite: 3 })]))).toBe(empreinteEdition(base));
    expect(empreinteEdition(donnees([carte('a', { note: 'n' })]))).not.toBe(empreinteEdition(base));
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

describe('défausses propagées entre PC', () => {
  const lecture = (t: number): DonneesSynchro => ({
    derniereSynchro: t, etat: { ...etatInitial(), derniereComplete: t }, wikipedia: cacheVide(), classementIA: cacheIAVide(), themesAppris: etatApprisVide(), grapheWikidata: {},
  });
  const avecLecture = (cartes: Carte[], t: number): Donnees => ({ ...donnees(cartes), synchro: lecture(t) });
  const tous = Array.from({ length: 12 }, (_, i) => `c${i}`);

  it('une carte absente d’un fichier dont la lecture du site est plus récente disparaît ici', () => {
    const locales = avecLecture(tous.map((id) => carte(id)), Date.parse('2026-01-01T09:00:00Z'));
    const autre = instantane(avecLecture(tous.filter((id) => id !== 'c3').map((id) => carte(id)), Date.parse('2026-01-01T09:30:00Z')), T3);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    expect(r.donnees.collection.cartes.map((c) => c.id)).not.toContain('c3');
    expect(r.donnees.collection.cartes).toHaveLength(11);
  });
  it('une carte avec saisie locale reste, déliée du site', () => {
    const locales = avecLecture(tous.map((id) => carte(id, id === 'c3' ? { note: 'à moi' } : {})), Date.parse('2026-01-01T09:00:00Z'));
    const autre = instantane(avecLecture(tous.filter((id) => id !== 'c3').map((id) => carte(id)), Date.parse('2026-01-01T09:30:00Z')), T3);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    const c = r.donnees.collection.cartes.find((x) => x.id === 'c3')!;
    expect(c.note).toBe('à moi');
    expect(c.idsSite).toBeNull();
  });
  it('un fichier plus ancien côté site ne retire rien et n’en ressuscite aucune, même avec des saisies plus récentes', () => {
    const locales = avecLecture(tous.filter((id) => id !== 'c3').map((id) => carte(id)), Date.parse('2026-01-01T09:30:00Z'));
    const autre = instantane(avecLecture(tous.map((id) => carte(id)), Date.parse('2026-01-01T09:00:00Z')), T3);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    expect(r.donnees.collection.cartes.map((c) => c.id)).not.toContain('c3');
  });
  it('trop de cartes absentes : rien n’est retiré', () => {
    const locales = avecLecture(tous.map((id) => carte(id)), Date.parse('2026-01-01T09:00:00Z'));
    const autre = instantane(avecLecture([carte('c0')], Date.parse('2026-01-01T09:30:00Z')), T3);
    const r = fusionnerFichiersPc(locales, [{ nom: 'pc-autre', texte: autre }], 'pc-moi', {}, T2.toISOString());
    expect(r.donnees.collection.cartes).toHaveLength(12);
  });
});
