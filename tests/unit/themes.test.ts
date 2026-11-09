import { meilleureDuree } from './duree';
import { describe, expect, it } from 'vitest';
import type { Carte } from '../../src/lib/collection';
import { compterThemes, LIBELLES_THEMES, themesDeCarte } from '../../src/lib/themes';

const themes = (description: string, titre = 'Titre fictif'): string[] => themesDeCarte({ titre, description });

describe('themesDeCarte', () => {
  it.each([
    ['homme d’État français', 'politique'],
    ['physicienne et chimiste polonaise', 'sciences'],
    ['sixième planète du Système solaire', 'espace'],
    ['espèce d’oiseaux', 'nature'],
    ['agrume', 'gastronomie'],
    ['volcan au sud-ouest de Tokyo', 'geographie'],
    ['artiste peintre mexicaine', 'arts'],
    ['film réalisé en 1986', 'cinema'],
    ['compositeur allemand', 'musique'],
    ['écrivain français', 'litterature'],
    ['école de la philosophie indienne', 'idees'],
    ['athlète belge', 'sport'],
    ['paquebot transatlantique britannique', 'bateaux'],
    ['homme d’affaires français', 'societe'],
    ['ancienne cité inca du XVe siècle', 'histoire'],
  ])('« %s » donne %s', (description, attendu) => {
    expect(themes(description)).toContain(attendu);
  });

  it.each([
    ['#Automobile', 'constructeur automobile allemand', 'automobile'],
    ['#Avion', 'avion de ligne', 'avion'],
    ['#Bateaux', 'navire de guerre', 'bateaux'],
    ['#Bus', 'autobus urbain', 'bus'],
    ['#Camion', 'camion militaire', 'camion'],
    ['#Course', 'course automobile', 'course'],
    ['#Formule 1', 'pilote de Formule 1', 'formule1'],
    ['#Grunge', 'groupe de grunge', 'grunge'],
    ['#Guerre', 'bataille de 1916', 'guerre'],
    ['#Informatique', 'logiciel libre', 'informatique'],
    ['#Jazz', 'trompettiste de jazz', 'jazz'],
    ['#Métal', 'groupe de heavy metal', 'metal'],
    ['#Moto', 'moto japonaise', 'moto'],
    ['#Musique', 'chanteuse', 'musique'],
    ['#Nascar', 'pilote de NASCAR', 'nascar'],
    ['#Nazis', 'parti nazi', 'nazis'],
    ['#Pop', 'chanteuse de pop américaine', 'pop'],
    ['#Pop Rock', 'groupe de pop rock', 'poprock'],
    ['#Rallye', 'rallye automobile', 'rallye'],
    ['#Rock', 'groupe de rock britannique', 'rock'],
    ['#Techno', 'musique électronique', 'techno'],
    ['#Tracteur', 'tracteur agricole', 'tracteur'],
    ['#Train', 'locomotive à vapeur', 'train'],
    ['#Véhicule', 'véhicule blindé', 'vehicule'],
    ['#Voiture', 'voiture de sport', 'voiture'],
  ])('reprend l’étiquette du jeu %s', (libelle, description, id) => {
    expect(LIBELLES_THEMES[id]).toBe(libelle);
    expect(themes(description)).toContain(id);
  });

  it('une étiquette précise entraîne ses étiquettes parentes', () => {
    expect(themes('groupe de rock')).toEqual(expect.arrayContaining(['rock', 'musique']));
    expect(themes('voiture de sport')).toEqual(expect.arrayContaining(['voiture', 'automobile', 'vehicule']));
  });

  it.each([
    ['population de la ville', 'pop'],
    ['métallurgie', 'metal'],
    ['technologie', 'techno'],
    ['entraînement', 'train'],
    ['abus de droit', 'bus'],
  ])('« %s » ne donne pas %s', (description, id) => {
    expect(themes(description)).not.toContain(id);
  });

  it('une carte peut avoir plusieurs thèmes', () => {
    expect(themes('physicienne et chanteuse')).toEqual(expect.arrayContaining(['sciences', 'musique']));
  });

  it('range à part une carte sans indice', () => {
    expect(themes('')).toEqual(['autres']);
  });

  it('ne confond pas le début d’un mot avec son milieu', () => {
    expect(themes('apartement')).not.toContain('arts');
    expect(themes('partie')).not.toContain('arts');
  });

  it('ignore la casse et les accents, et lit aussi le titre', () => {
    expect(themes('', 'PLANÈTE lointaine')).toContain('espace');
  });
});

describe('compterThemes', () => {
  it('compte chaque thème, y compris à zéro', () => {
    const cartes = [{ titre: 'x', description: 'agrume' }, { titre: 'y', description: 'fruit' }] as Carte[];
    const compte = compterThemes(cartes);
    expect(compte.gastronomie).toBe(2);
    expect(compte.sport).toBe(0);
  });
});

// --- Feature theme-etiquettes (T-101) : thèmes précis ---
import { DEFINITIONS_THEMES, IDS_THEMES } from '../../src/lib/themes';

const NOUVEAUX: Record<string, { libelle: string; parents: string[]; cartes: Array<[string, string]> }> = {
  chien: { libelle: '#Chien', parents: ['animaux', 'nature'], cartes: [['Berger allemand', 'race de chien'], ['Caniche', 'chiens de compagnie']] },
  chat: { libelle: '#Chat', parents: ['animaux', 'nature'], cartes: [['Siamois', 'race de chat'], ['Chaton', 'jeune animal']] },
  cheval: { libelle: '#Cheval', parents: ['animaux', 'nature'], cartes: [['Pur-sang', 'cheval de course'], ['Camargue', 'chevaux sauvages']] },
  felin: { libelle: '#Félin', parents: ['animaux', 'nature'], cartes: [['Lion', 'félin d’Afrique'], ['Tigre', 'grand félin']] },
  ours: { libelle: '#Ours', parents: ['animaux', 'nature'], cartes: [['Ours brun', 'plantigrade'], ['Ourse polaire', 'mammifère']] },
  singe: { libelle: '#Singe', parents: ['animaux', 'nature'], cartes: [['Gorille', 'primate'], ['Macaque', 'singe d’Asie']] },
  cetace: { libelle: '#Cétacé', parents: ['animaux', 'nature'], cartes: [['Baleine bleue', 'mammifère marin'], ['Orque', 'grand dauphin noir']] },
  requin: { libelle: '#Requin', parents: ['animaux', 'nature'], cartes: [['Requin blanc', 'prédateur'], ['Requin-marteau', 'poisson']] },
  serpent: { libelle: '#Serpent', parents: ['animaux', 'nature'], cartes: [['Cobra royal', 'reptile'], ['Vipère', 'serpent venimeux']] },
  rapace: { libelle: '#Rapace', parents: ['animaux', 'nature'], cartes: [['Aigle royal', 'oiseau'], ['Faucon pèlerin', 'rapace diurne']] },
  dinosaure: { libelle: '#Dinosaure', parents: ['animaux', 'nature'], cartes: [['Tyrannosaure', 'dinosaure carnivore'], ['Diplodocus', 'sauropode']] },
  insecte: { libelle: '#Insecte', parents: ['animaux', 'nature'], cartes: [['Scarabée', 'coléoptère'], ['Fourmi rouge', 'insecte social']] },
  papillon: { libelle: '#Papillon', parents: ['animaux', 'nature'], cartes: [['Monarque', 'papillon migrateur'], ['Machaon', 'lépidoptère']] },
  araignee: { libelle: '#Araignée', parents: ['animaux', 'nature'], cartes: [['Mygale', 'araignée velue'], ['Tarentule', 'arachnide']] },
  pont: { libelle: '#Pont', parents: ['architecture', 'arts'], cartes: [['Pont du Gard', 'aqueduc romain'], ['Viaduc de Millau', 'ouvrage d’art']] },
  tunnel: { libelle: '#Tunnel', parents: ['architecture', 'arts'], cartes: [['Tunnel sous la Manche', 'ouvrage'], ['Tunnel du Mont-Blanc', 'tunnel routier']] },
  tour: { libelle: '#Tour', parents: ['architecture', 'arts'], cartes: [['Tour Eiffel', 'monument de Paris'], ['Donjon', 'tour fortifiée']] },
  chateau: { libelle: '#Château', parents: ['architecture', 'arts'], cartes: [['Château de Chambord', 'résidence royale'], ['Forteresse', 'construction militaire']] },
  cathedrale: { libelle: '#Cathédrale', parents: ['architecture', 'arts'], cartes: [['Cathédrale de Reims', 'édifice gothique'], ['Abbaye du Mont', 'monastère']] },
  phare: { libelle: '#Phare', parents: ['architecture', 'arts'], cartes: [['Phare de Cordouan', 'tour en mer'], ['Gardien de phare', 'métier']] },
  barrage: { libelle: '#Barrage', parents: ['architecture', 'arts'], cartes: [['Barrage hydroélectrique', 'centrale'], ['Barrages de la Chine', 'grands barrages']] },
  gratteciel: { libelle: '#Gratte-ciel', parents: ['architecture', 'arts'], cartes: [['Burj Khalifa', 'gratte-ciel de Dubaï'], ['Empire State', 'gratte-ciel de New York']] },
  montagne: { libelle: '#Montagne', parents: ['geographie'], cartes: [['Mont Blanc', 'sommet des Alpes'], ['Massif central', 'montagne de France']] },
  volcan: { libelle: '#Volcan', parents: ['geographie'], cartes: [['Etna', 'volcan de Sicile'], ['Stromboli', 'volcan actif']] },
  ile: { libelle: '#Île', parents: ['geographie'], cartes: [['Corse', 'île de la Méditerranée'], ['Bora-Bora', 'atoll polynésien']] },
  fleuve: { libelle: '#Fleuve', parents: ['geographie'], cartes: [['Loire', 'fleuve de France'], ['Rhône', 'rivière alpine']] },
  lac: { libelle: '#Lac', parents: ['geographie'], cartes: [['Léman', 'lac alpin'], ['Grands Lacs', 'lacs d’Amérique']] },
  desert: { libelle: '#Désert', parents: ['geographie'], cartes: [['Sahara', 'désert d’Afrique'], ['Atacama', 'zone désertique']] },
  ocean: { libelle: '#Océan', parents: ['geographie'], cartes: [['Atlantique', 'océan'], ['Méditerranée', 'mer intérieure']] },
  planete: { libelle: '#Planète', parents: ['espace', 'sciences'], cartes: [['Mars', 'planète rouge'], ['Proxima b', 'exoplanète']] },
  etoile: { libelle: '#Étoile', parents: ['espace', 'sciences'], cartes: [['Sirius', 'étoile brillante'], ['Bételgeuse', 'supernova possible']] },
  galaxie: { libelle: '#Galaxie', parents: ['espace', 'sciences'], cartes: [['Andromède', 'galaxie voisine'], ['Voie lactée', 'notre galaxie']] },
  comete: { libelle: '#Comète', parents: ['espace', 'sciences'], cartes: [['Halley', 'comète périodique'], ['Cérès', 'astéroïde']] },
  arbre: { libelle: '#Arbre', parents: ['plantes', 'nature'], cartes: [['Chêne', 'arbre de forêt'], ['Sapin', 'conifère']] },
  fleur: { libelle: '#Fleur', parents: ['plantes', 'nature'], cartes: [['Rose', 'fleur parfumée'], ['Vanille', 'orchidée']] },
  champignon: { libelle: '#Champignon', parents: ['plantes', 'nature'], cartes: [['Cèpe', 'champignon comestible'], ['Amanite', 'champignon toxique']] },
  fromage: { libelle: '#Fromage', parents: ['gastronomie'], cartes: [['Comté', 'fromage jurassien'], ['Brie', 'fromage à pâte molle']] },
  vin: { libelle: '#Vin', parents: ['gastronomie'], cartes: [['Bordeaux', 'vin rouge'], ['Pinot', 'cépage bourguignon']] },
  biere: { libelle: '#Bière', parents: ['gastronomie'], cartes: [['Trappiste', 'bière belge'], ['Stout', 'bière brune']] },
  fruit: { libelle: '#Fruit', parents: ['gastronomie'], cartes: [['Pomme', 'fruit du pommier'], ['Citron', 'agrume']] },
  dessert: { libelle: '#Dessert', parents: ['gastronomie'], cartes: [['Tarte', 'dessert aux fruits'], ['Éclair', 'pâtisserie']] },
  tennis: { libelle: '#Tennis', parents: ['sport'], cartes: [['Roland-Garros', 'tournoi de tennis'], ['Raquette', 'tennis de table']] },
  rugby: { libelle: '#Rugby', parents: ['sport'], cartes: [['Troisième ligne', 'poste de rugby'], ['Mêlée', 'phase de rugby']] },
  basketball: { libelle: '#Basketball', parents: ['sport'], cartes: [['Dunk', 'basketball américain'], ['Meneur', 'basketteur']] },
  ski: { libelle: '#Ski', parents: ['sport'], cartes: [['Slalom', 'épreuve de ski'], ['Skieuse', 'championne alpine']] },
  golf: { libelle: '#Golf', parents: ['sport'], cartes: [['Green', 'terrain de golf'], ['Golfeur', 'joueur']] },
  natation: { libelle: '#Natation', parents: ['sport'], cartes: [['Crawl', 'nage de natation'], ['Nageuse', 'championne']] },
  egypteantique: { libelle: '#Égypte antique', parents: ['histoire'], cartes: [['Toutankhamon', 'pharaon'], ['Pyramide', 'monument de l’Égypte antique']] },
  romeantique: { libelle: '#Rome antique', parents: ['histoire'], cartes: [['Jules César', 'Rome antique'], ['Légionnaire', 'légion romaine']] },
  greceantique: { libelle: '#Grèce antique', parents: ['histoire'], cartes: [['Athènes', 'cité de la Grèce antique'], ['Sparte', 'cité grecque']] },
  moyenage: { libelle: '#Moyen Âge', parents: ['histoire'], cartes: [['Croisade', 'événement du Moyen Âge'], ['Chevalier', 'guerrier médiéval']] },
  prehistoire: { libelle: '#Préhistoire', parents: ['histoire'], cartes: [['Lascaux', 'grotte préhistorique'], ['Silex', 'outil néolithique']] },
  premiereguerre: { libelle: '#Première Guerre mondiale', parents: ['guerre', 'histoire'], cartes: [['Verdun', 'Première Guerre mondiale'], ['Tranchée', 'Grande Guerre']] },
  secondeguerre: { libelle: '#Seconde Guerre mondiale', parents: ['guerre', 'histoire'], cartes: [['Débarquement', 'Seconde Guerre mondiale'], ['Résistance', 'Deuxième Guerre mondiale']] },
  mythologie: { libelle: '#Mythologie', parents: ['religion'], cartes: [['Zeus', 'mythologie grecque'], ['Odin', 'divinité nordique']] },
  superheros: { libelle: '#Super-héros', parents: ['bd', 'litterature'], cartes: [['Capitaine', 'super-héros masqué'], ['Wonder', 'super-héroïne']] },
  velo: { libelle: '#Vélo', parents: ['vehicule'], cartes: [['Bicyclette', 'deux-roues'], ['Vélo de route', 'vélos de course']] },
  fusee: { libelle: '#Fusée', parents: ['vehicule', 'espace', 'sciences'], cartes: [['Ariane', 'fusée européenne'], ['Soyouz', 'lanceur spatial']] },
  tibet: { libelle: '#Tibet', parents: ['geographie'], cartes: [['Lhassa', 'capitale du Tibet'], ['Dalaï-lama', 'chef spirituel tibétain'], ['Himalaya', 'plateau du Tibet']] },
  ukraine: { libelle: '#Ukraine', parents: ['pays', 'geographie'], cartes: [['Kiev', 'capitale de l’Ukraine'], ['Kharkiv', 'ville ukrainienne'], ['Odessa', 'port de la mer Noire, Ukraine']] },
};

const EXISTANTS_FIGES = [
  'vehicule', 'automobile', 'voiture', 'moto', 'camion', 'bus', 'tracteur', 'train', 'avion', 'bateaux', 'course', 'formule1', 'nascar', 'rallye',
  'musique', 'rock', 'poprock', 'pop', 'metal', 'grunge', 'jazz', 'techno', 'rap', 'classique', 'histoire', 'guerre', 'nazis', 'politique', 'royaute',
  'sciences', 'espace', 'sante', 'technologie', 'informatique', 'jeuvideo', 'nature', 'animaux', 'plantes', 'gastronomie', 'geographie', 'pays', 'ville',
  'arts', 'architecture', 'cinema', 'television', 'litterature', 'bd', 'langue', 'idees', 'religion', 'sport', 'football', 'cyclisme', 'combat', 'societe', 'crime',
];

// Table id → libellé figée avant la feature (SC-002) : aucun renommage permis.
const ANCIENS_LIBELLES: Record<string, string> = {
  vehicule: '#Véhicule',
  automobile: '#Automobile',
  voiture: '#Voiture',
  moto: '#Moto',
  camion: '#Camion',
  bus: '#Bus',
  tracteur: '#Tracteur',
  train: '#Train',
  avion: '#Avion',
  bateaux: '#Bateaux',
  course: '#Course',
  formule1: '#Formule 1',
  nascar: '#Nascar',
  rallye: '#Rallye',
  musique: '#Musique',
  rock: '#Rock',
  poprock: '#Pop Rock',
  pop: '#Pop',
  metal: '#Métal',
  grunge: '#Grunge',
  jazz: '#Jazz',
  techno: '#Techno',
  rap: '#Rap',
  classique: '#Musique classique',
  histoire: '#Histoire',
  guerre: '#Guerre',
  nazis: '#Nazis',
  politique: '#Politique',
  royaute: '#Royauté',
  sciences: '#Sciences',
  espace: '#Espace',
  sante: '#Santé',
  technologie: '#Technologies',
  informatique: '#Informatique',
  jeuvideo: '#Jeu vidéo',
  nature: '#Nature',
  animaux: '#Animaux',
  plantes: '#Plantes',
  gastronomie: '#Gastronomie',
  geographie: '#Géographie',
  pays: '#Pays',
  ville: '#Ville',
  arts: '#Art',
  architecture: '#Architecture',
  cinema: '#Cinéma',
  television: '#Télévision',
  litterature: '#Littérature',
  bd: '#BD et Manga',
  langue: '#Langue',
  idees: '#Philosophie',
  religion: '#Religion',
  sport: '#Sport',
  football: '#Football',
  cyclisme: '#Cyclisme',
  combat: '#Arts martiaux',
  societe: '#Société',
  crime: '#Crime',
  autres: '#Autres',
};

const sansAccent = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

describe('taxonomie précise (SC-001 à SC-003)', () => {
  it('contient les 60 nouveaux identifiants avec libellés et parents (SC-001)', () => {
    expect(Object.keys(NOUVEAUX)).toHaveLength(60);
    for (const [id, attendu] of Object.entries(NOUVEAUX)) {
      const def = DEFINITIONS_THEMES.find((t) => t.id === id);
      expect(def, id).toBeDefined();
      expect(def?.libelle, id).toBe(attendu.libelle);
      expect([...(def?.parents ?? [])].sort(), id).toEqual([...attendu.parents].sort());
    }
  });

  it('a des parents existants, clos, sans cycle ni doublon', () => {
    const ids = DEFINITIONS_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of DEFINITIONS_THEMES) {
      for (const parent of def.parents ?? []) {
        const p = DEFINITIONS_THEMES.find((t) => t.id === parent);
        expect(p, `${def.id} → ${parent}`).toBeDefined();
        expect(parent).not.toBe(def.id);
        for (const ancetre of p?.parents ?? []) expect(def.parents, `${def.id} doit lister ${ancetre}`).toContain(ancetre);
        expect(p?.parents ?? [], `cycle ${def.id}/${parent}`).not.toContain(def.id);
      }
    }
  });

  it('trie IDS_THEMES par libellé, « autres » en dernier', () => {
    expect(IDS_THEMES[IDS_THEMES.length - 1]).toBe('autres');
    const libelles = IDS_THEMES.slice(0, -1).map((id) => LIBELLES_THEMES[id] ?? id);
    expect(libelles).toEqual([...libelles].sort((a, b) => a.localeCompare(b, 'fr')));
    expect(IDS_THEMES).toHaveLength(57 + 60 + 1);
  });

  it('fige les identifiants et libellés existants (SC-002)', () => {
    for (const id of EXISTANTS_FIGES) expect(LIBELLES_THEMES[id], id).toBeDefined();
    expect(LIBELLES_THEMES).toMatchObject(ANCIENS_LIBELLES);
    expect(Object.keys(ANCIENS_LIBELLES)).toHaveLength(57 + 1); // + autres
    expect(EXISTANTS_FIGES).toHaveLength(57);
  });

  it('a des libellés utilisables comme noms d’étiquette (SC-003)', () => {
    const vus = new Set<string>();
    for (const def of DEFINITIONS_THEMES) {
      expect(def.libelle.startsWith('#'), def.id).toBe(true);
      expect(def.libelle.length, def.id).toBeLessThanOrEqual(32);
      expect(def.libelle.startsWith('Statut · ') || def.libelle.startsWith('Ami · ') || def.libelle.startsWith('#À échanger')).toBe(false);
      const cle = sansAccent(def.libelle);
      expect(vus.has(cle), `doublon ${def.libelle}`).toBe(false);
      vus.add(cle);
    }
  });
});

describe('détection des thèmes précis (SC-004, SC-023)', () => {
  it.each(Object.entries(NOUVEAUX).flatMap(([id, d]) => d.cartes.map(([titre, description]) => [id, titre, description, d.parents] as const)))(
    '%s : « %s — %s »',
    (id, titre, description, parents) => {
      const trouves = themes(description, titre);
      expect(trouves).toContain(id);
      for (const parent of parents) expect(trouves).toContain(parent);
    },
  );

  it('donne chien, animaux et nature au berger allemand', () => {
    expect(themes('race de chien', 'Berger allemand')).toEqual(expect.arrayContaining(['chien', 'animaux', 'nature']));
  });
});

describe('faux positifs (SC-005, SC-023)', () => {
  it.each([
    ['Château fort', 'résidence seigneuriale', 'chat'],
    ['Chevalier', 'guerrier médiéval', 'cheval'],
    ['Pontife', 'chef religieux', 'pont'],
    ['Pontifical', 'relatif au pape', 'pont'],
    ['Tour de France', 'course cycliste', 'tour'],
    ['Golfe de Gascogne', 'mer', 'golf'],
    ['Match de barrage', 'rencontre de football', 'barrage'],
    ['Son œuvre phare', 'une réussite', 'phare'],
    ['Jaguar', 'constructeur automobile', 'felin'],
    ['Python', 'langage de programmation', 'serpent'],
    ['Dauphin de France', 'titre royal', 'cetace'],
    ['Vélodrome', 'enceinte sportive', 'velo'],
    ['Tibia', 'os de la jambe', 'tibet'],
    ['Ukulélé', 'instrument', 'ukraine'],
    ['Matchs de barrages', 'rencontres de promotion', 'barrage'],
    ['Les barrages de Ligue 1', 'rencontres de football', 'barrage'],
    ['Île-de-France', 'région parisienne', 'ile'],
  ])('« %s — %s » ne reçoit pas %s', (titre, description, interdit) => {
    expect(themes(description, titre)).not.toContain(interdit);
  });

  it('range « Chevalier » dans le Moyen Âge', () => {
    expect(themes('guerrier médiéval', 'Chevalier')).toContain('moyenage');
  });
});

describe('performance (SC-017)', () => {
  it('détecte les thèmes de 5 000 cartes en moins de 200 ms', () => {
    const cartes = Array.from({ length: 5000 }, (_, i) => ({
      titre: `Carte fictive ${i}`,
      description: i % 2 === 0 ? 'race de chien et fromage de montagne' : 'barrage hydroélectrique en Ukraine',
    }));
    expect(
      meilleureDuree(() => {
        for (const c of cartes) themesDeCarte(c);
      }),
    ).toBeLessThan(200);
  });
});

describe('non-régression (SC-006)', () => {
  it.each([
    ['homme d’État français', ['politique']],
    ['sixième planète du Système solaire', ['espace', 'sciences']],
    ['constructeur automobile allemand', ['automobile', 'vehicule']],
    ['groupe de heavy metal', ['metal', 'musique']],
    ['pilote de Formule 1', ['formule1', 'course', 'sport']],
  ])('« %s » garde ses thèmes d’avant', (description, avant) => {
    expect(themes(description)).toEqual(expect.arrayContaining(avant));
  });

  it('reste linéaire sur une description hostile de 120 000 caractères', () => {
    const carte = { titre: 'grand ', description: 'grand '.repeat(20000) + 'barrage-'.repeat(1000) };
    expect(meilleureDuree(() => void themesDeCarte(carte))).toBeLessThan(200);
  });
});
