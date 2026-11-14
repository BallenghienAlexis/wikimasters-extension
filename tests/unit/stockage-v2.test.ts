/**
 * T-303 (AC1 à AC3, AC6, AC9) : stockage des schémas v2 et des clés `ignorees`, `historique`, `affichage`.
 * Contrat attendu (stockage.ts) : `chargerIgnorees/enregistrerIgnorees/ecouterIgnorees`,
 * `chargerHistorique/enregistrerHistorique/ecouterHistorique`, `chargerAffichage/enregistrerAffichage/ecouterAffichage`,
 * `ecouterExecution`, `ecouterJournal` ; `VERSION_JOURNAL` = 2 ; `StatutSynchro` réexporté.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLES_STOCKAGE, VERSION_JOURNAL,
  chargerAffichage, chargerExecution, chargerHistorique, chargerIgnorees, chargerJournal, chargerStatutSynchro,
  ecouterAffichage, ecouterExecution, ecouterHistorique, ecouterIgnorees, ecouterJournal,
  enregistrerAffichage, enregistrerExecution, enregistrerHistorique, enregistrerIgnorees, enregistrerJournal,
  enregistrerStatutSynchro,
  type StatutSynchro,
} from '../../src/lib/stockage';

interface Faux {
  donnees: Map<string, unknown>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  echec: Error | null;
  ecouteurs: Array<(c: Record<string, unknown>, zone: string) => void>;
}
let faux: Faux;

beforeEach(() => {
  faux = { donnees: new Map(), set: vi.fn(), remove: vi.fn(), echec: null, ecouteurs: [] };
  faux.set.mockImplementation(async (o: Record<string, unknown>) => {
    if (faux.echec) throw faux.echec;
    for (const [k, v] of Object.entries(o)) faux.donnees.set(k, structuredClone(v));
  });
  faux.remove.mockImplementation(async () => {});
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn(async (cles: string | string[]) => {
          const out: Record<string, unknown> = {};
          for (const c of Array.isArray(cles) ? cles : [cles]) if (faux.donnees.has(c)) out[c] = faux.donnees.get(c);
          return out;
        }),
        set: faux.set,
        remove: faux.remove,
      },
      onChanged: {
        addListener: vi.fn((f: never) => faux.ecouteurs.push(f)),
        removeListener: vi.fn((f: never) => { faux.ecouteurs = faux.ecouteurs.filter((x) => x !== f); }),
      },
    },
  };
});
afterEach(() => { delete (globalThis as { chrome?: unknown }).chrome; });

const entreeV1 = {
  id: '1700000000000-1', horodatage: '2026-11-07T10:00:00.000Z', idCarte: 'Rare|Loutre', titre: 'Loutre',
  type: 'pose-etiquette', parametre: 'Ami Un', resultat: 'reussie', codeHttp: null, idLot: 'lot-1',
};
const statutV1 = {
  version: 1, etat: 'termine', page: null, pages: null, raison: null, codeHttp: null, le: 1700000000000,
  ajoutees: 0, etiquettes: 0, prix: 0,
};

describe('T-303 clés', () => {
  it('SC-019 : nouvelles clés déclarées', () => {
    expect(CLES_STOCKAGE).toMatchObject({ ignorees: 'ignorees', historique: 'historique', affichage: 'affichage' });
    expect(VERSION_JOURNAL).toBe(2);
  });
});

describe('T-303 journal', () => {
  it('SC-019 : enveloppe v1 lue en v2, réécrite en v2 à la prochaine écriture', async () => {
    faux.donnees.set('journal', { version: 1, entrees: [entreeV1] });
    const j = await chargerJournal();
    expect(j[0]).toMatchObject({ rang: null, total: null, lot: null, cause: null });
    expect(faux.set).not.toHaveBeenCalled();
    await enregistrerJournal(j);
    expect(faux.donnees.get('journal')).toMatchObject({ version: 2 });
  });

  it('SC-019 : version 3 → illisible, jamais écrasée', async () => {
    const brut = { version: 3, entrees: [entreeV1] };
    faux.donnees.set('journal', brut);
    await expect(chargerJournal()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.donnees.get('journal')).toEqual(brut);
  });
});

describe('T-303 exécution', () => {
  it('SC-019 : v1 lue en v2 ; enregistrerExecution accepte une v1 et écrit une v2', async () => {
    faux.donnees.set('execution', { version: 1, idLot: 'lot-1', etat: 'en-cours', traitees: 1, total: 4 });
    expect(await chargerExecution()).toEqual({
      version: 2, idLot: 'lot-1', etat: 'en-cours', traitees: 1, total: 4, lots: [], pauseJusqua: null, erreur: null,
    });
    await enregistrerExecution({ version: 1, idLot: 'lot-2', etat: 'terminee', traitees: 4, total: 4 });
    expect(faux.donnees.get('execution')).toMatchObject({ version: 2, idLot: 'lot-2', lots: [], pauseJusqua: null, erreur: null });
  });

  it('SC-019 : version 3 → illisible, non écrasée', async () => {
    const brut = { version: 3, idLot: 'lot-1', etat: 'en-cours', traitees: 1, total: 4 };
    faux.donnees.set('execution', brut);
    await expect(chargerExecution()).rejects.toThrow(/^Données stockées illisibles/);
    expect(faux.set).not.toHaveBeenCalled();
    expect(faux.donnees.get('execution')).toEqual(brut);
  });
});

describe('T-303 statut de synchro', () => {
  it('SC-019 : v1 lue en v2 (null) ; version inconnue → null', async () => {
    faux.donnees.set('statutSynchro', statutV1);
    expect(await chargerStatutSynchro()).toEqual({ ...statutV1, version: 2, etape: null, prixFaits: null, prixPrevus: null, debut: null });
    faux.donnees.set('statutSynchro', { ...statutV1, version: 3 });
    expect(await chargerStatutSynchro()).toBeNull();
  });

  it('SC-019 : enregistrerStatutSynchro accepte une v1 et écrit une v2', async () => {
    await enregistrerStatutSynchro(statutV1 as unknown as StatutSynchro);
    expect(faux.donnees.get('statutSynchro')).toMatchObject({ version: 2, etape: null, debut: null });
  });
});

describe.each([
  ['ignorees', chargerIgnorees, enregistrerIgnorees, ecouterIgnorees, [] as unknown,
    { version: 1, entrees: [{ type: 'defausse', idCarte: 'Rare|Loutre', parametre: null, portee: 'synchro', date: 1700000000000 }] },
    [{ type: 'defausse', idCarte: 'Rare|Loutre', parametre: null, portee: 'synchro', date: 1700000000000 }]],
  ['historique', chargerHistorique, enregistrerHistorique, ecouterHistorique, [] as unknown,
    { version: 1, points: [{ jour: '2026-11-13', exemplaires: 7 }] },
    [{ jour: '2026-11-13', exemplaires: 7 }]],
  ['affichage', chargerAffichage, enregistrerAffichage, ecouterAffichage, { version: 1, animations: true } as unknown,
    { version: 1, animations: false }, { version: 1, animations: false }],
] as const)('T-303 clé %s', (cle, charger, enregistrer, ecouter, defaut, enveloppe, valeur) => {
  const chargerX = charger as () => Promise<unknown>;
  const enregistrerX = enregistrer as (v: never) => Promise<void>;

  it('AC6 : absente → valeur par défaut, sans écriture', async () => {
    expect(await chargerX()).toEqual(defaut);
    expect(faux.set).not.toHaveBeenCalled();
  });

  it('AC6 : écrite sous son enveloppe versionnée puis relue', async () => {
    await enregistrerX(valeur as never);
    expect(faux.donnees.get(cle)).toEqual(enveloppe);
    expect(await chargerX()).toEqual(valeur);
  });

  it.each([['version inconnue', { version: 9 }], ['texte', 'x'], ['tableau nu', []], ['null', null]])(
    'AC6 : illisible (%s) → défaut, sans écraser',
    async (_n, brut) => {
      faux.donnees.set(cle, brut);
      expect(await chargerX()).toEqual(defaut);
      expect(faux.set).not.toHaveBeenCalled();
      expect(faux.remove).not.toHaveBeenCalled();
      expect(faux.donnees.get(cle)).toEqual(brut);
    },
  );

  it('AC6 : quota refusé → erreur remontée, valeur existante intacte', async () => {
    faux.donnees.set(cle, enveloppe);
    faux.echec = new Error('QUOTA_BYTES quota exceeded');
    await expect(enregistrerX(valeur as never)).rejects.toThrow(/quota/i);
    expect(faux.donnees.get(cle)).toEqual(enveloppe);
  });

  it('AC6 : écouteur prévenu seulement pour sa clé, et désinscriptible', () => {
    const rappel = vi.fn();
    const arreter = (ecouter as (r: () => void) => () => void)(rappel);
    faux.ecouteurs.forEach((f) => f({ autre: {} }, 'local'));
    faux.ecouteurs.forEach((f) => f({ [cle]: {} }, 'sync'));
    expect(rappel).not.toHaveBeenCalled();
    faux.ecouteurs.forEach((f) => f({ [cle]: {} }, 'local'));
    expect(rappel).toHaveBeenCalledTimes(1);
    arreter();
    expect(faux.ecouteurs).toHaveLength(0);
  });
});

describe('T-303 écouteurs exécution et journal', () => {
  it.each([['execution', ecouterExecution], ['journal', ecouterJournal]] as const)('AC6 : %s', (cle, ecouter) => {
    const rappel = vi.fn();
    const arreter = ecouter(rappel);
    faux.ecouteurs.forEach((f) => f({ autre: {} }, 'local'));
    expect(rappel).not.toHaveBeenCalled();
    faux.ecouteurs.forEach((f) => f({ [cle]: {} }, 'local'));
    expect(rappel).toHaveBeenCalledTimes(1);
    arreter();
    expect(faux.ecouteurs).toHaveLength(0);
  });
});

describe('T-303 sauvegarde', () => {
  it('AC9 : sauvegarde.ts ne cite aucune des nouvelles clés', () => {
    const src = readFileSync(new URL('../../src/lib/sauvegarde.ts', import.meta.url), 'utf8');
    for (const mot of ['ignorees', 'historique', 'affichage', 'execution']) expect(src).not.toMatch(new RegExp(`\\b${mot}\\b`));
  });
});

describe('retouche T-308 : historique illisible jamais écrasé', () => {
  it.each([['version inconnue', { version: 9, points: [{ jour: '2026-11-13', exemplaires: 7 }] }], ['texte', 'x']])(
    'enregistrerHistorique refuse d’écrire par-dessus une clé illisible (%s)',
    async (_n, brut) => {
      faux.donnees.set('historique', brut);
      await expect(enregistrerHistorique([{ jour: '2026-11-14', exemplaires: 3 }])).rejects.toThrow(/illisible/i);
      expect(faux.set).not.toHaveBeenCalled();
      expect(faux.donnees.get('historique')).toEqual(brut);
    },
  );

  it('une clé absente reste écrivable', async () => {
    await enregistrerHistorique([{ jour: '2026-11-14', exemplaires: 3 }]);
    expect(faux.donnees.get('historique')).toEqual({ version: 1, points: [{ jour: '2026-11-14', exemplaires: 3 }] });
  });
});
