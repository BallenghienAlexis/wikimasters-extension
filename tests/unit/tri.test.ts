import { describe, expect, it } from 'vitest';
import type { ConfigPrix } from '../../src/config/prix';
import { CONFIG_PRIX } from '../../src/config/prix';
import type { Carte } from '../../src/lib/collection';
import { apercuTri, appliquerTri, fileDeVente, lirePreferences, preferencesParDefaut, prixDepart, proposerTri, valeurDeCarte, type Preferences } from '../../src/lib/tri';

const carte = (surcharge: Partial<Carte> = {}): Carte => ({
  id: 'c1',
  titre: 'Carte fictive',
  rarete: 'C',
  description: 'agrume',
  quantite: 1,
  url: null,
  favori: false,
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: 100,
  decidePar: null,
  idsSite: null,
  ...surcharge,
});

const CONFIG: ConfigPrix = {
  seuilDefausse: 15,
  maxVentesSimultanees: 5,
  valeurParRarete: { C: null, L: 500 },
  matricePrixDepart: [
    { valeurMin: 15, prixDepart: 20 },
    { valeurMin: 50, prixDepart: 60 },
  ],
};

const prefs = (surcharge: Partial<Preferences> = {}): Preferences => ({ ...preferencesParDefaut(), ...surcharge });
const propose = (c: Carte, p = prefs()) => proposerTri(c, p, CONFIG);

describe('réglages livrés', () => {
  it('respecte le seuil de défausse de 15 et la limite de 5 ventes', () => {
    expect(CONFIG_PRIX.seuilDefausse).toBe(15);
    expect(CONFIG_PRIX.maxVentesSimultanees).toBe(5);
  });
});

describe('proposerTri', () => {
  it('garde un favori, quelle que soit sa valeur', () => {
    expect(propose(carte({ favori: true, valeurMarchande: 1 })).statut).toBe('garder');
  });

  it('garde une carte de mes thèmes, même sans valeur', () => {
    expect(propose(carte({ valeurMarchande: null }), prefs({ mesThemes: ['gastronomie'] })).statut).toBe('garder');
  });

  it('propose à un ami ce qui ne m’intéresse pas, selon ses thèmes', () => {
    const p = prefs({ amis: [{ nom: 'Ami fictif', themes: ['gastronomie'] }] });
    expect(propose(carte(), p)).toMatchObject({ statut: 'echanger', ami: 'Ami fictif' });
  });

  it('ma préférence passe avant celle d’un ami', () => {
    const p = prefs({ mesThemes: ['gastronomie'], amis: [{ nom: 'Ami fictif', themes: ['gastronomie'] }] });
    expect(propose(carte(), p).statut).toBe('garder');
  });

  it('ignore un ami sans thème commun', () => {
    expect(propose(carte(), prefs({ amis: [{ nom: 'Ami fictif', themes: ['sport'] }] })).statut).toBe('vendre');
  });

  it('défausse sous le seuil, et vend à partir du seuil', () => {
    expect(propose(carte({ valeurMarchande: 14 })).statut).toBe('defausser');
    expect(propose(carte({ valeurMarchande: 15 })).statut).toBe('vendre');
  });

  it('ne défausse ni ne vend une carte de valeur inconnue', () => {
    expect(propose(carte({ valeurMarchande: null })).statut).toBe('a-trier');
  });

  it('une valeur de 0 est connue, et se défausse', () => {
    expect(propose(carte({ valeurMarchande: 0 })).statut).toBe('defausser');
  });

  it('attribue le prix de départ de la matrice à une vente', () => {
    expect(propose(carte({ valeurMarchande: 60 })).prixCible).toBe(60);
  });
});

describe('valeurDeCarte', () => {
  it('préfère la valeur de la carte à celle de sa rareté', () => {
    expect(valeurDeCarte(carte({ rarete: 'L', valeurMarchande: 7 }), CONFIG)).toBe(7);
  });
  it('se replie sur la rareté', () => {
    expect(valeurDeCarte(carte({ rarete: 'L', valeurMarchande: null }), CONFIG)).toBe(500);
  });
});

describe('prixDepart', () => {
  it.each([
    [14, null],
    [15, 20],
    [49, 20],
    [50, 60],
    [1000, 60],
  ])('valeur %i donne %j', (valeur, attendu) => {
    expect(prixDepart(valeur, CONFIG)).toBe(attendu);
  });

  it('retient la tranche la plus haute, quel que soit l’ordre de la matrice', () => {
    const inverse = { ...CONFIG, matricePrixDepart: [...CONFIG.matricePrixDepart].reverse() };
    expect(prixDepart(60, inverse)).toBe(60);
  });

  it('sans matrice, le prix reste à définir', () => {
    expect(prixDepart(100, { ...CONFIG, matricePrixDepart: [] })).toBeNull();
  });
});

describe('fileDeVente', () => {
  const aVendre = (n: number): Carte[] =>
    Array.from({ length: n }, (_, i) => carte({ id: `v${i}`, statut: 'vendre', valeurMarchande: i * 10 }));

  it('propose au plus 5 ventes, des plus chères aux moins chères', () => {
    const file = fileDeVente(aVendre(8), CONFIG);
    expect(file.prochaines.map((c) => c.id)).toEqual(['v7', 'v6', 'v5', 'v4', 'v3']);
    expect(file.enAttente).toBe(3);
  });

  it('les ventes en cours occupent des places', () => {
    const enCours = [carte({ id: 'a', statut: 'en-vente' }), carte({ id: 'b', statut: 'en-vente' })];
    const file = fileDeVente([...enCours, ...aVendre(8)], CONFIG);
    expect(file.placesLibres).toBe(3);
    expect(file.prochaines).toHaveLength(3);
  });

  it('ne propose rien quand les 5 places sont prises', () => {
    const enCours = Array.from({ length: 5 }, (_, i) => carte({ id: `e${i}`, statut: 'en-vente' }));
    const file = fileDeVente([...enCours, ...aVendre(2)], CONFIG);
    expect(file.placesLibres).toBe(0);
    expect(file.prochaines).toEqual([]);
    expect(file.enAttente).toBe(2);
  });
});

describe('appliquerTri', () => {
  it('ne remplace jamais une décision prise à la main', () => {
    const collection = { version: 2 as const, cartes: [carte({ statut: 'vendre', decidePar: 'moi' })] };
    expect(appliquerTri(collection, prefs({ mesThemes: ['gastronomie'] }), CONFIG).cartes[0]?.statut).toBe('vendre');
  });

  it('peut revoir une décision de l’assistant et efface le prix devenu inutile', () => {
    const collection = { version: 2 as const, cartes: [carte({ statut: 'vendre', prixCible: 60, decidePar: 'assistant' })] };
    expect(appliquerTri(collection, prefs({ mesThemes: ['gastronomie'] }), CONFIG).cartes[0]).toMatchObject({ statut: 'garder', prixCible: null });
  });

  it('ne modifie pas la collection d’origine', () => {
    const collection = { version: 2 as const, cartes: [carte()] };
    appliquerTri(collection, prefs(), CONFIG);
    expect(collection.cartes[0]?.statut).toBe('a-trier');
  });
});

describe('apercuTri', () => {
  it('compte par statut et limite les exemples', () => {
    const cartes = Array.from({ length: 7 }, (_, i) => carte({ id: `c${i}`, titre: `T${i}`, valeurMarchande: 1 }));
    const apercu = apercuTri({ version: 2, cartes }, prefs(), CONFIG, 5);
    expect(apercu.defausser.nombre).toBe(7);
    expect(apercu.defausser.exemples).toHaveLength(5);
  });
});

describe('lirePreferences', () => {
  it.each([[undefined], [null], ['texte'], [{ version: 1 }], [{ version: 2, mesThemes: 'x', amis: [] }], [{ version: 2, mesThemes: [], amis: [{ nom: 1 }] }]])(
    'revient aux valeurs par défaut pour %j',
    (brut) => {
      expect(lirePreferences(brut)).toEqual(preferencesParDefaut());
    },
  );

  it('garde des préférences valides', () => {
    const p = prefs({ mesThemes: ['sport'], amis: [{ nom: 'Ami fictif', themes: ['arts'] }] });
    expect(lirePreferences(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

describe('matrice des prix réelle', () => {
  it('ne met jamais une carte en vente au-dessus de sa valeur du marché', () => {
    for (const tranche of CONFIG_PRIX.matricePrixDepart) {
      expect(tranche.prixDepart).toBeLessThan(tranche.valeurMin);
    }
  });
});
