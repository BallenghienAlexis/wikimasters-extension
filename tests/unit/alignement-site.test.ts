import { describe, expect, it } from 'vitest';
import { alignerRegistreSurSite } from '../../src/lib/alignementSite';
import { ajusterLotAuSite, construireLot, exemplairesAttendus, type Config } from '../../src/lib/lot';
import { registreVide } from '../../src/lib/registre';
import type { Action } from '../../src/lib/actions';
import type { Carte, Collection } from '../../src/lib/collection';

const carte = (id: string, plus: Partial<Carte> = {}): Carte => ({
  id, titre: `Carte ${id}`, rarete: null, description: 'Une guerre mondiale et une bataille militaire.', quantite: 1, url: null, favori: false,
  idsSite: [`ex-${id}`], etiquettesSite: [], prixCible: null, note: '', ami: null, valeurMarchande: null, ...plus,
});
const config: Config = { maxVentesSimultanees: 5, longueurMaxEtiquette: null, nomsExistants: [], amis: [], modeEtiquettes: 'poser' };
const TOUS = new Set(['creation-etiquette', 'pose-etiquette', 'retrait-etiquette', 'favori', 'enchere', 'defausse'] as const);

const themeDe = (c: Carte): string => {
  const e = exemplairesAttendus(c, config)[0]?.etiquettes[0];
  if (!e) throw new Error('la carte de test n’a pas de thème');
  return e;
};

describe('réalignement du registre sur le site', () => {
  it('un registre vide face à un site déjà étiqueté ne propose plus ni création ni pose', () => {
    const base = carte('a');
    const nom = themeDe(base);
    const c = carte('a', { etiquettesSite: [nom] });
    const collection: Collection = { version: 4, cartes: [c] };
    const avant = construireLot(collection, registreVide(), config, TOUS);
    expect(avant.actions.filter((a) => a.type === 'creation-etiquette' || a.type === 'pose-etiquette').length).toBeGreaterThan(0);

    const bilan = alignerRegistreSurSite(registreVide(), collection.cartes, [{ id: 'tag-1', nom, nbCartes: 1 }], config);
    expect(bilan.etiquettes).toBeGreaterThan(0);
    expect(bilan.couples).toBeGreaterThan(0);
    const apres = construireLot(collection, bilan.registre, config, TOUS);
    expect(apres.actions.filter((a) => a.type === 'creation-etiquette' || a.type === 'pose-etiquette')).toEqual([]);
  });

  it('une étiquette qui existe sans être posée sur la carte : pose seule, jamais de création', () => {
    const nom = themeDe(carte('a'));
    const collection: Collection = { version: 4, cartes: [carte('a')] };
    const bilan = alignerRegistreSurSite(registreVide(), collection.cartes, [{ id: 'tag-1', nom, nbCartes: 9 }], config);
    const lot = construireLot(collection, bilan.registre, config, TOUS);
    expect(lot.actions.some((a) => a.type === 'creation-etiquette')).toBe(false);
    expect(lot.actions.some((a) => a.type === 'pose-etiquette' && a.nomEtiquette === nom)).toBe(true);
  });

  it('ne reprend jamais une étiquette non attendue (Statut, posée à la main) ni « #À classer »', () => {
    const nom = themeDe(carte('a'));
    const c = carte('a', { etiquettesSite: [nom, 'Statut · Vendre', 'Ma liste', '#À classer'] });
    const site = [nom, 'Statut · Vendre', 'Ma liste', '#À classer'].map((n, i) => ({ id: `t${i}`, nom: n, nbCartes: 1 }));
    const { registre } = alignerRegistreSurSite(registreVide(), [c], site, config);
    expect(Object.keys(registre.etiquettes)).toEqual([nom]);
    expect(registre.couples).toEqual([{ ex: 'ex-a', nom }]);
  });

  it('respecte un retrait voulu par le joueur, le mode et une liste du site absente ou vide', () => {
    const nom = themeDe(carte('a'));
    const c = carte('a', { etiquettesSite: [nom] });
    const site = [{ id: 't', nom, nbCartes: 1 }];
    const refus = { ...registreVide(), refus: [{ ex: 'ex-a', nom }] };
    expect(alignerRegistreSurSite(refus, [c], site, config).registre.couples).toEqual([]);
    for (const modeEtiquettes of ['suspendre', 'retirer-tout'] as const) {
      expect(alignerRegistreSurSite(registreVide(), [c], site, { ...config, modeEtiquettes }).registre).toEqual(registreVide());
    }
    expect(alignerRegistreSurSite(registreVide(), [c], null, config).registre).toEqual(registreVide());
    expect(alignerRegistreSurSite(registreVide(), [c], [], config).registre).toEqual(registreVide());
  });

  it('est idempotente et ne modifie pas l’entrée', () => {
    const nom = themeDe(carte('a'));
    const c = carte('a', { etiquettesSite: [nom] });
    const site = [{ id: 't', nom, nbCartes: 1 }];
    const vide = registreVide();
    const un = alignerRegistreSurSite(vide, [c], site, config);
    expect(vide).toEqual(registreVide());
    const deux = alignerRegistreSurSite(un.registre, [c], site, config);
    expect(deux.registre).toBe(un.registre);
    expect(deux.etiquettes + deux.couples).toBe(0);
  });

  it('au lancement, un aperçu ancien est purgé de ce que le site porte déjà', () => {
    const nom = themeDe(carte('a'));
    const c = carte('a', { etiquettesSite: [nom] });
    const collection: Collection = { version: 4, cartes: [c] };
    const ancien = construireLot(collection, registreVide(), config, TOUS).actions;
    const { registre } = alignerRegistreSurSite(registreVide(), collection.cartes, [{ id: 't', nom, nbCartes: 1 }], config);
    const ajuste: Action[] = ajusterLotAuSite(ancien, registre, [], collection, config, TOUS);
    expect(ajuste.filter((a) => a.type === 'creation-etiquette' || a.type === 'pose-etiquette')).toEqual([]);
  });
});

describe('noms d’étiquettes tolérants (« ##Nom » côté site)', () => {
  it('retrouve l’étiquette et la pose sous « ##Nom » ou une autre forme Unicode, sans création ni pose', () => {
    const nom = themeDe(carte('a'));
    const surSite = `#${nom}`.normalize('NFD');
    const c = carte('a', { etiquettesSite: [surSite] });
    const collection: Collection = { version: 4, cartes: [c] };
    const { registre, etiquettes, couples } = alignerRegistreSurSite(registreVide(), collection.cartes, [{ id: 't', nom: surSite, nbCartes: 1 }], config);
    expect(etiquettes + couples).toBeGreaterThan(0);
    expect(registre.etiquettes[nom]).toBe('t');
    const lot = construireLot(collection, registre, config, TOUS);
    expect(lot.actions.filter((a) => a.type === 'creation-etiquette' || a.type === 'pose-etiquette')).toEqual([]);
  });
});
