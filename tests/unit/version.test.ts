import { describe, expect, it } from 'vitest';
import { incrementer, versionValide, versionsActuelles } from '../../scripts/version.mjs';

describe('versionnage', () => {
  it('un fix monte le dernier nombre', () => {
    expect(incrementer('1.0.0', 'fix')).toBe('1.0.1');
    expect(incrementer('1.10.15', 'fix')).toBe('1.10.16');
    expect(incrementer('1.10.9', 'fix')).toBe('1.10.10');
  });

  it('une feat monte le deuxième nombre et remet le dernier à 0', () => {
    expect(incrementer('1.10.15', 'feat')).toBe('1.11.0');
    expect(incrementer('1.9.3', 'feat')).toBe('1.10.0');
  });

  it('un changement majeur monte le premier nombre', () => {
    expect(incrementer('1.10.15', 'major')).toBe('2.0.0');
  });

  it('refuse une version ou un type invalide', () => {
    expect(() => incrementer('1.0', 'fix')).toThrow();
    expect(() => incrementer('1.0.0', 'chore')).toThrow();
    expect(versionValide('1.10.10')).toBe(true);
    expect(versionValide('01.0.0')).toBe(false);
    expect(versionValide('1.0.0-beta')).toBe(false);
  });

  it('package.json, manifeste Chrome et package-lock.json portent la même version', () => {
    const v = versionsActuelles();
    expect(versionValide(v.paquet)).toBe(true);
    expect(v.manifeste).toBe(v.paquet);
    expect(v.verrou).toBe(v.paquet);
  });
});
