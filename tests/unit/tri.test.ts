import { describe, expect, it } from 'vitest';
import type { ConfigPrix } from '../../src/config/prix';
import { CONFIG_PRIX } from '../../src/config/prix';
import type { Carte } from '../../src/lib/collection';
import { themesDeCarte } from '../../src/lib/themes';
import { amisConcernes, fusionnerAmisInitiaux, lirePreferences, plafondDefausse, preferencesParDefaut, prixDepart, themesAimesDesFavoris, valeurDeCarte, type Preferences } from '../../src/lib/tri';

const carte = (surcharge: Partial<Carte> = {}): Carte => ({
  id: 'c1',
  etiquettesSite: [],
  titre: 'Carte fictive',
  rarete: 'C',
  description: 'agrume',
  quantite: 1,
  url: null,
  favori: false,
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: 100,
  idsSite: null,
  ...surcharge,
});

const CONFIG: ConfigPrix = {
  seuilDefausse: 15,
  maxVentesSimultanees: 5,
  matricePrixDepart: [
    { valeurMin: 15, prixDepart: 20 },
    { valeurMin: 50, prixDepart: 60 },
  ],
};

const prefs = (surcharge: Partial<Preferences> = {}): Preferences => ({ ...preferencesParDefaut(), ...surcharge });

describe('valeurDeCarte', () => {
  it('renvoie la valeur marchande de la carte', () => {
    expect(valeurDeCarte(carte({ rarete: 'L', valeurMarchande: 7 }))).toBe(7);
  });
  it('renvoie null quand la valeur marchande est inconnue (plus de repli par rareté)', () => {
    expect(valeurDeCarte(carte({ rarete: 'L', valeurMarchande: null }))).toBeNull();
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

describe('plafond de défausse réglable', () => {
  it('plafondDefausse : valeur réglée valide, sinon 5', () => {
    expect(plafondDefausse(prefs())).toBe(5)
    expect(plafondDefausse(prefs({ plafondDefausse: 12 }))).toBe(12)
    for (const v of [0, 21, 2.5, Number.NaN]) expect(plafondDefausse(prefs({ plafondDefausse: v }))).toBe(5)
  })

  it('lirePreferences conserve un plafond valide et ignore un plafond invalide', () => {
    const base = { version: 2, mesThemes: [], amis: [] }
    expect(lirePreferences({ ...base, plafondDefausse: 8 }).plafondDefausse).toBe(8)
    expect(lirePreferences({ ...base, plafondDefausse: 99 }).plafondDefausse).toBeUndefined()
    expect(lirePreferences({ ...base, plafondDefausse: 'x' }).plafondDefausse).toBeUndefined()
  })
})

describe('lirePreferences', () => {
  it.each([[undefined], [null], ['texte'], [{ version: 1 }], [{ version: 2, mesThemes: 'x', amis: [] }], [{ version: 2, mesThemes: [], amis: [{ nom: 1 }] }]])(
    'revient aux valeurs par défaut pour %j',
    (brut) => {
      expect(lirePreferences(brut)).toEqual(preferencesParDefaut())
    },
  )

  it('garde des préférences valides', () => {
    const p = prefs({ mesThemes: ['sport'], amis: [{ nom: 'Ami fictif', themes: ['arts'] }] })
    expect(lirePreferences(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })
})

describe('matrice des prix réelle', () => {
  it('chaque prix de départ reste sous la valeur minimale de sa tranche', () => {
    for (const tranche of CONFIG_PRIX.matricePrixDepart) expect(tranche.prixDepart).toBeLessThan(tranche.valeurMin)
  })
})

describe('amisConcernes (H13)', () => {
  const amis = [
    { nom: 'Léa', themes: ['animaux'] },
    { nom: 'Hugo', themes: ['pont'] },
    { nom: 'Zoé', themes: ['animaux', 'nature'] },
  ];

  it('renvoie tous les amis concernés, dans l’ordre de la liste', () => {
    expect(amisConcernes(['chien', 'animaux', 'nature'], amis).map((a) => a.nom)).toEqual(['Léa', 'Zoé']);
  });

  it('renvoie une liste vide si aucun thème ne correspond', () => {
    expect(amisConcernes(['volcan'], amis)).toEqual([]);
    expect(amisConcernes([], amis)).toEqual([]);
  });

  it('couvre barrage, tibet et ukraine pour des amis fictifs', () => {
    const p = prefs({ amis: [{ nom: 'Léa', themes: ['barrage', 'tibet'] }, { nom: 'Hugo', themes: ['ukraine'] }] });
    const noms = (c: Carte): string[] => amisConcernes(themesDeCarte(c), p.amis).map((a) => a.nom);
    expect(noms(carte({ titre: 'Barrage hydroélectrique', description: 'centrale' }))).toEqual(['Léa']);
    expect(noms(carte({ titre: 'Lhassa', description: 'capitale du Tibet' }))).toEqual(['Léa']);
    expect(noms(carte({ titre: 'Kiev', description: 'capitale de l’Ukraine' }))).toEqual(['Hugo']);
  });
});

describe('fusionnerAmisInitiaux (SC-024)', () => {
  const initiaux = [
    { nom: 'Benji', themes: ['barrage', 'tibet'] },
    { nom: 'Anna', themes: ['ukraine'] },
  ];

  it('ajoute les amis absents', () => {
    const r = fusionnerAmisInitiaux(prefs(), initiaux);
    expect(r.amis).toEqual(initiaux);
  });

  it('ajoute les thèmes manquants à un ami présent, sans rien retirer', () => {
    const r = fusionnerAmisInitiaux(prefs({ amis: [{ nom: 'Benji', themes: ['pont', 'barrage'] }, { nom: 'Léa', themes: ['chien'] }] }), initiaux);
    expect(r.amis).toEqual([
      { nom: 'Benji', themes: ['pont', 'barrage', 'tibet'] },
      { nom: 'Léa', themes: ['chien'] },
      { nom: 'Anna', themes: ['ukraine'] },
    ]);
  });

  it('compare les noms sans casse ni accents', () => {
    const r = fusionnerAmisInitiaux(prefs({ amis: [{ nom: ' anna ', themes: [] }] }), initiaux);
    expect(r.amis.filter((a) => a.nom.trim().toLowerCase() === 'anna')).toHaveLength(1);
    expect(r.amis.find((a) => a.nom.trim() === 'anna')?.themes).toEqual(['ukraine']);
  });

  it('fusionne un ami initial saisi en minuscules sans le dupliquer', () => {
    const r = fusionnerAmisInitiaux(prefs({ amis: [{ nom: 'benji', themes: ['pont'] }] }), initiaux)
    expect(r.amis.filter((a) => a.nom.trim().toLowerCase() === 'benji')).toHaveLength(1)
    expect(r.amis.find((a) => a.nom === 'benji')?.themes).toEqual(['pont', 'barrage', 'tibet'])
    expect(r.amis.map((a) => a.nom)).toEqual(['benji', 'Anna'])
  })

  it('conserve mesThemes, est idempotente et ne mute pas l’entrée', () => {
    const entree = prefs({ mesThemes: ['chien'], amis: [{ nom: 'Benji', themes: ['pont'] }] });
    const copie = JSON.stringify(entree);
    const une = fusionnerAmisInitiaux(entree, initiaux);
    expect(JSON.stringify(entree)).toBe(copie);
    expect(une.mesThemes).toEqual(['chien']);
    expect(fusionnerAmisInitiaux(une, initiaux)).toEqual(une);
  });
});

describe('themesAimesDesFavoris', () => {
  it('compte les thèmes les plus précis des seuls favoris, du plus fréquent au plus rare', () => {
    const cartes = [
      carte({ id: 'a', titre: 'Tibet', description: '', favori: true }),
      carte({ id: 'b', titre: 'Barrage des Trois-Gorges', description: '', favori: true }),
      carte({ id: 'c', titre: 'Tibet', description: '', favori: true }),
      carte({ id: 'd', titre: 'Ukraine', description: '', favori: false }),
      carte({ id: 'e', titre: 'Xyzzy', description: '', favori: true }),
    ];
    const themes = themesAimesDesFavoris(cartes);
    expect(themes[0]).toEqual({ theme: 'tibet', nombre: 2 });
    expect(themes.map((x) => x.theme)).not.toContain('ukraine');
    expect(themes.map((x) => x.theme)).not.toContain('autres');
  });
  it('ne suggère pas le thème parent d’un thème trouvé sur la même carte', () => {
    const themes = themesAimesDesFavoris([carte({ titre: 'Tibet', description: '', favori: true })]);
    expect(themes).toEqual([{ theme: 'tibet', nombre: 1 }]);
  });
  it('renvoie une liste vide sans favori', () => {
    expect(themesAimesDesFavoris([carte()])).toEqual([]);
  });
});
