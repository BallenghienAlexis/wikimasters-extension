/**
 * T-303 (AC5) : préférence d’affichage.
 * Contrat attendu (src/lib/affichage.ts) : `AFFICHAGE_DEFAUT`, `validerAffichage(enveloppe)` → `Affichage | null`.
 */
import { describe, expect, it } from 'vitest';
import { AFFICHAGE_DEFAUT, validerAffichage } from '../../src/lib/affichage';

describe('T-303 affichage', () => {
  it('défaut : animations activées', () => {
    expect(AFFICHAGE_DEFAUT).toEqual({ version: 1, animations: true });
  });
  it('valide', () => {
    expect(validerAffichage({ version: 1, animations: false })).toEqual({ version: 1, animations: false });
  });
  it.each([
    { version: 2, animations: true },
    { version: 1, animations: 'oui' },
    { version: 1 },
    'texte',
    null,
  ])('invalide %j → null', (brut) => {
    expect(validerAffichage(brut)).toBeNull();
  });
  it('SC-007 : clé en trop jamais recopiée', () => {
    const r = validerAffichage({ version: 1, animations: true, access_token: 'secret-fictif' });
    if (r !== null) expect(JSON.stringify(r)).not.toContain('secret-fictif');
  });
});
