import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUREE_BAIL_MS } from '../../src/lib/ordonnanceur';
import { libelleErreurLancement, sousBail } from '../../src/app/Synchronisation';

function faux(initial: number | null) {
  let bail = initial;
  const ecritures: Array<number | null> = [];
  let t = 1_000_000;
  return {
    ecritures,
    avance: (ms: number) => (t += ms),
    deps: {
      lire: async () => bail,
      ecrire: async (v: number | null) => {
        bail = v;
        ecritures.push(v);
      },
      maintenant: () => t,
    },
    bail: () => bail,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('bail partagé avec la synchro automatique', () => {
  it('refuse si le bail est tenu, sans rien écrire ni exécuter', async () => {
    const b = faux(1_000_000 + 60_000);
    const f = vi.fn(async () => undefined);
    await expect(sousBail(b.deps, f)).rejects.toThrow('en cours');
    expect(f).not.toHaveBeenCalled();
    expect(b.ecritures).toEqual([]);
  });

  it('un bail expiré ne bloque pas', async () => {
    const b = faux(999_000);
    await sousBail(b.deps, async () => undefined);
    expect(b.bail()).toBeNull();
  });

  it('prend le bail, le renouvelle pendant l’exécution, le libère à la fin', async () => {
    const b = faux(null);
    await sousBail(b.deps, async () => {
      expect(b.bail()).toBe(1_000_000 + DUREE_BAIL_MS);
      b.avance(DUREE_BAIL_MS / 4);
      await vi.advanceTimersByTimeAsync(DUREE_BAIL_MS / 4);
      expect(b.ecritures.length).toBeGreaterThanOrEqual(2);
    });
    expect(b.bail()).toBeNull();
  });

  it('libère le bail quand l’exécution échoue', async () => {
    const b = faux(null);
    await expect(
      sousBail(b.deps, async () => {
        throw new Error('boum');
      }),
    ).rejects.toThrow('boum');
    expect(b.bail()).toBeNull();
  });

  it('le message de refus est un libellé fixe affichable', async () => {
    const b = faux(2_000_000);
    const e = await sousBail(b.deps, async () => undefined).catch((x: unknown) => x);
    expect(libelleErreurLancement(e)).toContain('en cours');
  });
});
