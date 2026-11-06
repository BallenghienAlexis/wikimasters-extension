import { describe, expect, it } from 'vitest';
import {
  analyserImport,
  appliquerEdition,
  collectionVide,
  excedent,
  filtrerCartes,
  fusionnerImport,
  resumer,
  type Carte,
  type Filtres,
} from '../../src/lib/collection';

const carte = (surcharge: Partial<Carte> = {}): Carte => ({
  id: 'c1',
  titre: 'Écureuil fictif',
  rarete: null,
  quantite: 1,
  url: null,
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ...surcharge,
});

const FILTRES: Filtres = { recherche: '', statut: 'tous', doublonsSeulement: false };

const erreurDe = (cartes: unknown[]): string => {
  const r = analyserImport({ version: 1, cartes });
  if (r.ok) throw new Error('Import accepté à tort');
  return r.erreur;
};

describe('analyserImport', () => {
  it('accepte un fichier minimal et pose les valeurs par défaut', () => {
    const r = analyserImport({ version: 1, cartes: [{ id: 'a', titre: 'A' }] });
    expect(r).toEqual({ ok: true, cartes: [{ id: 'a', titre: 'A', rarete: null, quantite: 1, url: null }] });
  });

  it.each([
    ['pas un objet', 'texte'],
    ['un tableau', []],
    ['une version inconnue', { version: 2, cartes: [] }],
    ['sans liste de cartes', { version: 1 }],
  ])('refuse %s', (_nom, brut) => {
    expect(analyserImport(brut).ok).toBe(false);
  });

  it('refuse un identifiant manquant ou en double', () => {
    expect(erreurDe([{ titre: 'A' }])).toContain('identifiant manquant');
    expect(erreurDe([{ id: 'a', titre: 'A' }, { id: 'a', titre: 'B' }])).toContain('identifiant en double');
  });

  it('refuse une quantité, un statut ou un prix invalides', () => {
    expect(erreurDe([{ id: 'a', titre: 'A', quantite: 0 }])).toContain('quantité');
    expect(erreurDe([{ id: 'a', titre: 'A', quantite: 1.5 }])).toContain('quantité');
    expect(erreurDe([{ id: 'a', titre: 'A', statut: 'brûler' }])).toContain('statut');
    expect(erreurDe([{ id: 'a', titre: 'A', prixCible: -1 }])).toContain('prix');
  });

  it.each(['javascript:alert(1)', 'http://exemple.test/a', 'pas une url'])('refuse le lien %s', (url) => {
    expect(erreurDe([{ id: 'a', titre: 'A', url }])).toContain('https://');
  });

  it('accepte un lien https', () => {
    expect(analyserImport({ version: 1, cartes: [{ id: 'a', titre: 'A', url: 'https://exemple.test/a' }] }).ok).toBe(true);
  });
});

describe('fusionnerImport', () => {
  it('initialise une nouvelle carte à trier', () => {
    const c = fusionnerImport(collectionVide(), [{ id: 'a', titre: 'A', rarete: null, quantite: 1, url: null }]);
    expect(c.cartes[0]).toMatchObject({ statut: 'a-trier', prixCible: null, note: '' });
  });

  it('met à jour les données du jeu sans perdre l’édition locale', () => {
    const avant = { version: 1 as const, cartes: [carte({ statut: 'vendre', prixCible: 50, note: 'à garder en tête' })] };
    const apres = fusionnerImport(avant, [{ id: 'c1', titre: 'Nouveau titre', rarete: null, quantite: 3, url: null }]);
    expect(apres.cartes[0]).toMatchObject({ titre: 'Nouveau titre', quantite: 3, statut: 'vendre', prixCible: 50, note: 'à garder en tête' });
  });

  it('applique l’édition fournie par le fichier', () => {
    const avant = { version: 1 as const, cartes: [carte({ statut: 'vendre' })] };
    const apres = fusionnerImport(avant, [{ id: 'c1', titre: 'T', rarete: null, quantite: 1, url: null, statut: 'garder' }]);
    expect(apres.cartes[0]?.statut).toBe('garder');
  });

  it('garde les cartes absentes du fichier', () => {
    const avant = { version: 1 as const, cartes: [carte()] };
    const apres = fusionnerImport(avant, [{ id: 'c2', titre: 'B', rarete: null, quantite: 1, url: null }]);
    expect(apres.cartes.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('appliquerEdition', () => {
  it('ne modifie que la carte visée, sans muter l’original', () => {
    const avant = { version: 1 as const, cartes: [carte(), carte({ id: 'c2' })] };
    const apres = appliquerEdition(avant, 'c2', { statut: 'echanger' });
    expect(apres.cartes[1]?.statut).toBe('echanger');
    expect(apres.cartes[0]?.statut).toBe('a-trier');
    expect(avant.cartes[1]?.statut).toBe('a-trier');
  });
});

describe('filtrerCartes', () => {
  const cartes = [
    carte({ id: 'a', titre: 'Écureuil', quantite: 2, statut: 'vendre' }),
    carte({ id: 'b', titre: 'Loutre', statut: 'garder' }),
  ];
  const ids = (f: Partial<Filtres>): string[] => filtrerCartes(cartes, { ...FILTRES, ...f }).map((c) => c.id);

  it('cherche sans tenir compte de la casse ni des accents', () => {
    expect(ids({ recherche: 'ecur' })).toEqual(['a']);
  });
  it('filtre par statut', () => {
    expect(ids({ statut: 'garder' })).toEqual(['b']);
  });
  it('repère les doublons', () => {
    expect(ids({ doublonsSeulement: true })).toEqual(['a']);
  });
  it('rend tout sans filtre', () => {
    expect(ids({})).toEqual(['a', 'b']);
  });
});

describe('doublons et résumé', () => {
  it('excedent compte les exemplaires au-delà du premier', () => {
    expect(excedent({ quantite: 1 })).toBe(0);
    expect(excedent({ quantite: 4 })).toBe(3);
  });

  it('resumer additionne exemplaires, doublons et statuts', () => {
    const r = resumer([carte({ quantite: 3, statut: 'vendre' }), carte({ id: 'c2', statut: 'vendre' }), carte({ id: 'c3' })]);
    expect(r.exemplaires).toBe(5);
    expect(r.doublons).toBe(2);
    expect(r.parStatut).toEqual({ 'a-trier': 1, garder: 0, echanger: 0, vendre: 2 });
  });
});
