/**
 * T-303 (AC5) : historique quotidien.
 * Contrat attendu (src/lib/historique.ts) : `validerHistorique(enveloppe)` → `PointHistorique[] | null` ;
 * `jourLocal(date)` → 'AAAA-MM-JJ' (fuseau local) ; `noterPoint(points, exemplaires, maintenant:Date)` ;
 * `serie30Jours(points, maintenant:Date)` → 30 éléments `{jour, exemplaires:number|null}` finissant aujourd’hui.
 */
import { describe, expect, it } from 'vitest';
import { jourLocal, noterPoint, serie30Jours, validerHistorique } from '../../src/lib/historique';

describe('T-303 historique', () => {
  it('jour local (et non UTC)', () => {
    expect(jourLocal(new Date(2026, 10, 13, 23, 59))).toBe('2026-11-13');
    expect(jourLocal(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
  });

  it('le dernier point du jour remplace le précédent', () => {
    let p = noterPoint([], 10, new Date(2026, 10, 13, 8, 0));
    p = noterPoint(p, 12, new Date(2026, 10, 13, 20, 0));
    expect(p).toEqual([{ jour: '2026-11-13', exemplaires: 12 }]);
  });

  it('30 points au plus, les plus anciens partent', () => {
    let p: ReturnType<typeof noterPoint> = [];
    for (let i = 0; i < 35; i++) p = noterPoint(p, i, new Date(2026, 9, 1 + i, 12));
    expect(p).toHaveLength(30);
    expect(p[0]!.jour).toBe('2026-10-06');
    expect(p[29]!.exemplaires).toBe(34);
  });

  it('série sur 30 jours avec trous (null)', () => {
    const p = noterPoint(noterPoint([], 5, new Date(2026, 10, 10, 9)), 8, new Date(2026, 10, 13, 9));
    const s = serie30Jours(p, new Date(2026, 10, 13, 15));
    expect(s).toHaveLength(30);
    expect(s[29]).toEqual({ jour: '2026-11-13', exemplaires: 8 });
    expect(s[28]!.exemplaires).toBeNull();
    expect(s[26]).toEqual({ jour: '2026-11-10', exemplaires: 5 });
  });

  it('validation : enveloppe v1, version inconnue, forme invalide', () => {
    const pt = { jour: '2026-11-13', exemplaires: 3 };
    expect(validerHistorique({ version: 1, points: [pt] })).toEqual([pt]);
    expect(validerHistorique({ version: 2, points: [pt] })).toBeNull();
    expect(validerHistorique({ version: 1, points: [{ jour: '13/11/2026', exemplaires: 3 }] })).toBeNull();
    expect(validerHistorique({ version: 1, points: [{ jour: '2026-11-13', exemplaires: -1 }] })).toBeNull();
    expect(validerHistorique({ version: 1, points: Array.from({ length: 31 }, (_, i) => ({ jour: `2026-10-${String(i + 1).padStart(2, '0')}`, exemplaires: 1 })) })).toBeNull();
  });

  it('SC-007 : clé en trop jamais recopiée', () => {
    const r = validerHistorique({ version: 1, points: [{ jour: '2026-11-13', exemplaires: 3, titre: 'secret-fictif' }] });
    if (r !== null) expect(JSON.stringify(r)).not.toContain('secret-fictif');
  });
});
