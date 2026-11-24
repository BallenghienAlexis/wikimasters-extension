import { describe, expect, it } from 'vitest';
import { idEtiquetteApresEchec, type DependancesSoin } from '../../src/app/soinPose';
import { registreVide } from '../../src/lib/registre';
import type { Registre } from '../../src/lib/actions';

function banc(site: Array<{ id: string; nom: string }> | null, registre: Registre = { ...registreVide(), etiquettes: { '#Égypte antique': 'vieux' } }) {
  const etat = { registre, creations: [] as string[], lectures: 0 };
  const deps: DependancesSoin = {
    lireListe: async () => { etat.lectures += 1; return site === null ? null : [...site, ...etat.creations.map((n, i) => ({ id: `neuf-${i}`, nom: n }))]; },
    creer: async (nom) => { etat.creations.push(nom); return `neuf-${etat.creations.length - 1}`; },
    chargerRegistre: async () => etat.registre,
    noter: async (nom, id) => { etat.registre = { ...etat.registre, etiquettes: { ...etat.registre.etiquettes, [nom]: id } }; },
    attendre: async () => undefined,
  };
  return { etat, deps };
}

describe('soin d’une pose échouée', () => {
  it('recrée une étiquette absente du site, une seule fois même si plusieurs poses échouent ensemble', async () => {
    const { etat, deps } = banc([{ id: 'a', nom: '#Politique' }]);
    const ids = await Promise.all([1, 2, 3].map(() => idEtiquetteApresEchec('#Égypte antique', 'vieux', deps)));
    expect(etat.creations).toEqual(['#Égypte antique']);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('neuf-0');
    expect(etat.registre.etiquettes['#Égypte antique']).toBe('neuf-0');
  });

  it('reprend l’identifiant d’une étiquette recréée à la main sous le même nom, sans doublon', async () => {
    const { etat, deps } = banc([{ id: 'main', nom: '#Égypte antique' }]);
    expect(await idEtiquetteApresEchec('#Égypte antique', 'vieux', deps)).toBe('main');
    expect(etat.creations).toEqual([]);
  });

  it('ne fait rien si le site montre l’étiquette avec le même identifiant (l’erreur est autre)', async () => {
    const { etat, deps } = banc([{ id: 'vieux', nom: '#Égypte antique' }]);
    expect(await idEtiquetteApresEchec('#Égypte antique', 'vieux', deps)).toBeNull();
    expect(etat.creations).toEqual([]);
  });

  it('ne prend pas une liste illisible ou vide pour une preuve, et ne crée jamais « À classer » ni « Autres »', async () => {
    for (const site of [null, []]) {
      const { etat, deps } = banc(site);
      expect(await idEtiquetteApresEchec('#Égypte antique', 'vieux', deps)).toBeNull();
      expect(etat.creations).toEqual([]);
    }
    const { etat, deps } = banc([{ id: 'a', nom: '#X' }]);
    expect(await idEtiquetteApresEchec('#À classer', 'x', deps)).toBeNull();
    expect(await idEtiquetteApresEchec('#Autres', 'x', deps)).toBeNull();
    expect(etat.lectures).toBe(0);
  });
});
