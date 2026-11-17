// Mode des étiquettes (Alexis, 2026-11-17) : pose suspendue par défaut, retrait général, jamais d’envoi sans lot.
import { describe, expect, it } from 'vitest';
import type { Collection, Carte } from '../../src/lib/collection';
import type { Registre } from '../../src/lib/actions';
import { construireLot, type Config } from '../../src/lib/lot';
import { reverifierAction } from '../../src/lib/revision';
import { copieDesEtiquettes } from '../../src/lib/sauvegardeEtiquettes';
import { lirePreferences, modeEtiquettes, preferencesParDefaut } from '../../src/lib/tri';

const carte: Carte = {
  id: 'c1', titre: 'Titre fictif', rarete: 'C', description: 'groupe français de metalcore', quantite: 1, url: null, favori: false,
  prixCible: null, note: '', ami: null, valeurMarchande: null, idsSite: ['ex1'], etiquettesSite: ['#Metalcore'],
} as Carte;
const collection: Collection = { version: 4, cartes: [carte] } as Collection;
const registreAvec = (...noms: string[]): Registre => ({ version: 2, etiquettes: {}, couples: noms.map((nom) => ({ ex: 'ex1', nom })) }) as Registre;
const config = (mode?: Config['modeEtiquettes']): Config => ({ maxVentesSimultanees: 5, longueurMaxEtiquette: null, nomsExistants: [], modeEtiquettes: mode }) as Config;
const tous = new Set(['creation-etiquette', 'pose-etiquette', 'retrait-etiquette']) as never;
const types = (mode: Config['modeEtiquettes'], registre: Registre) => construireLot(collection, registre, config(mode), tous).actions.map((a) => a.type);

describe('mode des étiquettes', () => {
  it('par défaut, les préférences suspendent la pose', () => {
    expect(modeEtiquettes(preferencesParDefaut())).toBe('suspendre');
    expect(modeEtiquettes(lirePreferences({ version: 2, mesThemes: [], amis: [], modeEtiquettes: 'poser' }))).toBe('poser');
    expect(modeEtiquettes(lirePreferences({ version: 2, mesThemes: [], amis: [], modeEtiquettes: 'nimporte' }))).toBe('suspendre');
  });

  it('« poser » : le lot crée et pose', () => {
    expect(types('poser', registreAvec())).toContain('pose-etiquette');
  });

  it('« suspendre » : aucune création ni pose, mais les retraits d’étiquettes devenues fausses restent proposés', () => {
    expect(types('suspendre', registreAvec())).toEqual([]);
    expect(types('suspendre', registreAvec('#Voiture'))).toEqual(['retrait-etiquette']);
  });

  it('« retirer-tout » : seulement des retraits, y compris pour une étiquette encore attendue', () => {
    const t = types('retirer-tout', registreAvec('#Metalcore', '#Voiture'));
    expect(t).toEqual(['retrait-etiquette', 'retrait-etiquette']);
  });

  it('la revérification refuse une pose hors mode « poser » et accepte le retrait général', () => {
    const registre = registreAvec('#Metalcore');
    const pose = { type: 'pose-etiquette', idCarte: 'c1', idExemplaire: 'ex1', nomEtiquette: '#Metalcore' } as const;
    const retrait = { type: 'retrait-etiquette', idCarte: 'c1', idExemplaire: 'ex1', nomEtiquette: '#Metalcore' } as const;
    expect(reverifierAction(pose, collection, registre, config('suspendre'))).toBe('passee');
    expect(reverifierAction(retrait, collection, registre, config('poser'))).toBe('passee');
    expect(reverifierAction(retrait, collection, registre, config('retirer-tout'))).toBe('ok');
  });

  it('la copie des étiquettes ne contient ni identifiant d’exemplaire ni donnée de session', () => {
    const copie = copieDesEtiquettes(collection, registreAvec('#Metalcore'), new Date('2026-11-17T12:00:00Z'));
    expect(copie.cartes).toEqual([{ titre: 'Titre fictif', etiquettes: ['#Metalcore'] }]);
    expect(JSON.stringify(copie)).not.toContain('ex1');
  });
});
