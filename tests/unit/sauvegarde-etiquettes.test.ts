import { describe, expect, it } from 'vitest';
import { appliquerImport, apercuImport, creerSauvegarde, lireSauvegarde, serialiserSauvegarde, type Donnees } from '../../src/lib/sauvegarde';
import { adopterEtiquettes, fusionnerImportees, lireEtiquettes, validerImportees } from '../../src/lib/sauvegardeRegistre';
import { registreVide } from '../../src/lib/registre';
import type { Registre } from '../../src/lib/actions';
import type { Carte } from '../../src/lib/collection';

const carte = (id: string, plus: Partial<Carte> = {}): Carte => ({
  id, titre: `Carte ${id}`, rarete: null, description: '', quantite: 1, url: null, favori: false,
  idsSite: [`ex-${id}`], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...plus,
});
const registre = (): Registre => ({ version: 2, etiquettes: { '#Guerre': 'tag-guerre' }, couples: [{ ex: 'ex-a', nom: '#Guerre' }], refus: [{ ex: 'ex-b', nom: '#Musique' }] });
const donnees = (cartes: Carte[], plus: Partial<Donnees> = {}): Donnees => ({
  collection: { version: 4, cartes }, preferences: { version: 2, mesThemes: [], amis: [] }, syncAuto: true, ventes: [], ...plus,
});
const lire = (d: Donnees) => {
  const r = lireSauvegarde(serialiserSauvegarde(creerSauvegarde(d, new Date('2026-01-01T00:00:00Z'))));
  if (!r.ok) throw new Error(r.erreur);
  return r.sauvegarde;
};

describe('étiquettes dans la sauvegarde', () => {
  const source = (): Donnees => donnees([carte('a'), carte('b')], { registre: registre(), preferences: { version: 2, mesThemes: [], amis: [], modeEtiquettes: 'poser' } });

  it('exporte noms, poses et retraits par carte locale, sans identifiant du site', () => {
    const texte = serialiserSauvegarde(creerSauvegarde(source(), new Date()));
    expect(texte).not.toContain('ex-a');
    expect(texte).not.toContain('tag-guerre');
    const e = lire(source()).etiquettes!;
    expect(e.noms).toEqual(['#Guerre']);
    expect(e.parCarte).toEqual({ a: ['#Guerre'] });
    expect(e.refus).toEqual({ b: ['#Musique'] });
    expect(e.mode).toBe('poser');
  });

  it('un ancien fichier (sans étiquettes ni mode) reste importable', () => {
    const s = lire(donnees([carte('a')]));
    expect(s.etiquettes).toBeUndefined();
    const r = appliquerImport(donnees([carte('a')]), s, 'remplacer');
    expect(r.ok && r.donnees.importees).toBeUndefined();
  });

  it('refuse une part étiquettes invalide et ignore « #À classer »', () => {
    expect(typeof lireEtiquettes({ releveLe: 'x', noms: [], parCarte: {}, refus: {} })).toBe('string');
    expect(typeof lireEtiquettes({ releveLe: null, noms: [1], parCarte: {}, refus: {} })).toBe('string');
    const e = lireEtiquettes({ releveLe: null, noms: ['#À classer', '#Guerre'], parCarte: { a: ['#Autres', '#Guerre'] }, refus: {}, mode: 'inconnu' });
    expect(e).toEqual({ releveLe: null, noms: ['#Guerre'], parCarte: { a: ['#Guerre'] }, refus: {} });
  });

  it('le mode du fichier est repris seulement si celui d’ici n’a jamais été choisi', () => {
    const s = lire(source());
    const neuf = appliquerImport(donnees([carte('a')]), s, 'remplacer');
    expect(neuf.ok && neuf.donnees.preferences.modeEtiquettes).toBe('poser');
    const choisi = appliquerImport(donnees([carte('a')], { preferences: { version: 2, mesThemes: [], amis: [], modeEtiquettes: 'retirer-tout' } }), s, 'remplacer');
    expect(choisi.ok && choisi.donnees.preferences.modeEtiquettes).toBe('retirer-tout');
  });

  it('l’import n’écrit jamais le registre d’ici et garde des revendications', () => {
    const r = appliquerImport(donnees([carte('a')], { registre: registreVide() }), lire(source()), 'remplacer');
    if (!r.ok) throw new Error(r.erreur);
    expect(r.donnees.registre).toBeUndefined();
    expect(r.donnees.importees?.parCarte).toEqual({ a: ['#Guerre'] });
  });

  it('le plus récent gagne : synchro d’ici plus récente → retraits à la main du fichier ignorés', () => {
    const e = lire(source()).etiquettes!;
    const recente = fusionnerImportees(null, { ...e, releveLe: 1000 }, 5000, 9000);
    expect(recente.refus).toEqual({});
    const ancienne = fusionnerImportees(null, { ...e, releveLe: 6000 }, 5000, 9000);
    expect(ancienne.refus).toEqual({ b: ['#Musique'] });
  });

  it('l’aperçu dit ce qui est repris, gardé ou ignoré', () => {
    const synchro = { derniereSynchro: 5000, etat: null, wikipedia: { version: 1 as const, entrees: {} }, classementIA: { version: 1 as const, modele: '', entrees: {} }, themesAppris: { version: 1 as const, themes: [], journal: [] }, grapheWikidata: {} };
    const a = apercuImport(donnees([carte('a')], { synchro: synchro as never }), { ...lire(source()), etiquettes: { ...lire(source()).etiquettes!, releveLe: 1000 } }).etiquettes!;
    expect(a).toMatchObject({ noms: 1, cartes: 1, refusRepris: 0, refusIgnores: 1, syncIciPlusRecente: true, modeFinal: 'poser', modeRepris: true });
  });
});

describe('adopterEtiquettes', () => {
  const importees = () => validerImportees({ version: 1, importeLe: 1, noms: ['#Guerre', '#Jazz'], parCarte: { a: ['#Guerre'], b: ['#Jazz'] }, refus: { c: ['#Musique'] } })!;
  const site = [{ id: 'S1', nom: '#Guerre', nbCartes: 2 }, { id: 'S2', nom: '#Autre', nbCartes: 1 }];

  it('reprend ce que le site confirme, sans doublon ni étiquette inconnue', () => {
    const cartes = [carte('a', { etiquettesSite: ['#Guerre'] }), carte('b', { etiquettesSite: ['#Jazz'] }), carte('c')];
    const b = adopterEtiquettes(registreVide(), importees(), cartes, site);
    expect(b.registre.etiquettes).toEqual({ '#Guerre': 'S1' });
    expect(b.registre.couples).toEqual([{ ex: 'ex-a', nom: '#Guerre' }]);
    expect(b.registre.refus).toEqual([{ ex: 'ex-c', nom: '#Musique' }]);
    // idempotente
    expect(adopterEtiquettes(b.registre, importees(), cartes, site).registre).toBe(b.registre);
  });

  it('une carte qui ne porte pas l’étiquette sur le site n’est pas reprise (la synchro d’ici est plus récente)', () => {
    const b = adopterEtiquettes(registreVide(), importees(), [carte('a', { etiquettesSite: [] })], site);
    expect(b.registre.couples).toEqual([]);
  });

  it('sans liste du site, rien ne change ; un retrait déjà décidé n’est pas repris à l’envers', () => {
    const r = registreVide();
    expect(adopterEtiquettes(r, importees(), [carte('a')], null).registre).toBe(r);
    expect(adopterEtiquettes(r, importees(), [carte('a')], []).registre).toBe(r);
    const avecRefus: Registre = { ...r, refus: [{ ex: 'ex-a', nom: '#Guerre' }] };
    const b = adopterEtiquettes(avecRefus, importees(), [carte('a', { etiquettesSite: ['#Guerre'] })], site);
    expect(b.registre.couples).toEqual([]);
  });
});
