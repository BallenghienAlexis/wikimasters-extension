/**
 * T-303 (AC2, AC8) : état d’exécution v2.
 * Contrat attendu (src/lib/etatExecution.ts) : `validerExecution(brut)` → `EtatExecutionV2 | null`,
 * accepte v1 (migrée) et v2. `erreur.cause` est une `CauseJournal`.
 */
import { describe, expect, it } from 'vitest';
import { validerExecution } from '../../src/lib/etatExecution';

const base = { idLot: 'lot-1', etat: 'arretee', traitees: 2, total: 5 };
const erreur = (s: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'pose-etiquette', parametre: 'Ami Un', idCarte: 'Rare|Loutre', titre: 'Loutre', famille: 'etiquettes',
  indexLot: 1, nbLots: 2, rang: 3, totalLot: 4, codeHttp: 500, cause: 'code-http',
  le: 1700000000000, reussies: 2, autresEchecsEnVol: 0, ...s,
});
const v2 = (s: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 2, ...base,
  lots: [{ famille: 'etiquettes', total: 4, traitees: 2, sautees: 0 }],
  pauseJusqua: null, erreur: erreur(), ...s,
});

describe('T-303 exécution v2', () => {
  it('SC-019 : v1 → lots [], pauseJusqua null, erreur null', () => {
    expect(validerExecution({ version: 1, ...base })).toEqual({ version: 2, ...base, lots: [], pauseJusqua: null, erreur: null });
  });

  it('SC-019 : v2 complète conservée', () => {
    const r = validerExecution(v2({ pauseJusqua: 1700000900000 }));
    expect(r).toMatchObject({ version: 2, pauseJusqua: 1700000900000, lots: [{ famille: 'etiquettes', total: 4, traitees: 2, sautees: 0 }] });
    expect(r!.erreur).toMatchObject({ rang: 3, totalLot: 4, famille: 'etiquettes', cause: 'code-http' });
  });

  it('SC-019 : erreur null acceptée', () => {
    expect(validerExecution(v2({ erreur: null }))).not.toBeNull();
  });

  it.each([3, 0, '2', undefined])('SC-019 : version %j inconnue → null', (version) => {
    expect(validerExecution({ ...v2(), version })).toBeNull();
  });

  it.each([
    ['etat inconnu', { etat: 'pause' }],
    ['traitees > total', { traitees: 6 }],
    ['6 lots', { lots: Array.from({ length: 6 }, () => ({ famille: 'etiquettes', total: 1, traitees: 0, sautees: 0 })) }],
    ['famille inconnue', { lots: [{ famille: 'autre', total: 1, traitees: 0, sautees: 0 }] }],
    ['lot traitees > total', { lots: [{ famille: 'encheres', total: 1, traitees: 2, sautees: 0 }] }],
    ['pauseJusqua négatif', { pauseJusqua: -5 }],
    ['pas un objet', 'texte'],
  ])('SC-019 : %s → null', (_n, s) => {
    expect(validerExecution(typeof s === 'string' ? s : v2(s))).toBeNull();
  });

  it.each([
    ['cause hors liste', { cause: 'access_token' }],
    ['type inconnu', { type: 'autre' }],
    ['famille inconnue', { famille: 'x' }],
    ['rang négatif', { rang: -1 }],
    ['codeHttp 99', { codeHttp: 99 }],
  ])('SC-007 : erreur avec %s → rejet', (_n, s) => {
    expect(validerExecution(v2({ erreur: erreur(s) }))).toBeNull();
  });

  it.each(['idExemplaire', 'access_token', 'corps'])('SC-007 : clé %s dans erreur jamais recopiée', (cle) => {
    const r = validerExecution(v2({ erreur: erreur({ [cle]: 'secret-fictif' }) }));
    if (r !== null) expect(JSON.stringify(r)).not.toContain('secret-fictif');
  });

  it('SC-007 : clé en trop à la racine jamais recopiée', () => {
    const r = validerExecution(v2({ access_token: 'secret-fictif' }));
    if (r !== null) expect(JSON.stringify(r)).not.toContain('secret-fictif');
  });

  it('SC-007 : chaînes tronquées', () => {
    const r = validerExecution(v2({ erreur: erreur({ titre: 'é'.repeat(5000), parametre: 'p'.repeat(5000) }) }));
    if (r !== null) {
      expect(Array.from(r.erreur!.titre).length).toBeLessThanOrEqual(300);
      expect(Array.from(r.erreur!.parametre ?? '').length).toBeLessThanOrEqual(300);
    }
  });
});
