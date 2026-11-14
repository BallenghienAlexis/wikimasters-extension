import { describe, expect, it } from 'vitest';
import { repartitionParRarete } from '../../src/lib/tableauDeBord';

describe('repartitionParRarete', () => {
  it('groupe par rareté dans l’ordre C, R, SR, E, UR, L puis « Sans rareté » en dernier', () => {
    const l = repartitionParRarete([
      { rarete: null, statut: 'garder' },
      { rarete: 'UR', statut: 'garder' },
      { rarete: 'C', statut: 'vendre' },
      { rarete: 'C', statut: 'echanger' },
      { rarete: 'R', statut: 'a-trier' },
    ]);
    expect(l.map((x) => x.rarete)).toEqual(['C', 'R', 'UR', 'Sans rareté']);
    expect(l[0]).toEqual({ rarete: 'C', titres: 2, garder: 0, echanger: 1, vendre: 1 });
    expect(l[1]).toEqual({ rarete: 'R', titres: 1, garder: 0, echanger: 0, vendre: 0 });
  });
  it('liste vide pour une collection vide', () => {
    expect(repartitionParRarete([])).toEqual([]);
  });
});
