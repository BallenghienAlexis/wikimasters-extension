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

describe('cohérence compteur / filtre / étiquettes non thématiques', () => {
  it('le compteur d’un thème égale le nombre de cartes filtrées', async () => {
    const { compterParTheme } = await import('../../src/lib/tagsCarte');
    const cartes = [carte(['#Nazis']), carte(['#Nazis', '#Guerre']), carte(['#Guerre']), carte([], 'X', '', ['nazis'])];
    const n = compterParTheme(cartes, ['nazis', 'guerre'])['nazis'];
    expect(n).toBe(cartes.filter((c) => correspondAuTheme(c, 'nazis')).length);
    expect(n).toBe(3);
  });

  it('une carte qui ne porte que « #À échanger » garde ses thèmes prévus', () => {
    const c = carte(['#À échanger Quentin'], 'Carte', '', ['nazis']);
    expect(tagsDeCarte(c).poses).toEqual([]);
    expect(correspondAuTheme(c, 'nazis')).toBe(true);
  });
});

describe('performance et « #Autres »', () => {
  it('compte 2 600 cartes en moins de 2 s', async () => {
    const { compterParTheme } = await import('../../src/lib/tagsCarte');
    const { IDS_THEMES } = await import('../../src/lib/themes');
    const cartes = Array.from({ length: 2600 }, (_, i) => carte(i % 3 === 0 ? ['#Nazis'] : [], `Titre ${i}`, 'film d’animation japonais'));
    const debut = Date.now();
    compterParTheme(cartes, IDS_THEMES);
    expect(Date.now() - debut).toBeLessThan(2000);
  });

  it('une étiquette « #Autres » posée n’est pas un thème posé', () => {
    expect(tagsDeCarte(carte(['#Autres'])).poses).toEqual([]);
  });
});

describe('filtre sur un thème parent (2026-11-24)', () => {
  it('un parent liste aussi les cartes de ses thèmes enfants', () => {
    expect(correspondAuTheme(carte(['#Metalcore']), 'metal')).toBe(true);
    expect(correspondAuTheme(carte(['#Metalcore']), 'musique')).toBe(true);
    expect(correspondAuTheme(carte(['#Metalcore']), 'metalcore')).toBe(true);
  });

  it('un enfant ne liste pas son parent ni un thème sans lien', () => {
    expect(correspondAuTheme(carte(['#Musique']), 'metalcore')).toBe(false);
    expect(correspondAuTheme(carte(['#Metalcore']), 'nazis')).toBe(false);
  });

  it('suit aussi les thèmes prévus quand rien n’est posé', () => {
    expect(correspondAuTheme(carte([], 'C', '', ['metalcore']), 'musique')).toBe(true);
  });
});
