/**
 * T-303 (AC4) : ignorées jusqu’à la prochaine synchro.
 * Contrat attendu (src/lib/ignorees.ts) : `Ignoree = {type, idCarte, parametre, portee:'synchro', date:number}` ;
 * `validerIgnorees(enveloppe)` → `Ignoree[] | null` ; `ajouterIgnoree(liste, i)` ; `retirerIgnoree(liste, i)` ;
 * `purger(liste, {maintenant:number, statutSynchro, cartes:ReadonlySet<string>})` ;
 * `filtrerLotIgnore(actions, ignorees)` → `{actions, ecartees:[{action, raison}]}`.
 */
import { describe, expect, it } from 'vitest';
import { ajouterIgnoree, filtrerLotIgnore, purger, retirerIgnoree, validerIgnorees, type Ignoree } from '../../src/lib/ignorees';
import type { Action } from '../../src/lib/actions';
import type { StatutSynchro } from '../../src/lib/statutSynchro';

const T0 = 1700000000000;
const JOUR = 86_400_000;
const ign = (s: Partial<Ignoree> = {}): Ignoree => ({
  type: 'pose-etiquette', idCarte: 'Rare|Loutre', parametre: 'Ami Un', portee: 'synchro', date: T0, ...s,
});
const statut = (s: Partial<StatutSynchro> = {}): StatutSynchro => ({
  version: 2, etat: 'termine', page: null, pages: null, raison: null, codeHttp: null, le: T0 + 10,
  ajoutees: 0, etiquettes: 0, prix: 0, etape: null, prixFaits: null, prixPrevus: null, debut: null, ...s,
});

describe('T-303 ignorées', () => {
  it('validation : enveloppe v1 valide, version inconnue et forme invalide rejetées', () => {
    expect(validerIgnorees({ version: 1, entrees: [ign()] })).toEqual([ign()]);
    expect(validerIgnorees({ version: 2, entrees: [ign()] })).toBeNull();
    expect(validerIgnorees({ version: 1, entrees: [ign({ portee: 'autre' as never })] })).toBeNull();
    expect(validerIgnorees({ version: 1, entrees: [ign({ type: 'x' as never })] })).toBeNull();
    expect(validerIgnorees({ version: 1, entrees: Array.from({ length: 501 }, (_, i) => ign({ idCarte: `R|${i}` })) })).toBeNull();
  });

  it('SC-007 : clé en trop (idExemplaire) jamais recopiée', () => {
    const r = validerIgnorees({ version: 1, entrees: [{ ...ign(), idExemplaire: 'secret-fictif' }] });
    if (r !== null) expect(JSON.stringify(r)).not.toContain('secret-fictif');
  });

  it('ajouter / retirer (Reprendre), sans doublon', () => {
    let l = ajouterIgnoree([], ign());
    l = ajouterIgnoree(l, ign());
    expect(l).toHaveLength(1);
    l = ajouterIgnoree(l, ign({ idCarte: 'Rare|Renard' }));
    expect(l).toHaveLength(2);
    expect(retirerIgnoree(l, ign())).toEqual([ign({ idCarte: 'Rare|Renard' })]);
  });

  it('500 entrées au plus : les plus anciennes partent', () => {
    let l: Ignoree[] = [];
    for (let i = 0; i < 502; i++) l = ajouterIgnoree(l, ign({ idCarte: `R|${i}`, date: T0 + i }));
    expect(l).toHaveLength(500);
    expect(l.some((x) => x.idCarte === 'R|0')).toBe(false);
    expect(l.some((x) => x.idCarte === 'R|501')).toBe(true);
  });

  describe('purger', () => {
    const cartes = new Set(['Rare|Loutre']);
    it('garde une entrée récente, carte présente, sans synchro terminée depuis', () => {
      expect(purger([ign()], { maintenant: T0 + JOUR, statutSynchro: statut({ debut: T0 - 5 }), cartes })).toEqual([ign()]);
    });
    it('retire après une synchro terminée dont le début est postérieur', () => {
      expect(purger([ign()], { maintenant: T0 + 1000, statutSynchro: statut({ debut: T0 + 1 }), cartes })).toEqual([]);
    });
    it('garde si la synchro n’est pas terminée ou sans début connu', () => {
      expect(purger([ign()], { maintenant: T0 + 1000, statutSynchro: statut({ etat: 'en-cours', debut: T0 + 1 }), cartes })).toHaveLength(1);
      expect(purger([ign()], { maintenant: T0 + 1000, statutSynchro: statut({ debut: null }), cartes })).toHaveLength(1);
      expect(purger([ign()], { maintenant: T0 + 1000, statutSynchro: null, cartes })).toHaveLength(1);
    });
    it('retire si la carte a disparu', () => {
      expect(purger([ign({ idCarte: 'Rare|Disparue' })], { maintenant: T0 + 1000, statutSynchro: null, cartes })).toEqual([]);
    });
    it('retire après 30 jours', () => {
      expect(purger([ign()], { maintenant: T0 + 30 * JOUR + 1, statutSynchro: null, cartes })).toEqual([]);
      expect(purger([ign()], { maintenant: T0 + 29 * JOUR, statutSynchro: null, cartes })).toHaveLength(1);
    });
  });

  describe('filtrerLotIgnore', () => {
    const actions: Action[] = [
      { type: 'creation-etiquette', idCarte: 'Rare|Loutre', nomEtiquette: 'Thème · Eau' },
      { type: 'pose-etiquette', idCarte: 'Rare|Loutre', idExemplaire: 'ex-1', nomEtiquette: 'Thème · Eau' },
      { type: 'pose-etiquette', idCarte: 'Rare|Renard', idExemplaire: 'ex-2', nomEtiquette: 'Thème · Eau' },
      { type: 'pose-etiquette', idCarte: 'Rare|Renard', idExemplaire: 'ex-2', nomEtiquette: 'Autre' },
      { type: 'defausse', idCarte: 'Rare|Lynx', idExemplaire: 'ex-3' },
    ];
    it('sans ignorée : tout passe', () => {
      expect(filtrerLotIgnore(actions, []).actions).toEqual(actions);
    });
    it('une création ignorée écarte aussi les poses de la même étiquette', () => {
      const r = filtrerLotIgnore(actions, [ign({ type: 'creation-etiquette', parametre: 'Thème · Eau' })]);
      expect(r.actions).toEqual([actions[3], actions[4]]);
      expect(r.ecartees).toHaveLength(3);
      expect(r.ecartees.filter((e) => e.raison === 'création ignorée').length).toBeGreaterThanOrEqual(2);
    });
    it('une défausse ignorée est écartée seule', () => {
      const r = filtrerLotIgnore(actions, [ign({ type: 'defausse', idCarte: 'Rare|Lynx', parametre: null })]);
      expect(r.actions).toEqual(actions.slice(0, 4));
      expect(r.ecartees).toHaveLength(1);
    });
  });
});
