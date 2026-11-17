import { describe, expect, it } from 'vitest';
import { ancetresDe, chercherThemes, couvertPar, enfantsDe, parentsDirects, RACINES, selectionMinimale } from '../../src/lib/arbreThemes';
import { DEFINITIONS_THEMES } from '../../src/lib/themes';

describe('arbre des thèmes', () => {
  it('range les sous-thèmes sous leur famille', () => {
    expect(enfantsDe('alcool')).toEqual(expect.arrayContaining(['rhum', 'whisky', 'vin', 'biere']));
    expect(enfantsDe('guerre')).toEqual(expect.arrayContaining(['premiereguerre', 'secondeguerre']));
  });
  it('une course automobile est sous Course ET sous Automobile', () => {
    expect(enfantsDe('course')).toContain('courseauto');
    expect(enfantsDe('automobile')).toContain('courseauto');
    expect(enfantsDe('course')).toEqual(expect.arrayContaining(['natation', 'cyclisme']));
  });
  it('le parent direct ne répète pas les ancêtres', () => {
    expect(parentsDirects('voiture')).toEqual(['automobile']);
    expect(enfantsDe('vehicule')).not.toContain('voiture');
  });
  it('toute notion est atteignable depuis une famille de premier niveau', () => {
    const vus = new Set<string>();
    const visite = (id: string): void => {
      if (vus.has(id)) return;
      vus.add(id);
      enfantsDe(id).forEach(visite);
    };
    RACINES.forEach(visite);
    expect([...vus].sort()).toEqual(DEFINITIONS_THEMES.map((t) => t.id).sort());
  });
  it('cocher un parent couvre ses enfants', () => {
    expect(couvertPar('rhum', ['alcool'])).toBe('alcool');
    expect(couvertPar('alcool', ['rhum'])).toBeUndefined();
    expect(ancetresDe('rhum')).toContain('gastronomie');
    expect(selectionMinimale(['alcool', 'rhum', 'tennis'])).toEqual(['alcool', 'tennis']);
  });
  it('cherche sans casse ni accent et garde les ancêtres', () => {
    const r = chercherThemes('  RHUM ');
    expect(r?.trouves.has('rhum')).toBe(true);
    expect(r?.visibles.has('alcool')).toBe(true);
    expect(chercherThemes('premiere')?.trouves.has('premiereguerre')).toBe(true);
    expect(chercherThemes('')).toBeNull();
    expect(chercherThemes('zzzzzz')?.trouves.size).toBe(0);
  });
});
