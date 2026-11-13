/**
 * T-302 (AC1) : familles de lots et découpage par appartenance.
 * Contrat attendu (src/lib/familles.ts), nommage fixé ici :
 * - `familleDe(action: Action | {type: TypeAction}): FamilleLot` ;
 * - `decouperEnLots(actions: Action[]): Array<{famille: FamilleLot, actions: Action[]}>` : un lot par famille
 *   présente, dans l’ordre de première apparition, l’ordre relatif des actions de chaque lot étant conservé.
 */
import { describe, expect, it } from 'vitest';
import { decouperEnLots, familleDe } from '../../src/lib/familles';
import type { Action, TypeAction } from '../../src/lib/actions';

const a = (type: TypeAction, n: number): Action => ({ type, idCarte: `Rare|Carte ${n}`, parametre: `p${n}` }) as unknown as Action;

describe('T-302 familles', () => {
  it('SC-002 : création, retrait et pose d’étiquette sont de la famille etiquettes', () => {
    for (const t of ['creation-etiquette', 'retrait-etiquette', 'pose-etiquette'] as const) {
      expect(familleDe({ type: t })).toBe('etiquettes');
    }
  });

  it('SC-002 : les autres types ont leur famille propre', () => {
    expect(familleDe({ type: 'enchere' })).toBe('encheres');
    expect(familleDe({ type: 'defausse' })).toBe('defausses');
    expect(familleDe({ type: 'suppression-etiquette' })).toBe('suppressions');
    expect(familleDe({ type: 'lecture' })).toBe('lectures');
  });

  it('SC-002 : découpage dans l’ordre de première apparition', () => {
    const lots = decouperEnLots([a('defausse', 1), a('pose-etiquette', 2), a('enchere', 3), a('defausse', 4)]);
    expect(lots.map((l) => l.famille)).toEqual(['defausses', 'etiquettes', 'encheres']);
    expect(lots[0]!.actions.map((x) => x.idCarte)).toEqual(['Rare|Carte 1', 'Rare|Carte 4']);
  });

  it('SC-002 : appartenance et non plage, un retrait ajouté en fin de file rejoint le lot Étiquettes', () => {
    const lots = decouperEnLots([
      a('pose-etiquette', 1), a('enchere', 2), a('enchere', 3), a('retrait-etiquette', 4),
    ]);
    expect(lots.map((l) => [l.famille, l.actions.length])).toEqual([['etiquettes', 2], ['encheres', 2]]);
    expect(lots[0]!.actions.map((x) => x.type)).toEqual(['pose-etiquette', 'retrait-etiquette']);
  });

  it('SC-002 : liste vide, aucun lot', () => {
    expect(decouperEnLots([])).toEqual([]);
  });
});
