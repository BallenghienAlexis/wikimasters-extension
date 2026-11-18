// Les lecteurs de collecter.mjs sur des réponses factices de la forme de l'API (aucun réseau).
import { describe, expect, it } from 'vitest';
// @ts-expect-error module .mjs sans types
import { lireEntite, lireLibelles, lirePageWikipedia, urlWikipedia } from './collecter.mjs';

describe('collecter.mjs', () => {
  it('lit introduction, catégories, homonymie et identifiant Wikidata', () => {
    const r = lirePageWikipedia({ query: { pages: [{ title: 'Wagon', extract: 'Un wagon est…', pageprops: { wikibase_item: 'Q1234' }, categories: [{ title: 'Catégorie:Wagon' }] }] } });
    expect(r).toEqual({ resume: 'Un wagon est…', categories: ['Wagon'], homonymie: false, qid: 'Q1234' });
    expect(lirePageWikipedia({ query: { pages: [{ missing: true }] } }).resume).toBe('');
    expect(lirePageWikipedia({ query: { pages: [{ pageprops: { disambiguation: '' } }] } }).homonymie).toBe(true);
  });
  it('lit description, humain et classes (liste fermée de propriétés)', () => {
    const claim = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
    const brut = { entities: { Q1: { descriptions: { fr: { value: 'film américain' } }, claims: { P31: [claim('Q5'), claim('Q11424')], P106: [claim('Q33999')], P999: [claim('Q1')] } } } };
    expect(lireEntite(brut, 'Q1')).toEqual({ description: 'film américain', humain: true, ids: ['Q11424', 'Q33999'] });
    expect(lireEntite({}, 'Q1').ids).toEqual([]);
  });
  it('lit les libellés français', () => {
    expect(lireLibelles({ entities: { Q1: { labels: { fr: { value: 'film' } } }, Q2: { labels: {} } } })).toEqual(['film']);
  });
  it('n’envoie que le titre', () => {
    const u = new URL(urlWikipedia('Four crématoire'));
    expect(u.hostname).toBe('fr.wikipedia.org');
    expect([...u.searchParams.keys()]).not.toContain('key');
    expect(u.searchParams.get('titles')).toBe('Four crématoire');
  });
});
