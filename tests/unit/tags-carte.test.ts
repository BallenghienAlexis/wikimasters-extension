// Filtre par thème et tags affichés de la Collection : même source (étiquettes du site, sinon thèmes prévus).
import { describe, expect, it } from 'vitest';
import { correspondAuTheme, tagsDeCarte } from '../../src/lib/tagsCarte';

const carte = (etiquettesSite: string[], titre = 'Carte', description = '', themesChoisis?: string[]) => ({ titre, description, etiquettesSite, ...(themesChoisis ? { themesChoisis } : {}) });

describe('tags de carte', () => {
  it('filtre sur les étiquettes posées sur le site', () => {
    expect(correspondAuTheme(carte(['#Nazis', '#À échanger Quentin']), 'nazis')).toBe(true);
    expect(correspondAuTheme(carte(['#Politique']), 'nazis')).toBe(false);
  });

  it('un thème seulement prévu ne fait pas correspondre une carte déjà étiquetée sur le site, mais est signalé', () => {
    const c = carte(['#Politique'], 'Carte', '', ['nazis']);
    expect(correspondAuTheme(c, 'nazis')).toBe(false);
    expect(tagsDeCarte(c).aPoser).toEqual(['#Nazis']);
  });

  it('sans étiquette sur le site, on filtre sur les thèmes prévus', () => {
    expect(correspondAuTheme(carte([], 'Carte', '', ['nazis']), 'nazis')).toBe(true);
  });

  it('chaque carte filtrée sur un thème montre ce thème parmi ses tags', () => {
    const cartes = [carte(['#Nazis']), carte([], 'C', '', ['nazis']), carte(['#Guerre'], 'D', '', ['nazis'])];
    for (const c of cartes.filter((x) => correspondAuTheme(x, 'nazis'))) {
      const { poses, aPoser } = tagsDeCarte(c);
      expect((poses.length > 0 ? poses : aPoser)).toContain('#Nazis');
    }
  });

  it('sans aucun tag : « Autres »', () => {
    expect(correspondAuTheme(carte([], 'Xyzzy'), 'autres')).toBe(true);
  });
});
