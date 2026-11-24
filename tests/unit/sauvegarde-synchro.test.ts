import { describe, expect, it } from 'vitest';
import { appliquerImport, apercuImport, creerSauvegarde, lireSauvegarde, serialiserSauvegarde, type Donnees } from '../../src/lib/sauvegarde';
import { etatInitial } from '../../src/lib/ordonnanceur';
import { cacheVide } from '../../src/lib/wikipedia';
import { cacheIAVide } from '../../src/lib/classificationIA';
import { etatApprisVide } from '../../src/lib/themesAppris';
import type { DonneesSynchro } from '../../src/lib/sauvegardeSynchro';
import type { Carte } from '../../src/lib/collection';

const carte = (id: string, plus: Partial<Carte> = {}): Carte => ({
  id, titre: `Carte ${id}`, rarete: null, description: '', quantite: 1, url: null, favori: false,
  idsSite: ['secret-id'], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...plus,
});
const synchroVide = (): DonneesSynchro => ({ derniereSynchro: null, etat: null, wikipedia: cacheVide(), classementIA: cacheIAVide(), themesAppris: etatApprisVide(), grapheWikidata: {} });
const donnees = (cartes: Carte[], synchro?: DonneesSynchro): Donnees => ({
  collection: { version: 4, cartes },
  preferences: { version: 2, mesThemes: [], amis: [] },
  syncAuto: true,
  ventes: [],
  ...(synchro ? { synchro } : {}),
});
const lire = (d: Donnees) => {
  const r = lireSauvegarde(serialiserSauvegarde(creerSauvegarde(d, new Date('2026-01-01T00:00:00Z'))));
  if (!r.ok) throw new Error(r.erreur);
  return r.sauvegarde;
};

describe('mémoire de synchro dans la sauvegarde', () => {
  const source = (): DonneesSynchro => ({
    ...synchroVide(),
    derniereSynchro: 5000,
    etat: { ...etatInitial(), total: 2, totalUnique: 2, signatureEtiquettes: 'sig', derniereComplete: 4000, cardIds: { a: 'secret-card' }, prix: { a: { valeur: 7, releveLe: 3000 }, b: { valeur: 9, releveLe: 3000 } } },
    wikipedia: { version: 1, entrees: { Alpha: { themes: [], verifieLe: 10 } } },
  });

  it('exporte prix et dates sans identifiant du site', () => {
    const texte = serialiserSauvegarde(creerSauvegarde(donnees([carte('a', { valeurMarchande: 7 })], source()), new Date()));
    expect(texte).not.toContain('secret-card');
    expect(texte).not.toContain('secret-id');
    expect(lire(donnees([carte('a')], source())).synchro?.derniereSynchro).toBe(5000);
  });

  it('un fichier sans synchro reste lisible', () => {
    expect(lire(donnees([carte('a')])).synchro).toBeUndefined();
  });

  it('reprend les prix concordants, la dernière synchro et les caches', () => {
    const s = lire(donnees([carte('a', { valeurMarchande: 7 }), carte('b', { valeurMarchande: 1 })], source()));
    const res = appliquerImport(donnees([], synchroVide()), s, 'remplacer');
    if (!res.ok) throw new Error(res.erreur);
    const sy = res.donnees.synchro!;
    expect(sy.derniereSynchro).toBe(5000);
    expect(sy.etat?.derniereComplete).toBe(4000);
    // b : la valeur de la carte (1) ne concorde pas avec le relevé (9) : non repris.
    expect(Object.keys(sy.etat!.prix)).toEqual(['a']);
    expect(sy.wikipedia.entrees['Alpha']).toBeDefined();
    expect(apercuImport(donnees([], synchroVide()), s).synchro?.prixRestaures).toBe(1);
  });

  it('garde le plus récent d’ici', () => {
    const ici: DonneesSynchro = { ...synchroVide(), derniereSynchro: 9000, etat: { ...etatInitial(), derniereComplete: 8000, prix: { a: { valeur: 7, releveLe: 6000 } } } };
    const s = lire(donnees([carte('a', { valeurMarchande: 7 })], source()));
    const res = appliquerImport(donnees([carte('a', { valeurMarchande: 7 })], ici), s, 'remplacer');
    if (!res.ok) throw new Error(res.erreur);
    expect(res.donnees.synchro?.derniereSynchro).toBe(9000);
    expect(res.donnees.synchro?.etat?.prix['a']?.releveLe).toBe(6000);
  });

  it('garde la date d’origine d’un relevé de plus de 7 jours : l’import ne le rend jamais frais', () => {
    const maintenant = 100 * 86_400_000;
    const ancien = maintenant - 10 * 86_400_000;
    const sy: DonneesSynchro = { ...source(), etat: { ...etatInitial(), derniereComplete: 4000, prix: { a: { valeur: 7, releveLe: ancien } } } };
    const s = lire(donnees([carte('a', { valeurMarchande: 7 })], sy));
    const res = appliquerImport(donnees([carte('a', { valeurMarchande: 7 })], synchroVide()), s, 'remplacer');
    if (!res.ok) throw new Error(res.erreur);
    expect(res.donnees.synchro?.etat?.prix['a']?.releveLe).toBe(ancien);
  });

  it('ramène à maintenant un horodatage du futur', () => {
    const futur: DonneesSynchro = { ...source(), derniereSynchro: 9e12 };
    const s = lire(donnees([carte('a', { valeurMarchande: 7 })], futur));
    const res = appliquerImport(donnees([], synchroVide()), s, 'remplacer');
    if (!res.ok) throw new Error(res.erreur);
    expect(res.donnees.synchro!.derniereSynchro).toBeLessThanOrEqual(Date.now());
  });

  it('sans synchro dans le fichier, la synchro d’ici n’est pas touchée', () => {
    const res = appliquerImport(donnees([], synchroVide()), lire(donnees([carte('a')])), 'remplacer');
    if (!res.ok) throw new Error(res.erreur);
    expect(res.donnees.synchro).toBeUndefined();
  });

  it('refuse une synchro invalide', () => {
    const brut = JSON.parse(serialiserSauvegarde(creerSauvegarde(donnees([], source()), new Date())));
    brut.synchro.etat.prix = { a: { valeur: 'x', releveLe: 1 } };
    expect(lireSauvegarde(JSON.stringify(brut)).ok).toBe(false);
  });
});

describe('sansVente et sauvegarde (2026-11-23)', () => {
  it('un fichier ne peut pas poser sansVente : la marque est retirée à la lecture', () => {
    const synchro: DonneesSynchro = { ...synchroVide(), etat: { ...etatInitial(), prix: { a: { valeur: null, releveLe: 3000, sansVente: true } } } };
    const lu = lire(donnees([carte('a')], synchro));
    expect(lu.synchro?.etat?.prix.a).toEqual({ valeur: null, releveLe: 3000 });
  });
});
