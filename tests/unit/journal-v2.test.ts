/**
 * T-303 (AC1, AC7, AC8) : journal v2.
 * Contrat attendu : `validerJournal(tableau)` accepte des entrées v1 (9 clés) ou v2 (13 clés) et
 * renvoie des entrées v2 ; `libelleHistorique(entree)` (journal.ts) donne le libellé H5.
 * `lot` est une `FamilleLot` ou null ; `cause` une `CauseJournal` ou null.
 */
import { describe, expect, it } from 'vitest';
import { libelleHistorique, ouvrirEntree, validerJournal } from '../../src/lib/journal';
import type { EntreeJournal } from '../../src/lib/actions';

const v1 = (surcharge: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: '1700000000000-1',
  horodatage: '2026-11-07T10:00:00.000Z',
  idCarte: 'Rare|Loutre',
  titre: 'Loutre',
  type: 'pose-etiquette',
  parametre: 'Ami Un',
  resultat: 'reussie',
  codeHttp: null,
  idLot: 'lot-1',
  ...surcharge,
});
const v2 = (surcharge: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...v1(),
  rang: 3,
  total: 10,
  lot: 'etiquettes',
  cause: null,
  ...surcharge,
});

describe('T-303 journal v2', () => {
  it('SC-019 : une entrée v1 est lue avec rang, total, lot, cause à null', () => {
    const j = validerJournal([v1()]);
    expect(j).not.toBeNull();
    expect(j![0]).toMatchObject({ rang: null, total: null, lot: null, cause: null, titre: 'Loutre' });
  });

  it('SC-019 : une entrée v2 est conservée telle quelle', () => {
    expect(validerJournal([v2({ cause: 'sautee', resultat: 'passee' })])![0]).toMatchObject({
      rang: 3, total: 10, lot: 'etiquettes', cause: 'sautee',
    });
  });

  it('SC-019 : une entrée nouvelle (ouvrirEntree) porte les 4 champs v2 à null', () => {
    const { journal } = ouvrirEntree(
      [],
      { idCarte: 'Rare|Loutre', titre: 'Loutre', type: 'defausse', parametre: null, idLot: 'lot-1' },
      () => new Date('2026-11-07T10:00:00.000Z'),
    );
    expect(journal[0]).toMatchObject({ rang: null, total: null, lot: null, cause: null });
  });

  it.each([
    'sautee', 'ignoree', 'manuel', 'echecs', 'code-http', 'resultat', 'ecriture', 'transport', 'verification',
  ])('SC-007 : cause %s acceptée', (cause) => {
    expect(validerJournal([v2({ cause })])).not.toBeNull();
  });

  it.each(['access_token', 'Bearer abc', '', 42, {}])('SC-007 : cause %j hors liste → rejet', (cause) => {
    expect(validerJournal([v2({ cause })])).toBeNull();
  });

  it.each([
    ['rang négatif', { rang: -1 }],
    ['total non entier', { total: 1.5 }],
    ['lot inconnu', { lot: 'autre' }],
  ])('SC-007 : %s → rejet', (_n, s) => {
    expect(validerJournal([v2(s)])).toBeNull();
  });

  it.each(['access_token', 'corps', 'idExemplaire'])('SC-007 : clé en trop %s jamais recopiée', (cle) => {
    const j = validerJournal([v2({ [cle]: 'secret-fictif' })]);
    if (j !== null) expect(JSON.stringify(j)).not.toContain('secret-fictif');
  });

  it('bornes : 1 001 entrées → rejet', () => {
    const e = Array.from({ length: 1001 }, (_, i) => v2({ id: `1-${i + 1}` }));
    expect(validerJournal(e)).toBeNull();
  });
});

const entree = (s: Partial<EntreeJournal>): EntreeJournal => validerJournal([v2(s as Record<string, unknown>)])![0]!;

describe('T-303 libellés d’historique (H5)', () => {
  it.each(['pose-etiquette', 'retrait-etiquette', 'enchere', 'defausse'])(
    'SC-018 : %s échouée 403 → « Passée : exemplaire indisponible »',
    (type) => {
      expect(libelleHistorique(entree({ type, resultat: 'echouee', codeHttp: 403 } as never))).toBe('Passée : exemplaire indisponible');
    },
  );

  it('SC-018 : 404 idem', () => {
    expect(libelleHistorique(entree({ type: 'defausse', resultat: 'echouee', codeHttp: 404 }))).toBe('Passée : exemplaire indisponible');
  });

  it('SC-018 : un échec 500 ou un 403 sur création garde son libellé d’échec', () => {
    expect(libelleHistorique(entree({ type: 'pose-etiquette', resultat: 'echouee', codeHttp: 500 }))).not.toMatch(/^Passée/);
    expect(libelleHistorique(entree({ type: 'creation-etiquette', resultat: 'echouee', codeHttp: 403 }))).not.toMatch(/^Passée/);
  });

  it('SC-018 : cause sautee / ignoree', () => {
    expect(libelleHistorique(entree({ resultat: 'passee', cause: 'sautee' }))).toBe('Passée : sautée');
    expect(libelleHistorique(entree({ resultat: 'passee', cause: 'ignoree' }))).toBe('Passée : ignorée jusqu’à la prochaine synchro');
  });

  it('SC-018 : la donnée stockée est inchangée', () => {
    const e = entree({ type: 'defausse', resultat: 'echouee', codeHttp: 403 });
    const avant = structuredClone(e);
    libelleHistorique(e);
    expect(e).toEqual(avant);
    expect(e.resultat).toBe('echouee');
  });
});
