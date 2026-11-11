import { describe, expect, it } from 'vitest';
import type { ConfigPrix } from '../../src/config/prix';
import { CONFIG_PRIX } from '../../src/config/prix';
import type { Carte } from '../../src/lib/collection';
import { amisConcernes, apercuTri, appliquerTri, fusionnerAmisInitiaux, fileDeVente, lirePreferences, preferencesParDefaut, prixDepart, proposerTri, themesAimesDesFavoris, valeurDeCarte, type Preferences } from '../../src/lib/tri';

const carte = (surcharge: Partial<Carte> = {}): Carte => ({
  id: 'c1',
  etiquettesSite: [],
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
    const collection = { version: 3 as const, cartes: [carte({ statut: 'vendre', decidePar: 'moi' })] };
    expect(appliquerTri(collection, prefs({ mesThemes: ['gastronomie'] }), CONFIG).cartes[0]?.statut).toBe('vendre');
  });

  it('peut revoir une décision de l’assistant et efface le prix devenu inutile', () => {
    const collection = { version: 3 as const, cartes: [carte({ statut: 'vendre', prixCible: 60, decidePar: 'assistant' })] };
    expect(appliquerTri(collection, prefs({ mesThemes: ['gastronomie'] }), CONFIG).cartes[0]).toMatchObject({ statut: 'garder', prixCible: null });
  });

  it('ne modifie pas la collection d’origine', () => {
    const collection = { version: 3 as const, cartes: [carte()] };
    appliquerTri(collection, prefs(), CONFIG);
    expect(collection.cartes[0]?.statut).toBe('a-trier');
  });
});

describe('apercuTri', () => {
  it('compte par statut et limite les exemples', () => {
    const cartes = Array.from({ length: 7 }, (_, i) => carte({ id: `c${i}`, titre: `T${i}`, valeurMarchande: 1 }));
    const apercu = apercuTri({ version: 3, cartes }, prefs(), CONFIG, 5);
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

describe('cohérence tri et thèmes précis (SC-007)', () => {
  const chien = carte({ titre: 'Berger allemand', description: 'race de chien' });

  it('(a) un thème précis à moi donne garder', () => {
    expect(propose(chien, prefs({ mesThemes: ['chien'] })).statut).toBe('garder');
  });

  it('(b) un ami qui suit le parent reçoit la carte', () => {
    const p = propose(chien, prefs({ amis: [{ nom: 'Léa', themes: ['animaux'] }] }));
    expect(p).toMatchObject({ statut: 'echanger', ami: 'Léa' });
  });

  it('(c) garder l’emporte sur échanger', () => {
    const p = propose(chien, prefs({ mesThemes: ['chien'], amis: [{ nom: 'Léa', themes: ['chien'] }] }));
    expect(p.statut).toBe('garder');
  });

  it('(d) deux amis concernés : le premier de la liste', () => {
    const p = propose(chien, prefs({ amis: [{ nom: 'Hugo', themes: ['nature'] }, { nom: 'Léa', themes: ['chien'] }] }));
    expect(p.ami).toBe('Hugo');
  });

  it('(e) favori : garder, et une décision manuelle n’est jamais remplacée', () => {
    expect(propose({ ...chien, favori: true }, prefs({ amis: [{ nom: 'Léa', themes: ['chien'] }] })).statut).toBe('garder');
    const manuel = carte({ ...chien, statut: 'vendre', decidePar: 'moi' });
    const apres = appliquerTri({ version: 3, cartes: [manuel] } as never, prefs({ mesThemes: ['chien'] }), CONFIG);
    expect(apres.cartes[0]?.statut).toBe('vendre');
  });

  it('(f) relit des préférences version 2 à l’identique', () => {
    const brut = { version: 2, mesThemes: ['chien'], amis: [{ nom: 'Léa', themes: ['pont'] }] };
    expect(lirePreferences(brut)).toEqual(brut);
  });
});

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

  it('proposerTri utilise le premier ami renvoyé', () => {
    const c = carte({ description: 'race de chien' });
    expect(propose(c, prefs({ amis })).ami).toBe('Léa');
  });

  it('couvre barrage, tibet et ukraine pour des amis fictifs', () => {
    const p = prefs({ amis: [{ nom: 'Léa', themes: ['barrage', 'tibet'] }, { nom: 'Hugo', themes: ['ukraine'] }] });
    expect(propose(carte({ titre: 'Barrage hydroélectrique', description: 'centrale' }), p)).toMatchObject({ statut: 'echanger', ami: 'Léa' });
    expect(propose(carte({ titre: 'Lhassa', description: 'capitale du Tibet' }), p)).toMatchObject({ ami: 'Léa' });
    expect(propose(carte({ titre: 'Kiev', description: 'capitale de l’Ukraine' }), p)).toMatchObject({ ami: 'Hugo' });
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
