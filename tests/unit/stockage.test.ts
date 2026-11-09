import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EtatExecution, Registre } from '../../src/lib/actions';
import { collectionVide, type Carte } from '../../src/lib/collection';
import { versCsv, versJson } from '../../src/lib/exports';
import { ouvrirEntree, type Journal } from '../../src/lib/journal';
import { AMIS_INITIAUX, VERSION_AMIS_INITIAUX } from '../../src/config/amis';
import { poserCouple, enregistrerEtiquette, registreVide } from '../../src/lib/registre';
import {
  CLES_STOCKAGE,
  chargerPreferences,
  VERSION_JOURNAL,
  chargerCollection,
  chargerExecution,
  chargerJournal,
  chargerRegistre,
  chargerSignalSynchro,
  chargerSyncAuto,
  chargerDerniereSynchro,
  chargerBailSynchro,
  enregistrerSyncAuto,
  enregistrerDerniereSynchro,
  enregistrerBailSynchro,
  effacerExecution,
  enregistrerCollection,
  enregistrerExecution,
  enregistrerJournal,
  enregistrerPreferences,
  enregistrerRegistre,
  enregistrerSignalSynchro,
  chargerEtatSynchro,
  enregistrerEtatSynchro,
  enregistrerArretSynchro,
  ecouterArretSynchro,
} from '../../src/lib/stockage';

const MOTIF_SENSIBLE = /jeton|token|cookie|session|auth/i;

interface FauxStockage {
  donnees: Map<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  echecEcriture: Error | null;
  ajoutes: unknown[];
  retires: unknown[];
}

const installerFauxChrome = (): FauxStockage => {
  const faux: FauxStockage = {
    donnees: new Map(),
    echecEcriture: null,
    ajoutes: [],
    retires: [],
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  };
  faux.get.mockImplementation(async (cles: string | string[]) => {
    const liste = Array.isArray(cles) ? cles : [cles];
    const sortie: Record<string, unknown> = {};
    for (const cle of liste) if (faux.donnees.has(cle)) sortie[cle] = faux.donnees.get(cle);
    return sortie;
  });
  faux.set.mockImplementation(async (objet: Record<string, unknown>) => {
    if (faux.echecEcriture) throw faux.echecEcriture;
    for (const [cle, valeur] of Object.entries(objet)) faux.donnees.set(cle, structuredClone(valeur));
  });
  faux.remove.mockImplementation(async (cles: string | string[]) => {
    if (faux.echecEcriture) throw faux.echecEcriture;
    for (const cle of Array.isArray(cles) ? cles : [cles]) faux.donnees.delete(cle);
  });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: { get: faux.get, set: faux.set, remove: faux.remove },
      onChanged: { addListener: vi.fn((f: unknown) => faux.ajoutes.push(f)), removeListener: vi.fn((f: unknown) => faux.retires.push(f)) },
    },
  };
  return faux;
};

const registreRempli = (): Registre => {
  let r = enregistrerEtiquette(registreVide(), 'Ami Un', 'etiq-1');
  r = poserCouple(r, 'ex-1', 'Ami Un');
  return r;
};

const journalRempli = (): Journal =>
  ouvrirEntree(
    [],
    { idCarte: 'Rare|Loutre', titre: 'Loutre', type: 'pose-etiquette', parametre: 'Ami Un', idLot: 'lot-1' },
    () => new Date('2026-11-07T10:00:00.000Z'),
  ).journal;

const execution = (surcharge: Partial<EtatExecution> = {}): EtatExecution => ({
  version: 1,
  idLot: 'lot-1',
  etat: 'en-cours',
  traitees: 2,
  total: 5,
  ...surcharge,
});

const cles = (): string[] => Object.values(CLES_STOCKAGE);

const clesRecursives = (valeur: unknown): string[] => {
  if (typeof valeur !== 'object' || valeur === null) return [];
  if (Array.isArray(valeur)) return valeur.flatMap(clesRecursives);
  return Object.entries(valeur).flatMap(([k, v]) => [k, ...clesRecursives(v)]);
};

let faux: FauxStockage;
beforeEach(() => {
  faux = installerFauxChrome();
});
afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('CLES_STOCKAGE', () => {
  it('AC4 : énumère exactement les clés locales de l’extension', () => {
    expect([...cles()].sort()).toEqual([
      'amisInitiaux', 'arretSynchro', 'bailSynchro', 'collection', 'derniereSynchro', 'etatSynchro', 'execution', 'journal', 'preferences', 'registre', 'signalSynchro', 'syncAuto', 'synchro',
    ]);
  });

  it('AC4 : aucune clé ne ressemble à un jeton, un cookie ou une session', () => {
    for (const cle of cles()) expect(cle).not.toMatch(MOTIF_SENSIBLE);
  });

  it('AC4 : les valeurs écrites ne contiennent aucune clé de type jeton', async () => {
    await enregistrerRegistre(registreRempli());
    await enregistrerJournal(journalRempli());
    await enregistrerExecution(execution());
    await enregistrerSignalSynchro(1700000000000);
    for (const cle of ['registre', 'journal', 'execution', 'signalSynchro']) {
      expect(faux.donnees.has(cle)).toBe(true);
      for (const k of clesRecursives(faux.donnees.get(cle))) expect(k).not.toMatch(MOTIF_SENSIBLE);
    }
    for (const cle of faux.donnees.keys()) expect(cle).not.toMatch(MOTIF_SENSIBLE);
  });

  it('AC1 : registre, journal et exécution restent absents de l’export JSON', async () => {
    const carte: Carte = {
      id: 'c1', titre: 'Loutre', rarete: 'Rare', quantite: 1, url: null, favori: false, idsSite: null, etiquettesSite: [],
      description: '', ami: null, valeurMarchande: null, decidePar: null, statut: 'vendre', prixCible: 50, note: '',
    };
    await enregistrerRegistre(registreRempli());
    await enregistrerJournal(journalRempli());
    await enregistrerExecution(execution());
    await enregistrerSignalSynchro(1700000000000);
    await enregistrerCollection({ ...collectionVide(), cartes: [carte] });
    const charge = await chargerCollection();
    expect(charge.cartes).toHaveLength(1);
    const json = versJson(charge);
    const csv = versCsv(charge.cartes);
    for (const sortie of [json, csv]) {
      for (const mot of ['registre', 'journal', 'execution', 'etiquettes', 'couples', 'idLot', 'etiq-1', 'Ami Un', 'lot-1', 'pose-etiquette', 'signalSynchro', '1700000000000'])
        expect(sortie).not.toContain(mot);
    }
  });
});

describe('collection (existant)', () => {
  it('continue de lire et écrire sous « collection »', async () => {
    expect(await chargerCollection()).toEqual(collectionVide());
    await enregistrerCollection(collectionVide());
    expect(faux.donnees.get('collection')).toEqual(collectionVide());
  });
});

describe('registre', () => {
  it('AC1 : absent → registre vide', async () => {
    expect(await chargerRegistre()).toEqual(registreVide());
  });

  it('AC1 : écrit la valeur complète sous « registre » puis la relit', async () => {
    const r = registreRempli();
    await enregistrerRegistre(r);
    expect(faux.set).toHaveBeenCalledWith({ registre: r });
    expect(await chargerRegistre()).toEqual(r);
  });

  it('AC1 : valeur illisible → erreur lisible et aucune réécriture', async () => {
    faux.donnees.set('registre', { version: 99, etiquettes: 'x' });
    await expect(chargerRegistre()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.remove).not.toHaveBeenCalled();
    expect(faux.donnees.get('registre')).toEqual({ version: 99, etiquettes: 'x' });
  });

  it('AC2 : un échec d’écriture est remonté', async () => {
    faux.echecEcriture = new Error('quota dépassé');
    await expect(enregistrerRegistre(registreVide())).rejects.toThrow('quota dépassé');
  });
});

describe('journal', () => {
  it('AC1 : absent → journal vide', async () => {
    expect(await chargerJournal()).toEqual([]);
  });

  it('AC1 : écrit l’enveloppe versionnée sous « journal » puis la relit', async () => {
    const j = journalRempli();
    await enregistrerJournal(j);
    expect(VERSION_JOURNAL).toBe(1);
    expect(faux.set).toHaveBeenCalledWith({ journal: { version: 1, entrees: j } });
    expect(faux.donnees.get('journal')).toEqual({ version: 1, entrees: j });
    expect(await chargerJournal()).toEqual(j);
  });

  it('AC1 : entrées illisibles dans l’enveloppe → erreur lisible et aucune réécriture', async () => {
    const brut = { version: 1, entrees: [{ n: 'importe quoi' }] };
    faux.donnees.set('journal', brut);
    await expect(chargerJournal()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.remove).not.toHaveBeenCalled();
    expect(faux.donnees.get('journal')).toEqual(brut);
  });

  it('AC1 : version inconnue → erreur lisible, valeur non écrasée', async () => {
    const brut = { version: 2, entrees: journalRempli() };
    faux.donnees.set('journal', brut);
    await expect(chargerJournal()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.remove).not.toHaveBeenCalled();
    expect(faux.donnees.get('journal')).toEqual(brut);
  });

  it('AC1 : tableau nu (ancienne forme) → erreur lisible, valeur non écrasée', async () => {
    const brut = journalRempli();
    faux.donnees.set('journal', brut);
    await expect(chargerJournal()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.remove).not.toHaveBeenCalled();
    expect(faux.donnees.get('journal')).toEqual(brut);
  });

  it('AC2 : un échec d’écriture est remonté', async () => {
    faux.echecEcriture = new Error('disque plein');
    await expect(enregistrerJournal(journalRempli())).rejects.toThrow('disque plein');
  });
});

describe('exécution', () => {
  it('AC1 : absente → null', async () => {
    expect(await chargerExecution()).toBeNull();
  });

  it('AC1 : écrit sous « execution », relit, puis efface', async () => {
    const e = execution();
    await enregistrerExecution(e);
    expect(faux.set).toHaveBeenCalledWith({ execution: e });
    expect(await chargerExecution()).toEqual(e);
    await effacerExecution();
    expect(faux.remove).toHaveBeenCalledWith('execution');
    expect(await chargerExecution()).toBeNull();
  });

  it.each([
    ['état inconnu', { ...execution(), etat: 'pause' }],
    ['idLot vide', { ...execution(), idLot: '' }],
    ['version 2', { ...execution(), version: 2 }],
    ['traitees > total', { ...execution(), traitees: 6, total: 5 }],
    ['traitees négatif', { ...execution(), traitees: -1 }],
    ['total non entier', { ...execution(), total: 2.5 }],
    ['pas un objet', 'texte'],
  ])('AC1 : %s → erreur lisible et aucune réécriture', async (_nom, brut) => {
    faux.donnees.set('execution', brut);
    await expect(chargerExecution()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.remove).not.toHaveBeenCalled();
    expect(faux.donnees.get('execution')).toEqual(brut);
  });

  it.each(['en-cours', 'terminee', 'arretee'] as const)('AC1 : accepte l’état %s', async (etat) => {
    faux.donnees.set('execution', execution({ etat, traitees: 5, total: 5 }));
    expect((await chargerExecution())?.etat).toBe(etat);
  });

  it('AC2 : un échec d’écriture ou d’effacement est remonté', async () => {
    faux.echecEcriture = new Error('écriture refusée');
    await expect(enregistrerExecution(execution())).rejects.toThrow('écriture refusée');
    await expect(effacerExecution()).rejects.toThrow('écriture refusée');
  });
});

describe('signal de synchro', () => {
  it('AC3 : absent → null', async () => {
    expect(await chargerSignalSynchro()).toBeNull();
  });

  it('AC3 : écrit sous « signalSynchro » puis relit', async () => {
    await enregistrerSignalSynchro(1700000000000);
    expect(faux.set).toHaveBeenCalledWith({ signalSynchro: 1700000000000 });
    expect(await chargerSignalSynchro()).toBe(1700000000000);
  });

  it.each([['texte'], [Number.NaN], [Number.POSITIVE_INFINITY], [{}], [null]])(
    'AC3 : valeur invalide %s → null sans erreur ni réécriture',
    async (brut) => {
      faux.donnees.set('signalSynchro', brut);
      expect(await chargerSignalSynchro()).toBeNull();
      expect(faux.set).not.toHaveBeenCalled();
    },
  );

  it('AC2 : un échec d’écriture est remonté', async () => {
    faux.echecEcriture = new Error('écriture impossible');
    await expect(enregistrerSignalSynchro(1)).rejects.toThrow('écriture impossible');
  });
});

describe('amis initiaux (SC-024)', () => {
  const lire = async () => (await chargerPreferences()).amis;

  it('AC1 : le fichier de réglages porte Benjamin et Anatole', () => {
    expect(AMIS_INITIAUX.find((a) => a.nom === 'Benjamin')?.themes).toEqual(['barrage', 'tibet']);
    expect(AMIS_INITIAUX.find((a) => a.nom === 'Anatole')?.themes).toEqual(['ukraine']);
    expect(VERSION_AMIS_INITIAUX).toBe(1);
  });

  it('AC2 : sans préférence stockée, les amis initiaux sont inscrits avec le drapeau, en une écriture', async () => {
    const p = await chargerPreferences();
    expect(p.mesThemes).toEqual([]);
    expect(p.amis).toEqual(AMIS_INITIAUX);
    expect(faux.set).toHaveBeenCalledTimes(1);
    expect(faux.donnees.get('amisInitiaux')).toBe(VERSION_AMIS_INITIAUX);
    expect(faux.donnees.get('preferences')).toEqual(p);
  });

  it('AC2 : avec des préférences déjà stockées, Benjamin et Anatole sont ajoutés sans rien retirer', async () => {
    await enregistrerPreferences({ version: 2, mesThemes: ['chien'], amis: [{ nom: 'Benjamin', themes: ['pont'] }, { nom: 'Léa', themes: ['lac'] }] });
    faux.set.mockClear();
    const p = await chargerPreferences();
    expect(p.mesThemes).toEqual(['chien']);
    expect(p.amis).toEqual([
      { nom: 'Benjamin', themes: ['pont', 'barrage', 'tibet'] },
      { nom: 'Léa', themes: ['lac'] },
      { nom: 'Anatole', themes: ['ukraine'] },
    ]);
    expect(faux.set).toHaveBeenCalledTimes(1);
  });

  it('AC3 : une fois le drapeau posé, un thème décoché n’est pas rajouté', async () => {
    await chargerPreferences();
    const apres = (await chargerPreferences());
    await enregistrerPreferences({ ...apres, amis: apres.amis.map((a) => (a.nom === 'Benjamin' ? { ...a, themes: ['barrage'] } : a)) });
    faux.set.mockClear();
    const p = await chargerPreferences();
    expect(p.amis.find((a) => a.nom === 'Benjamin')?.themes).toEqual(['barrage']);
    expect(faux.set).not.toHaveBeenCalled();
  });

  it('AC3 : un drapeau périmé relance la fusion', async () => {
    faux.donnees.set('preferences', { version: 2, mesThemes: [], amis: [] });
    faux.donnees.set('amisInitiaux', 0);
    expect((await lire()).map((a) => a.nom)).toEqual(['Benjamin', 'Anatole']);
  });

  it('AC4 : des préférences illisibles ne sont ni écrasées ni fusionnées', async () => {
    faux.donnees.set('preferences', { version: 99, amis: 'x' });
    const p = await chargerPreferences();
    expect(p).toEqual({ version: 2, mesThemes: [], amis: [] });
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.donnees.get('preferences')).toEqual({ version: 99, amis: 'x' });
  });

  it('AC5 : un échec d’écriture renvoie quand même les amis fusionnés, sans poser le drapeau', async () => {
    faux.echecEcriture = new Error('écriture impossible');
    const p = await chargerPreferences();
    expect(p.amis).toEqual(AMIS_INITIAUX);
    expect(faux.donnees.has('amisInitiaux')).toBe(false);
  });

  it('AC6 : AMIS_INITIAUX n’est importé que par stockage.ts et les tests', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const parcourir = (d: string): string[] =>
      readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? parcourir(join(d, f)) : [join(d, f)]));
    const importeurs = parcourir('src').filter((f) => /config\/amis|AMIS_INITIAUX/.test(readFileSync(f, 'utf-8')));
    expect(importeurs.map((f) => f.replaceAll('\\', '/')).sort()).toEqual(['src/config/amis.ts', 'src/lib/stockage.ts']);
  });
});

describe('T-202 : migration de la collection stockée', () => {
  it('SC-012 : une collection v2 stockée est lue en v3 avec etiquettesSite vide', async () => {
    const v2: Record<string, unknown> = {
      id: 'c1', titre: 'Loutre', rarete: 'Rare', quantite: 1, url: null, favori: false, idsSite: ['s1'], etiquettesSite: [],
      description: '', statut: 'garder', prixCible: null, note: '', ami: null, valeurMarchande: 12, decidePar: 'moi',
    };
    delete v2.etiquettesSite;
    faux.donnees.set('collection', { version: 2, cartes: [v2] });
    const c = await chargerCollection();
    expect(c.version).toBe(3);
    expect(c.cartes[0]).toEqual({ ...v2, etiquettesSite: [] });
  });

  it('SC-012 : une collection vide a la version 3', async () => {
    expect((await chargerCollection()).version).toBe(3);
  });

  it('SC-012 : les étiquettes du site font l’aller-retour', async () => {
    const c = collectionVide();
    await enregistrerCollection({ ...c, cartes: [{ id: 'c1', titre: 'L', rarete: null, quantite: 1, url: null, favori: false, idsSite: null, etiquettesSite: ['Thème · Mer'], description: '', statut: 'a-trier', prixCible: null, note: '', ami: null, valeurMarchande: null, decidePar: null }] });
    expect((await chargerCollection()).cartes[0]?.etiquettesSite).toEqual(['Thème · Mer']);
  });
});

describe('T-202 : état de la synchronisation automatique', () => {
  it('SC-007 : valeurs par défaut (désactivée, aucune synchro, aucun bail)', async () => {
    expect(await chargerSyncAuto()).toBe(false);
    expect(await chargerDerniereSynchro()).toBeNull();
    expect(await chargerBailSynchro()).toBeNull();
  });

  it('SC-007 : les valeurs écrites sont relues', async () => {
    await enregistrerSyncAuto(true);
    await enregistrerDerniereSynchro(1700000000000);
    await enregistrerBailSynchro(1700000600000);
    expect(await chargerSyncAuto()).toBe(true);
    expect(await chargerDerniereSynchro()).toBe(1700000000000);
    expect(await chargerBailSynchro()).toBe(1700000600000);
  });

  it('SC-009 : null efface la dernière synchro et le bail', async () => {
    await enregistrerDerniereSynchro(1700000000000);
    await enregistrerBailSynchro(1700000600000);
    await enregistrerDerniereSynchro(null);
    await enregistrerBailSynchro(null);
    expect(await chargerDerniereSynchro()).toBeNull();
    expect(await chargerBailSynchro()).toBeNull();
  });

  it('SC-007 : une valeur stockée invalide vaut la valeur par défaut, sans exception', async () => {
    for (const invalide of ['oui', 1, null, {}, []]) {
      faux.donnees.set('syncAuto', invalide);
      expect(await chargerSyncAuto(), JSON.stringify(invalide)).toBe(false);
    }
    for (const invalide of ['12', -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, true, {}]) {
      faux.donnees.set('derniereSynchro', invalide);
      faux.donnees.set('bailSynchro', invalide);
      expect(await chargerDerniereSynchro(), String(invalide)).toBeNull();
      expect(await chargerBailSynchro(), String(invalide)).toBeNull();
    }
  });

  it('SC-007 : refuse d’écrire une valeur invalide', async () => {
    await expect(enregistrerSyncAuto('oui' as unknown as boolean)).rejects.toThrow();
    await expect(enregistrerDerniereSynchro(-1)).rejects.toThrow();
    await expect(enregistrerBailSynchro(Number.NaN)).rejects.toThrow();
    expect(faux.set).not.toHaveBeenCalled();
  });

  it('SC-007 : l’interrupteur écrit seulement sa propre clé', async () => {
    await enregistrerSyncAuto(true);
    expect(faux.set).toHaveBeenCalledWith({ syncAuto: true });
  });
});

describe('T-205 : état de l’ordonnanceur et demande d’arrêt', () => {
  const etat = () => ({
    version: 1 as const,
    total: 3,
    totalUnique: 3,
    signatureEtiquettes: 't0:1',
    derniereComplete: 1700000000000,
    arretJusqua: null,
    requetes: [1700000000000],
    cardIds: { 'R|Carte 1': 'card-1' },
    prix: { 'R|Carte 1': { valeur: 120, releveLe: 1700000000000 } },
  });

  it('aucun état stocké : null', async () => {
    expect(await chargerEtatSynchro()).toBeNull();
  });

  it('l’état écrit est relu à l’identique', async () => {
    await enregistrerEtatSynchro(etat());
    expect(await chargerEtatSynchro()).toEqual(etat());
    expect(faux.set).toHaveBeenCalledWith({ etatSynchro: etat() });
  });

  it('un état illisible est refusé sans être écrasé', async () => {
    for (const invalide of ['x', 1, [], { version: 2 }, { ...etat(), total: -1 }, { ...etat(), requetes: ['a'] }, { ...etat(), cardIds: { a: 1 } }, { ...etat(), prix: { a: { valeur: 'x', releveLe: 1 } } }]) {
      faux.donnees.set('etatSynchro', invalide);
      await expect(chargerEtatSynchro(), JSON.stringify(invalide)).rejects.toThrow(/illisibles/);
    }
    await expect(enregistrerEtatSynchro({ ...etat(), total: -1 })).rejects.toThrow();
  });

  it('la demande d’arrêt écrit un horodatage et prévient les écouteurs', async () => {
    await enregistrerArretSynchro(1700000000000);
    expect(faux.set).toHaveBeenCalledWith({ arretSynchro: 1700000000000 });
    const rappel = vi.fn();
    const stop = ecouterArretSynchro(rappel);
    const ecouteur = faux.ajoutes[0] as (c: Record<string, unknown>, zone: string) => void;
    ecouteur({ arretSynchro: { newValue: 1700000000001 } }, 'local');
    ecouteur({ arretSynchro: { newValue: 1700000000002 } }, 'sync');
    ecouteur({ autre: { newValue: 1 } }, 'local');
    ecouteur({ arretSynchro: { newValue: 'x' } }, 'local');
    expect(rappel).toHaveBeenCalledTimes(1);
    stop();
    expect(faux.retires).toHaveLength(1);
  });
});
