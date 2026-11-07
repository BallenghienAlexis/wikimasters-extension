import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EtatExecution, Registre } from '../../src/lib/actions';
import { collectionVide, type Carte } from '../../src/lib/collection';
import { versJson } from '../../src/lib/exports';
import { ouvrirEntree, type Journal } from '../../src/lib/journal';
import { poserCouple, enregistrerEtiquette, registreVide } from '../../src/lib/registre';
import {
  CLES_STOCKAGE,
  chargerCollection,
  chargerExecution,
  chargerJournal,
  chargerRegistre,
  chargerSignalSynchro,
  effacerExecution,
  enregistrerCollection,
  enregistrerExecution,
  enregistrerJournal,
  enregistrerRegistre,
  enregistrerSignalSynchro,
} from '../../src/lib/stockage';

const MOTIF_SENSIBLE = /jeton|token|cookie|session|auth/i;

interface FauxStockage {
  donnees: Map<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  echecEcriture: Error | null;
}

const installerFauxChrome = (): FauxStockage => {
  const faux: FauxStockage = {
    donnees: new Map(),
    echecEcriture: null,
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
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
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

const cles = (): string[] => (Array.isArray(CLES_STOCKAGE) ? [...CLES_STOCKAGE] : Object.values(CLES_STOCKAGE as Record<string, string>));

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
    expect([...cles()].sort()).toEqual(['collection', 'execution', 'journal', 'preferences', 'registre', 'signalSynchro', 'synchro']);
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
      id: 'c1', titre: 'Loutre', rarete: 'Rare', quantite: 1, url: null, favori: false, idsSite: null,
      description: '', ami: null, valeurMarchande: null, decidePar: null, statut: 'vendre', prixCible: 50, note: '',
    };
    await enregistrerRegistre(registreRempli());
    await enregistrerJournal(journalRempli());
    await enregistrerExecution(execution());
    const json = versJson({ ...collectionVide(), cartes: [carte] });
    for (const mot of ['registre', 'journal', 'execution', 'etiquettes', 'couples', 'idLot']) expect(json).not.toContain(mot);
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

  it('AC1 : écrit la valeur complète sous « journal » puis la relit', async () => {
    const j = journalRempli();
    await enregistrerJournal(j);
    expect(faux.set).toHaveBeenCalledWith({ journal: j });
    expect(await chargerJournal()).toEqual(j);
  });

  it('AC1 : valeur illisible → erreur lisible et aucune réécriture', async () => {
    faux.donnees.set('journal', [{ n: 'importe quoi' }]);
    await expect(chargerJournal()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.donnees.get('journal')).toEqual([{ n: 'importe quoi' }]);
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
