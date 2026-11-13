import { describe, expect, it } from 'vitest';
import { appliquerImport, apercuImport, creerSauvegarde, lireSauvegarde, nomFichierSauvegarde, serialiserSauvegarde, type Donnees } from '../../src/lib/sauvegarde';
import type { Carte } from '../../src/lib/collection';

const carte = (id: string, plus: Partial<Carte> = {}): Carte => ({
  id,
  titre: `Carte ${id}`,
  rarete: null,
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: ['secret-id'],
  etiquettesSite: ['Étiquette'],
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...plus,
});

const donnees = (cartes: Carte[], plus: Partial<Donnees> = {}): Donnees => ({
  collection: { version: 3, cartes },
  preferences: { version: 2, mesThemes: ['barrage'], amis: [{ nom: 'Ami1', themes: ['tibet'] }] },
  syncAuto: true,
  ventes: [{ type: 'debut', at: 1000 }],
  ...plus,
});

const MAINTENANT = new Date('2026-01-02T03:04:05Z');
const ecrire = (d: Donnees): string => serialiserSauvegarde(creerSauvegarde(d, MAINTENANT));
const lire = (texte: string) => {
  const r = lireSauvegarde(texte);
  if (!r.ok) throw new Error(r.erreur);
  return r.sauvegarde;
};

describe('export', () => {
  it('n’écrit que la liste blanche : ni identifiants du site, ni étiquettes, ni secret', () => {
    const texte = ecrire(donnees([carte('a', { statut: 'garder', note: 'ma note' })]));
    expect(texte).not.toContain('secret-id');
    expect(texte).not.toContain('idsSite');
    expect(texte).not.toContain('etiquettesSite');
    expect(texte).not.toMatch(/token|cookie|jwt|apikey|authorization/i);
    expect(texte).toContain('ma note');
  });

  it('exclut les relevés du site des ventes et nomme le fichier par date', () => {
    const s = creerSauvegarde(donnees([], { ventes: [{ type: 'site', at: 5 }, { type: 'fin', at: 6 }] }), MAINTENANT);
    expect(s.ventes).toEqual([{ type: 'fin', at: 6 }]);
    expect(nomFichierSauvegarde(MAINTENANT)).toBe('wm-sauvegarde-2026-01-02.json');
  });

  it('fait un aller-retour sans perte', () => {
    const d = donnees([carte('a', { statut: 'vendre', prixCible: 3, note: 'n', ami: 'Ami1', decidePar: 'moi', valeurMarchande: 4, favori: true })]);
    const s = lire(ecrire(d));
    expect(s.cartes[0]).toMatchObject({ id: 'a', statut: 'vendre', prixCible: 3, note: 'n', ami: 'Ami1', decidePar: 'moi', valeurMarchande: 4, favori: true });
    expect(s.preferences).toEqual(d.preferences);
    expect(s.syncAuto).toBe(true);
    expect(s.ventes).toEqual(d.ventes);
  });
});

describe('lecture stricte', () => {
  const base = () => JSON.parse(ecrire(donnees([carte('a')]))) as Record<string, unknown>;
  const refuse = (objet: unknown, motif: RegExp) => {
    const r = lireSauvegarde(typeof objet === 'string' ? objet : JSON.stringify(objet));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(motif);
  };

  it('refuse un JSON illisible, un autre format, une autre version', () => {
    refuse('pas du json', /JSON/);
    refuse({ cartes: [] }, /pas une sauvegarde/);
    refuse({ ...base(), version: 2 }, /plus récente/);
    refuse({ ...base(), version: 0 }, /inconnue/);
  });

  it('refuse un fichier trop gros', () => {
    refuse(' '.repeat(21 * 1024 * 1024), /volumineux/);
  });

  it('désigne la carte fautive', () => {
    refuse({ ...base(), cartes: [{ id: 'x', titre: 'T', statut: 'bidon' }] }, /Carte n° 1/);
  });

  it('refuse des réglages, ventes ou booléens invalides', () => {
    refuse({ ...base(), preferences: { version: 2, mesThemes: [1], amis: [] } }, /thèmes/);
    refuse({ ...base(), preferences: { version: 2, mesThemes: [], amis: [{ nom: '', themes: [] }] } }, /ami/);
    refuse({ ...base(), syncAuto: 'oui' }, /synchronisation/);
    refuse({ ...base(), ventes: [{ type: 'site', at: 1 }] }, /ventes/);
    refuse({ ...base(), ventes: [{ type: 'debut', at: -1 }] }, /ventes/);
    refuse({ ...base(), creeLe: 'hier' }, /date/);
  });

  it('ignore les champs inconnus, y compris des secrets glissés dans une carte', () => {
    const b = base();
    (b.cartes as Record<string, unknown>[])[0]!.idsSite = ['intrus'];
    (b.cartes as Record<string, unknown>[])[0]!.token = 'xyz';
    b.token = 'xyz';
    const s = lire(JSON.stringify(b));
    expect(JSON.stringify(s)).not.toMatch(/intrus|xyz/);
  });
});

describe('fusion', () => {
  const sauvee = (cartes: Carte[], plus: Partial<Donnees> = {}) => lire(ecrire(donnees(cartes, plus)));

  it('PC vide : toutes les cartes arrivent, sans identifiants du site', () => {
    const vide = donnees([], { preferences: { version: 2, mesThemes: [], amis: [] }, ventes: [], syncAuto: false });
    const s = sauvee([carte('a', { statut: 'garder' })]);
    const r = appliquerImport(vide, s, 'garder-ici');
    expect(r.ok && r.donnees.collection.cartes).toEqual([expect.objectContaining({ id: 'a', statut: 'garder', idsSite: null, etiquettesSite: [] })]);
    expect(apercuImport(vide, s)).toMatchObject({ cartesNouvelles: 1, themesAjoutes: 1, amisAjoutes: 1, ventesAjoutees: 1 });
  });

  it('complète une édition vierge, garde la locale en conflit (par défaut)', () => {
    const s = sauvee([carte('a', { statut: 'garder' }), carte('b', { statut: 'vendre', note: 'sauvée' }), carte('c', { statut: 'garder' })]);
    const ici = donnees([carte('a'), carte('b', { statut: 'defausser', decidePar: 'moi' }), carte('c', { statut: 'garder' })]);
    expect(apercuImport(ici, s)).toMatchObject({ cartesCompletees: 1, cartesEnConflit: 1, cartesIdentiques: 1, cartesNouvelles: 0 });
    const r = appliquerImport(ici, s, 'garder-ici');
    const cartes = r.ok ? r.donnees.collection.cartes : [];
    expect(cartes.find((c) => c.id === 'a')?.statut).toBe('garder');
    expect(cartes.find((c) => c.id === 'b')).toMatchObject({ statut: 'defausser', note: '' });
  });

  it('« remplacer » prend la sauvegarde en conflit, mais garde favori, quantité et identifiants d’ici', () => {
    const s = sauvee([carte('b', { statut: 'vendre', note: 'sauvée', favori: true, quantite: 9 })]);
    const ici = donnees([carte('b', { statut: 'defausser', decidePar: 'moi', idsSite: ['ici'], quantite: 2 })], { syncAuto: false });
    const r = appliquerImport(ici, s, 'remplacer');
    expect(r.ok && r.donnees.collection.cartes[0]).toMatchObject({ statut: 'vendre', note: 'sauvée', favori: false, quantite: 2, idsSite: ['ici'] });
    expect(r.ok && r.donnees.syncAuto).toBe(true);
  });

  it('complète la valeur marchande absente, sans écraser celle d’ici par défaut', () => {
    const s = sauvee([carte('a', { valeurMarchande: 7 }), carte('b', { valeurMarchande: 7 })]);
    const r = appliquerImport(donnees([carte('a'), carte('b', { valeurMarchande: 3 })]), s, 'garder-ici');
    expect(r.ok && r.donnees.collection.cartes.map((c) => c.valeurMarchande)).toEqual([7, 3]);
  });

  it('réunit thèmes, amis et ventes sans doublon ; garde les cartes absentes de la sauvegarde', () => {
    const s = sauvee([], { preferences: { version: 2, mesThemes: ['ukraine', 'barrage'], amis: [{ nom: 'ami1', themes: ['ukraine'] }, { nom: 'Nouveau', themes: [] }] }, ventes: [{ type: 'debut', at: 1000 }, { type: 'fin', at: 2000 }] });
    const ici = donnees([carte('seule')]);
    const r = appliquerImport(ici, s, 'garder-ici');
    if (!r.ok) throw new Error(r.erreur);
    expect(r.donnees.collection.cartes.map((c) => c.id)).toEqual(['seule']);
    expect(r.donnees.preferences.mesThemes).toEqual(['barrage', 'ukraine']);
    expect(r.donnees.preferences.amis).toEqual([{ nom: 'Ami1', themes: ['tibet', 'ukraine'] }, { nom: 'Nouveau', themes: [] }]);
    expect(r.donnees.ventes).toEqual([{ type: 'debut', at: 1000 }, { type: 'fin', at: 2000 }]);
    expect(apercuImport(ici, s)).toMatchObject({ themesAjoutes: 1, amisAjoutes: 1, ventesAjoutees: 1 });
  });

  it('transporte le plafond de défausse : valide, sinon refusé ; celui d’ici prime', () => {
    const avec = (plafondDefausse: number) => donnees([], { preferences: { version: 2, mesThemes: [], amis: [], plafondDefausse } });
    const s = lire(ecrire(avec(12)));
    expect(s.preferences.plafondDefausse).toBe(12);
    const sans = donnees([]);
    const r = appliquerImport(sans, s, 'garder-ici');
    expect(r.ok && r.donnees.preferences.plafondDefausse).toBe(12);
    const r2 = appliquerImport(avec(7), s, 'garder-ici');
    expect(r2.ok && r2.donnees.preferences.plafondDefausse).toBe(7);
    const mauvais = JSON.parse(ecrire(avec(12))) as { preferences: { plafondDefausse: number } };
    mauvais.preferences.plafondDefausse = 99;
    expect(lireSauvegarde(JSON.stringify(mauvais)).ok).toBe(false);
  });

  it('est idempotente', () => {
    const d = donnees([carte('a', { statut: 'garder', decidePar: 'moi' })]);
    const s = lire(ecrire(d));
    const r = appliquerImport(d, s, 'garder-ici');
    expect(r.ok && r.donnees).toEqual(d);
  });
});
