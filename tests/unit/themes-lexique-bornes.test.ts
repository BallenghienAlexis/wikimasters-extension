import { describe, expect, it } from 'vitest';
import { themesDirectsDeTexte } from '../../src/lib/themes';

describe('bornes de mots du lexique', () => {
  it('« opérateur » ne donne pas « Musique classique »', () => {
    expect(themesDirectsDeTexte('opérateur de télécommunications')).not.toContain('classique');
    expect(themesDirectsDeTexte('opérateur historique')).not.toContain('classique');
    expect(themesDirectsDeTexte('coopérative opérationnelle')).not.toContain('classique');
  });

  it('« opéra » et « opéras » restent reconnus', () => {
    expect(themesDirectsDeTexte('Un opéra en trois actes')).toContain('classique');
    expect(themesDirectsDeTexte('des opéras célèbres')).toContain('classique');
    expect(themesDirectsDeTexte('compositeur d’opéra')).toContain('classique');
  });

  it('« entreprise » seul ne donne pas « Société »', () => {
    expect(themesDirectsDeTexte('entreprise française')).not.toContain('societe');
    expect(themesDirectsDeTexte('Entreprise du CAC 40')).not.toContain('societe');
  });

  it('les autres motifs de société restent reconnus', () => {
    expect(themesDirectsDeTexte('homme d’affaires américain')).toContain('societe');
  });
});
