// Précision avant rappel : un mot-clé cité en passant ne pose pas de thème (relevés d’Alexis, 2026-11-17).
import { describe, expect, it } from 'vitest';
import { themesDeTexte, themesPrincipaux } from '../../src/lib/themes';

describe('faux positifs de mots-clés', () => {
  it('« Four crématoire » : les animaux cités avec les humains ne donnent pas #Animaux', () => {
    const themes = themesPrincipaux({ titre: 'Four crématoire', description: 'four permettant de réduire en cendres le corps des êtres humains et des animaux' });
    expect(themes).not.toContain('animaux');
  });

  it('« Cambuses nord-américaines » : une voiture de chemin de fer n’est pas #Voiture', () => {
    expect(themesDeTexte('Voiture de chemin de fer', true)).not.toContain('voiture');
    expect(themesDeTexte('Un cambuse est une voiture de queue de train de marchandises.')).not.toContain('voiture');
    expect(themesDeTexte('Les voitures-lits et voitures de voyageurs.')).not.toContain('voiture');
    expect(themesDeTexte('Un cambuse est un wagon de chemin de fer.')).toContain('train');
  });

  it('les vrais cas restent trouvés', () => {
    expect(themesDeTexte('La voiture est une berline.')).toContain('voiture');
    expect(themesDeTexte('Le chien est un animal domestique.')).toContain('animaux');
    expect(themesDeTexte('Un mammifère, comme tous les animaux.')).toContain('animaux');
  });
});

describe('révision des entrées en cache', () => {
  it('une entrée lue avec d’anciennes règles est relue, une entrée à jour ne l’est pas', async () => {
    const { ajouterEntree, titresAVerifier, VERSION_REGLES } = await import('../../src/lib/wikipedia');
    const signaux = { genre: 'autre', fortes: [], faibles: [] } as never;
    const maintenant = Date.now();
    const a = ajouterEntree({ version: 1, entrees: {} }, 'A', ['train'], maintenant, false, signaux);
    const e = a.entrees['A']!;
    expect(e.regles).toBe(VERSION_REGLES);
    expect(titresAVerifier(['A'], a, maintenant)).toEqual([]);
    const ancien = { version: 1 as const, entrees: { A: { ...e, regles: VERSION_REGLES - 1 } } };
    expect(titresAVerifier(['A'], ancien, maintenant)).toEqual(['A']);
  });
});
