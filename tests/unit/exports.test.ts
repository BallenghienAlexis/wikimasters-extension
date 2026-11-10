import { describe, expect, it } from 'vitest';
import { analyserImport, type Carte } from '../../src/lib/collection';
import { versCsv, versJson } from '../../src/lib/exports';

const carte = (surcharge: Partial<Carte> = {}): Carte => ({
  id: 'c1',
  titre: 'Loutre',
  rarete: 'Rare',
  quantite: 2,
  url: null,
  favori: false,
  idsSite: null,
  etiquettesSite: [],
  description: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  statut: 'vendre',
  prixCible: 50,
  note: '',
  ...surcharge,
});

const ligneDonnees = (c: Carte): string => versCsv([c]).split('\r\n')[1] ?? '';

describe('versCsv', () => {
  it('commence par le BOM et l’en-tête, séparés par des points-virgules', () => {
    expect(versCsv([]).startsWith('﻿id;titre;rarete;quantite;statut;prixCible;note;url;favori;description;ami;valeurMarchande;themes\r\n')).toBe(true);
  });

  it('écrit une valeur nulle comme une cellule vide', () => {
    expect(ligneDonnees(carte())).toBe('c1;Loutre;Rare;2;vendre;50;;;false;;;;#Autres');
  });

  it('protège séparateurs, guillemets et sauts de ligne', () => {
    expect(ligneDonnees(carte({ note: 'a;b' }))).toContain('"a;b"');
    expect(ligneDonnees(carte({ note: 'dit "oui"' }))).toContain('"dit ""oui"""');
    expect(versCsv([carte({ note: 'a\nb' })])).toContain('"a\nb"');
  });

  it.each(['=1+1', '+1', '-1', '@SOMME(A1)', '\tx'])('neutralise la formule %j', (note) => {
    expect(ligneDonnees(carte({ note }))).toContain(`'${note}`);
  });

  it('ne préfixe pas un nombre', () => {
    expect(ligneDonnees(carte({ prixCible: 0 }))).toContain(';0;');
  });
});

describe('versJson', () => {
  const sansIds = (c: Carte): Omit<Carte, 'idsSite' | 'etiquettesSite'> => {
    const reste: Partial<Carte> = { ...c };
    delete reste.idsSite;
    delete reste.etiquettesSite;
    return reste as Omit<Carte, 'idsSite' | 'etiquettesSite'>;
  };

  it('SC-019 : écrit version 1 sans idsSite, même si la carte en porte', () => {
    const collection = { version: 3 as const, cartes: [carte({ idsSite: ['s1', 's2'] }), carte({ id: 'c2' })] };
    const json = JSON.parse(versJson(collection));
    expect(json.version).toBe(1);
    expect(versJson(collection)).not.toContain('idsSite');
    expect(versJson(collection)).not.toContain('s1');
  });

  it('SC-012 : n’écrit pas les étiquettes du site', () => {
    const collection = { version: 3 as const, cartes: [carte({ etiquettesSite: ['Ami · Léa'] })] };
    expect(versJson(collection)).not.toContain('etiquettesSite');
    expect(versJson(collection)).not.toContain('Léa');
    expect(versCsv(collection.cartes)).toBe(versCsv([carte()]));
  });

  it('SC-019 : produit un fichier réimportable sans perte (hors idsSite)', () => {
    const collection = { version: 3 as const, cartes: [carte({ note: 'é "ok"', idsSite: ['s1'] })] };
    expect(analyserImport(JSON.parse(versJson(collection)))).toEqual({ ok: true, cartes: collection.cartes.map(sansIds) });
  });

  it('SC-019 : le CSV est identique avec ou sans idsSite, colonnes inchangées', () => {
    expect(versCsv([carte({ idsSite: ['s1'] })])).toBe(versCsv([carte()]));
    expect(versCsv([]).split('\r\n')[0]).not.toContain('idsSite');
  });
});

const COLONNES_ATTENDUES = ['id', 'titre', 'rarete', 'quantite', 'statut', 'prixCible', 'note', 'url', 'favori', 'description', 'ami', 'valeurMarchande'];

describe('exports et thèmes précis (SC-020)', () => {
  it('garde les colonnes du CSV et y met les nouveaux libellés', () => {
    const lignes = versCsv([carte({ titre: 'Berger allemand', description: 'race de chien' })]).split('\r\n');
    expect(lignes[0]?.replace(/^\uFEFF/, '')).toBe([...COLONNES_ATTENDUES, 'themes'].join(';'));
    expect(lignes[1]).toContain('#Chien');
    expect(lignes[1]).toContain('#Animaux');
  });
});
