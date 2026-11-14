import { describe, expect, it } from 'vitest';
import {
  COLONNES_TRI,
  annonceDeplacement,
  colonneVoisine,
  deplacerCarte,
  libelleDeplacement,
  repartirParColonne,
} from '../../src/lib/colonnesTri';
import { appliquerEdition, type Carte, type Collection } from '../../src/lib/collection';

// T-312 (SC-023, D-15). Contrat supposé de src/lib/colonnesTri.ts (module pur, sans chrome.*) :
// - COLONNES_TRI : ['garder','echanger','vendre','defausser','a-trier'] (ordre de lecture) ;
// - colonneVoisine(statut, 'gauche'|'droite') : Statut | null (null en bout de rangée ou statut hors colonnes) ;
// - repartirParColonne(cartes) : { colonnes: Record<colonne, Carte[]>, enVente: number } (ordre d’entrée gardé) ;
// - deplacerCarte(collection, id, statut) : Collection, via appliquerEdition (statut + decidePar 'moi') ;
// - libelleDeplacement(titre, statut) : « Déplacer « titre » vers Échanger » ;
// - annonceDeplacement(titre, statut) : « « titre » déplacée vers Vendre ».
// Données fictives.
const carte = (id: string, statut: Carte['statut'], extra: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: 'Commune',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: null,
  etiquettesSite: [],
  statut,
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...extra,
});
const coll = (cartes: Carte[]): Collection => ({ version: 3, cartes });

describe('SC-023 : colonnes du tableau de tri', () => {
  it('SC-023 : cinq colonnes dans l’ordre de lecture, sans en-vente', () => {
    expect([...COLONNES_TRI]).toEqual(['garder', 'echanger', 'vendre', 'defausser', 'a-trier']);
  });

  it('SC-023 : colonne voisine à gauche et à droite', () => {
    expect(colonneVoisine('echanger', 'droite')).toBe('vendre');
    expect(colonneVoisine('echanger', 'gauche')).toBe('garder');
    expect(colonneVoisine('defausser', 'droite')).toBe('a-trier');
  });

  it('SC-023 : bouts de rangée sans voisine (flèche désactivée)', () => {
    expect(colonneVoisine('garder', 'gauche')).toBeNull();
    expect(colonneVoisine('a-trier', 'droite')).toBeNull();
  });

  it('SC-023 : une carte en vente n’a pas de voisine', () => {
    expect(colonneVoisine('en-vente', 'gauche')).toBeNull();
    expect(colonneVoisine('en-vente', 'droite')).toBeNull();
  });

  it('SC-023 : répartition par statut, cartes en-vente exclues et comptées', () => {
    const r = repartirParColonne([
      carte('a', 'garder'),
      carte('b', 'a-trier'),
      carte('c', 'en-vente'),
      carte('d', 'garder'),
      carte('e', 'en-vente'),
      carte('f', 'defausser'),
    ]);
    expect(r.colonnes.garder.map((c) => c.id)).toEqual(['a', 'd']);
    expect(r.colonnes['a-trier'].map((c) => c.id)).toEqual(['b']);
    expect(r.colonnes.defausser.map((c) => c.id)).toEqual(['f']);
    expect(r.colonnes.echanger).toEqual([]);
    expect(r.colonnes.vendre).toEqual([]);
    expect(r.enVente).toBe(2);
    expect(Object.values(r.colonnes).flat().some((c) => c.statut === 'en-vente')).toBe(false);
  });

  it('SC-023 : répartition d’une liste vide', () => {
    const r = repartirParColonne([]);
    expect(r.enVente).toBe(0);
    for (const c of COLONNES_TRI) expect(r.colonnes[c]).toEqual([]);
  });
});

describe('SC-023 : déplacement d’une carte', () => {
  it('SC-023 : applique statut et decidePar « moi », identique à appliquerEdition', () => {
    const c = coll([carte('a', 'a-trier'), carte('b', 'garder')]);
    const r = deplacerCarte(c, 'a', 'vendre');
    expect(r).toEqual(appliquerEdition(c, 'a', { statut: 'vendre', decidePar: 'moi' }));
    expect(r.cartes[0]).toMatchObject({ statut: 'vendre', decidePar: 'moi' });
    expect(r.cartes[1]).toEqual(c.cartes[1]);
  });

  it('SC-023 : toute la carte bouge, quantité et édition conservées', () => {
    const c = coll([carte('a', 'garder', { quantite: 3, note: 'n', prixCible: 12, idsSite: ['x', 'y', 'z'] })]);
    const r = deplacerCarte(c, 'a', 'echanger');
    expect(r.cartes[0]).toMatchObject({ statut: 'echanger', quantite: 3, note: 'n', prixCible: 12, idsSite: ['x', 'y', 'z'] });
  });

  it('SC-023 : ne modifie pas la collection d’origine', () => {
    const c = coll([carte('a', 'garder')]);
    deplacerCarte(c, 'a', 'vendre');
    expect(c.cartes[0]).toMatchObject({ statut: 'garder', decidePar: null });
  });

  it('SC-023 : identifiant inconnu = collection inchangée', () => {
    const c = coll([carte('a', 'garder')]);
    expect(deplacerCarte(c, 'zzz', 'vendre').cartes).toEqual(c.cartes);
  });
});

describe('SC-023 : libellés', () => {
  it('SC-023 : libellé de flèche et annonce, guillemets français', () => {
    expect(libelleDeplacement('Zèbre fictif', 'echanger')).toBe('Déplacer « Zèbre fictif » vers Échanger');
    expect(libelleDeplacement('Zèbre fictif', 'a-trier')).toBe('Déplacer « Zèbre fictif » vers À trier');
    expect(annonceDeplacement('Zèbre fictif', 'vendre')).toBe('« Zèbre fictif » déplacée vers Vendre');
  });
});
