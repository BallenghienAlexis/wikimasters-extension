/**
 * T-303 (AC3) : statut de synchro v2.
 * Contrat attendu (src/lib/statutSynchro.ts) : `validerStatutSynchro(brut)` → `StatutSynchro | null`
 * (v1 migrée avec etape, prixFaits, prixPrevus, debut à null ; version inconnue → null).
 */
import { describe, expect, it } from 'vitest';
import { validerStatutSynchro } from '../../src/lib/statutSynchro';

const v1 = {
  version: 1, etat: 'en-cours', page: 3, pages: 10, raison: null, codeHttp: null,
  le: 1700000000000, ajoutees: 1, etiquettes: 2, prix: 3,
};
const v2 = (s: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...v1, version: 2, etape: 'prix', prixFaits: 4, prixPrevus: 20, debut: 1699999000000, ...s,
});

describe('T-303 statut de synchro v2', () => {
  it('SC-019 : v1 → v2 avec null partout', () => {
    expect(validerStatutSynchro(v1)).toEqual({ ...v1, version: 2, etape: null, prixFaits: null, prixPrevus: null, debut: null });
  });

  it('SC-019 : v2 conservée', () => {
    expect(validerStatutSynchro(v2())).toEqual(v2());
  });

  it.each(['stats', 'pages', 'prix', 'ventes', null])('SC-019 : étape %j acceptée', (etape) => {
    expect(validerStatutSynchro(v2({ etape }))).not.toBeNull();
  });

  it.each([
    ['version 3', { version: 4 }],
    ['étape inconnue', { etape: 'tout' }],
    ['prixFaits négatif', { prixFaits: -1 }],
    ['prixPrevus non entier', { prixPrevus: 1.5 }],
    ['debut texte', { debut: 'hier' }],
    ['état inconnu', { etat: 'autre' }],
    ['raison inconnue', { raison: 'x' }],
  ])('SC-019 : %s → null', (_n, s) => {
    expect(validerStatutSynchro(v2(s))).toBeNull();
  });

  it('SC-007 : clé en trop jamais recopiée', () => {
    const r = validerStatutSynchro(v2({ access_token: 'secret-fictif' }));
    if (r !== null) expect(JSON.stringify(r)).not.toContain('secret-fictif');
  });
});
