import { describe, expect, it } from 'vitest';
import { registreVide, enregistrerEtiquette } from '../../src/lib/registre';
import { ID_CARTE_ETIQUETTES } from '../../src/lib/actions';
import type { Carte } from '../../src/lib/collection';
import { collectionReduite, OPTIONS_REINIT_PAR_DEFAUT, actionsReinitSite, categorieEtiquette, garantirSansFavori, planLocal, planSite, preferencesGardees } from '../../src/lib/reinitialisation';

// Données fictives uniquement.
const id = (n: number): string => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const site = [
  { id: id(1), nom: '#Musique', nbCartes: 10 },
  { id: id(2), nom: '#À classer', nbCartes: 3 },
  { id: id(3), nom: 'Statut · Vendre', nbCartes: 2 },
  { id: id(4), nom: '#À échanger Benjamin', nbCartes: 4 },
  { id: id(5), nom: 'Ma liste perso', nbCartes: 1 },
  { id: id(6), nom: '#Appris truc', nbCartes: 5 },
];
const libelles = new Set(['#Musique']);
const registre = enregistrerEtiquette(registreVide(), '#Appris truc', id(6));

describe('réinitialisation : volet site', () => {
  it('classe thèmes, statut, échange et inconnues', () => {
    expect(categorieEtiquette('#Musique', libelles, registre)).toBe('theme');
    expect(categorieEtiquette('#À classer', libelles, registre)).toBe('theme');
    expect(categorieEtiquette('#Appris truc', libelles, registre)).toBe('theme');
    expect(categorieEtiquette('Statut · Vendre', libelles, registre)).toBe('statut');
    expect(categorieEtiquette('#À échanger Benjamin', libelles, registre)).toBe('echange');
    expect(categorieEtiquette('constructor', libelles, registre)).toBe('autre');
  });

  it('par défaut supprime thèmes, statut et échange, garde les inconnues', () => {
    const p = planSite(site, libelles, registre, OPTIONS_REINIT_PAR_DEFAUT);
    expect(p.aSupprimer.map((e) => e.nom)).toEqual(['#À classer', '#À échanger Benjamin', '#Appris truc', '#Musique', 'Statut · Vendre']);
    expect(p.gardees.map((e) => e.nom)).toEqual(['Ma liste perso']);
  });

  it('les options ajoutent statut, échange, inconnues', () => {
    const p = planSite(site, libelles, registre, { statut: true, echange: true, autres: true });
    expect(p.aSupprimer).toHaveLength(6);
    expect(p.parCategorie.theme).toEqual({ etiquettes: 3, cartes: 18 });
  });

  it('ne produit que des suppressions d’étiquettes, limitables', () => {
    const p = planSite(site, libelles, registre, OPTIONS_REINIT_PAR_DEFAUT);
    const a = actionsReinitSite(p);
    expect(a.every((x) => x.type === 'suppression-etiquette' && x.idCarte === ID_CARTE_ETIQUETTES)).toBe(true);
    expect(actionsReinitSite(p, 1)).toHaveLength(1);
    expect(() => garantirSansFavori([{ type: 'favori', idCarte: 'x' } as never])).toThrow();
  });

  it('relancer après interruption ne reprend que les étiquettes restantes', () => {
    const restantes = site.filter((e) => e.id !== id(1));
    expect(actionsReinitSite(planSite(restantes, libelles, registre, OPTIONS_REINIT_PAR_DEFAUT))).toHaveLength(4);
  });
});

describe('réinitialisation : volet local', () => {
  it('garde seulement preferences et amisInitiaux', () => {
    const p = planLocal({ collection: { a: 1 }, preferences: {}, amisInitiaux: 1, journal: [], registre: {} });
    expect(p.gardees).toEqual(['amisInitiaux', 'collection', 'preferences']);
    expect(p.supprimees.map((c) => c.cle).sort()).toEqual(['journal', 'registre']);
  });

  it('réduit la collection aux choix de favori, vidés du reste', () => {
    const c = (id: string, choix: boolean | null): Carte => ({ id, titre: id, rarete: 'commune', description: 'd', quantite: 2, url: 'u', favori: true, choixFavori: choix, themesChoisis: ['rock'], idsSite: ['x'], etiquettesSite: ['#Rock'], prixCible: 5, note: 'n', ami: 'Tom', valeurMarchande: 9 });
    const r = collectionReduite({ version: 2 as never, cartes: [c('a', true), c('b', null), c('c', false)] });
    expect(r.cartes.map((x) => [x.id, x.choixFavori])).toEqual([['a', true], ['c', false]]);
    expect(r.cartes[0]).toMatchObject({ idsSite: null, etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, favori: false });
    expect(r.cartes[0]?.themesChoisis).toBeUndefined();
  });

  it('réduit les préférences aux thèmes aimés et aux amis', () => {
    const r = preferencesGardees({ version: 2, mesThemes: ['rock'], amis: [{ nom: 'Tom', themes: ['ukraine'] }], plafondDefausse: 9, modeEtiquettes: 'poser' });
    expect(r).toEqual({ version: 2, mesThemes: ['rock'], amis: [{ nom: 'Tom', themes: ['ukraine'] }] });
  });
});
