import { describe, expect, it } from 'vitest';
import { analyserPagination, lireSynchro, noterPage, progression, texteProgression, type Synchro } from '../../src/lib/synchro';

describe('analyserPagination', () => {
  it('lit le numéro de page et le total', () => {
    expect(analyserPagination(' Page 57 / 130 ')).toEqual({ page: 57, total: 130 });
  });

  it.each(['Chargement…', 'Page / 130', 'Page 0 / 130', 'Page 131 / 130', ''])('ignore « %s »', (texte) => {
    expect(analyserPagination(texte)).toBeNull();
  });
});

describe('noterPage', () => {
  it('ajoute une page et garde la liste triée', () => {
    const s = noterPage(noterPage(null, 'k', { page: 3, total: 5 }), 'k', { page: 1, total: 5 });
    expect(s.pages).toEqual([1, 3]);
  });

  it('ne compte pas deux fois une page', () => {
    const s = noterPage(noterPage(null, 'k', { page: 3, total: 5 }), 'k', { page: 3, total: 5 });
    expect(s.pages).toEqual([3]);
  });

  it.each([
    ['le tri ou un filtre change', 'autre', 5],
    ['le nombre de pages change', 'k', 6],
  ])('repart de zéro quand %s', (_nom, cle, total) => {
    const avant: Synchro = { cle: 'k', total: 5, pages: [1, 2] };
    expect(noterPage(avant, cle, { page: 3, total }).pages).toEqual([3]);
  });
});

describe('progression', () => {
  it('indique la première page manquante, même au milieu', () => {
    expect(progression({ cle: 'k', total: 5, pages: [1, 2, 4] })).toEqual({ lues: 3, total: 5, prochaine: 3 });
  });

  it('indique la fin de la lecture', () => {
    expect(progression({ cle: 'k', total: 2, pages: [1, 2] }).prochaine).toBeNull();
  });
});

describe('texteProgression', () => {
  it('annonce la page suivante, puis la fin', () => {
    expect(texteProgression({ lues: 1, total: 3, prochaine: 2 })).toBe('1 pages lues sur 3. Prochaine page à ouvrir : 2.');
    expect(texteProgression({ lues: 3, total: 3, prochaine: null })).toBe('Collection entière lue : 3 pages sur 3.');
  });
});

describe('lireSynchro', () => {
  it.each([[undefined], ['x'], [{ cle: 'k' }], [{ cle: 'k', total: 2, pages: ['a'] }]])('refuse %j', (brut) => {
    expect(lireSynchro(brut)).toBeNull();
  });

  it('accepte un suivi valide', () => {
    const s = { cle: 'k', total: 2, pages: [1] };
    expect(lireSynchro(s)).toEqual(s);
  });
});
