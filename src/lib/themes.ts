// Déduit les thèmes d'une carte à partir de son titre et de sa description.
// Calcul local par mots-clés, complété par les catégories Wikipédia mises en cache (voir wikipedia.ts) ; le résultat n'est jamais stocké.
// Le libellé de chaque thème est l'étiquette à poser dans le jeu : c'est ici qu'on en ajoute.
import { normaliser, type Carte } from './collection';

export const THEME_AUTRES = 'autres';

interface DefinitionTheme {
  id: string;
  libelle: string;
  // Une espace finale vise le mot entier : « pop » ne doit pas trouver « population ».
  // Les motifs précis peuvent aussi être de petites expressions : `(?![a-z0-9])` vise le mot entier,
  // `(?<!…)` exclut un contexte. Elles restent sans quantificateur imbriqué (calcul linéaire).
  motifs: string[];
  // Motifs en plus quand le texte est un nom de catégorie Wikipédia (court et classificatoire : « Barrage en France »).
  motifsCategories?: string[];
  // Une carte #Rock reçoit aussi #Musique.
  parents?: string[];
}

export const DEFINITIONS_THEMES: DefinitionTheme[] = [
  // Transports
  { id: 'vehicule', libelle: '#Véhicule', motifs: ['vehicule'] },
  { id: 'automobile', libelle: '#Automobile', motifs: ['automobile', 'constructeur auto', 'modele de voiture'], parents: ['vehicule'] },
  { id: 'voiture', libelle: '#Voiture', motifs: ['voiture', 'berline', 'cabriolet', 'roadster', 'monospace'], parents: ['automobile', 'vehicule'] },
  { id: 'moto', libelle: '#Moto', motifs: ['moto ', 'motos ', 'motocycl'], parents: ['vehicule'] },
  { id: 'camion', libelle: '#Camion', motifs: ['camion', 'poids lourd'], parents: ['vehicule'] },
  { id: 'bus', libelle: '#Bus', motifs: ['autobus', 'autocar', 'bus '], parents: ['vehicule'] },
  { id: 'tracteur', libelle: '#Tracteur', motifs: ['tracteur'], parents: ['vehicule'] },
  { id: 'train', libelle: '#Train', motifs: ['train ', 'trains ', 'locomotive', 'ferroviaire', 'tramway', 'metro '], parents: ['vehicule'] },
  { id: 'avion', libelle: '#Avion', motifs: ['avion', 'aeronef', 'aviation', 'compagnie aerienne', 'helicoptere'], parents: ['vehicule'] },
  { id: 'bateaux', libelle: '#Bateaux', motifs: ['bateau', 'navire', 'paquebot', 'voilier', 'sous-marin', 'porte-avions', 'croiseur '], parents: ['vehicule'] },
  { id: 'course', libelle: '#Course', motifs: ['course automobile', 'course de', 'pilote automobile', 'pilote de', 'grand prix', 'circuit automobile'], parents: ['sport'] },
  { id: 'formule1', libelle: '#Formule 1', motifs: ['formule 1', 'formula one'], parents: ['course', 'sport'] },
  { id: 'nascar', libelle: '#Nascar', motifs: ['nascar'], parents: ['course', 'sport'] },
  { id: 'rallye', libelle: '#Rallye', motifs: ['rallye'], parents: ['course', 'sport'] },

  // Musique
  { id: 'musique', libelle: '#Musique', motifs: ['musicien', 'musique', 'musical', 'chanteur', 'chanteuse', 'compositeur', 'compositrice', 'album', 'chanson', 'groupe de', 'rappeur', 'rappeuse', 'guitariste', 'batteur', 'pianiste', 'single '] },
  { id: 'rock', libelle: '#Rock', motifs: ['rock '], parents: ['musique'] },
  { id: 'poprock', libelle: '#Pop Rock', motifs: ['pop rock', 'pop-rock'], parents: ['pop', 'rock', 'musique'] },
  { id: 'pop', libelle: '#Pop', motifs: ['pop '], parents: ['musique'] },
  { id: 'metal', libelle: '#Métal', motifs: ['metal ', 'heavy metal', 'black metal', 'death metal'], parents: ['musique'] },
  { id: 'grunge', libelle: '#Grunge', motifs: ['grunge'], parents: ['rock', 'musique'] },
  { id: 'jazz', libelle: '#Jazz', motifs: ['jazz'], parents: ['musique'] },
  { id: 'techno', libelle: '#Techno', motifs: ['techno ', 'musique electronique'], parents: ['musique'] },
  { id: 'rap', libelle: '#Rap', motifs: ['rap ', 'rappeur', 'rappeuse', 'hip-hop', 'hip hop'], parents: ['musique'] },
  { id: 'classique', libelle: '#Musique classique', motifs: ['opera', 'symphonie', 'musique classique', 'chef d\'orchestre'], parents: ['musique'] },

  // Histoire et politique
  { id: 'histoire', libelle: '#Histoire', motifs: ['histoire', 'histori', 'antique', 'medieval', 'prehistor', 'siecle', 'dynastie', 'monument', 'cite inca', 'av. j.-c', 'passe du'] },
  { id: 'guerre', libelle: '#Guerre', motifs: ['guerre', 'bataille', 'militaire', 'armee', 'soldat', 'combat de'], parents: ['histoire'] },
  { id: 'nazis', libelle: '#Nazis', motifs: ['nazi', 'troisieme reich', 'fuhrer', 'hitler', 'petain'], parents: ['histoire', 'guerre'] },
  { id: 'politique', libelle: '#Politique', motifs: ["homme d'etat", "femme d'etat", 'politi', 'president', 'election', 'dictateur', 'chancelier', 'ministre', 'depute', 'senateur', 'parti '] },
  { id: 'royaute', libelle: '#Royauté', motifs: ['roi ', 'reine ', 'prince', 'empereur', 'imperatrice', 'duc ', 'duchesse', 'cour suedoise', 'cour de'], parents: ['histoire'] },

  // Sciences et techniques
  { id: 'sciences', libelle: '#Sciences', motifs: ['physicien', 'physique', 'chimi', 'mathemati', 'biolog', 'scientifique', 'chercheur', 'chercheuse', 'molecule', 'atome', 'spectro', 'theoreme', 'adn', 'geolog', 'roche', 'mineral', 'element chimique'] },
  { id: 'espace', libelle: '#Espace', motifs: ['planete', 'etoile', 'asteroide', 'galaxie', 'astronom', 'constellation', 'comete', 'systeme solaire', 'cratere', 'nebuleuse'], parents: ['sciences'] },
  { id: 'sante', libelle: '#Santé', motifs: ['medecin', 'maladie', 'trouble', 'psychiatr', 'pedopsychiatr', 'chirurgien', 'syndrome', 'medicament', 'virus'], parents: ['sciences'] },
  { id: 'technologie', libelle: '#Technologies', motifs: ['ingenieur', 'inventeur', 'technologie', 'technique'] },
  { id: 'informatique', libelle: '#Informatique', motifs: ['informatique', 'logiciel', 'open source', 'site web', 'internet', 'programm', 'domaine de premier niveau', 'ordinateur', 'microblogage', 'reseau social', 'systeme d\'exploitation'], parents: ['technologie'] },
  { id: 'jeuvideo', libelle: '#Jeu vidéo', motifs: ['jeu video', 'jeux video', 'console de jeu'], parents: ['informatique', 'technologie'] },

  // Nature et cuisine
  { id: 'nature', libelle: '#Nature', motifs: ['espece', 'genre de'] },
  { id: 'animaux', libelle: '#Animaux', motifs: ['animal', 'animaux', 'mammifere', 'oiseau', 'insecte', 'poisson', 'reptile', 'amphibien', 'felide', 'canide', 'strigide', 'octopode', 'dinosaure', 'araignee', 'papillon'], parents: ['nature'] },
  { id: 'plantes', libelle: '#Plantes', motifs: ['plante', 'arbre', 'fleur', 'champignon', 'graminee'], parents: ['nature'] },
  { id: 'gastronomie', libelle: '#Gastronomie', motifs: ['agrume', 'fruit', 'legume', 'cereale', 'plat ', 'cuisine', 'boisson', 'fromage', 'vin ', 'patisserie', 'epice', 'lait '] },

  // Lieux
  { id: 'geographie', libelle: '#Géographie', motifs: ['region', 'fleuve', 'riviere', 'montagne', 'volcan', 'ile ', 'lac ', 'departement', 'province', 'territoire', 'detroit', 'mer ', 'ocean', 'desert', 'etat des', 'etat federe'] },
  { id: 'pays', libelle: '#Pays', motifs: ['pays', 'etat souverain', 'capitale'], parents: ['geographie'] },
  { id: 'ville', libelle: '#Ville', motifs: ['ville', 'commune', 'localite', 'village', 'quartier'], parents: ['geographie'] },

  // Culture
  { id: 'arts', libelle: '#Art', motifs: ['peintre', 'sculpt', 'artiste', 'art ', 'musee', 'tableau', 'photograph', 'dessinat'] },
  { id: 'architecture', libelle: '#Architecture', motifs: ['architect', 'cathedrale', 'chateau', 'pont ', 'gratte-ciel', 'batiment'], parents: ['arts'] },
  { id: 'cinema', libelle: '#Cinéma', motifs: ['film', 'acteur', 'actrice', 'realisat', 'cineaste', 'comedien', 'comedienne', 'humoriste'] },
  { id: 'television', libelle: '#Télévision', motifs: ['serie televisee', 'television', 'animateur', 'animatrice', 'emission'], parents: ['cinema'] },
  { id: 'litterature', libelle: '#Littérature', motifs: ['ecrivain', 'roman', 'auteur', 'autrice', 'poete', 'poetesse', 'livre', 'theatre', 'dramaturge'] },
  { id: 'bd', libelle: '#BD et Manga', motifs: ['bande dessinee', 'manga', 'anime ', 'comics', 'one piece'], parents: ['litterature'] },
  { id: 'langue', libelle: '#Langue', motifs: ['langue', 'linguist', 'terme ', 'mot '] },
  { id: 'idees', libelle: '#Philosophie', motifs: ['philosoph', 'theolog', 'orthodoxe'] },
  { id: 'religion', libelle: '#Religion', motifs: ['religi', 'dieu', 'deesse', 'saint', 'pape', 'eglise', 'mytholog'] },

  // Sport et société
  { id: 'sport', libelle: '#Sport', motifs: ['athlete', 'sportif', 'sportive', 'joueur de', 'joueuse de', 'championnat', 'tournoi', 'olympique', 'coureur', 'coureuse', 'rugby', 'tennis', 'basket'] },
  { id: 'football', libelle: '#Football', motifs: ['football', 'club de foot'], parents: ['sport'] },
  { id: 'cyclisme', libelle: '#Cyclisme', motifs: ['cyclis'], parents: ['sport'] },
  { id: 'combat', libelle: '#Arts martiaux', motifs: ['arts martiaux', 'boxeur', 'boxeuse', 'catcheur', 'judoka', 'karate'], parents: ['sport'] },
  { id: 'societe', libelle: '#Société', motifs: ['sociolog', "homme d'affaires", "femme d'affaires", 'entreprise', 'econom', 'droit', 'adulter', 'habitants'] },
  { id: 'crime', libelle: '#Crime', motifs: ['tueur', 'criminel', 'cartel', 'assassin', 'torture', 'mafia', 'gang '], parents: ['societe'] },

  // Thèmes précis (feature theme-etiquettes). Une lookahead `(?![a-z0-9])` vise le mot entier.
  // Animaux
  { id: 'chien', libelle: '#Chien', motifs: ['chiens?(?![a-z0-9])', 'chienne', 'canis lupus familiaris'], parents: ['animaux', 'nature'] },
  { id: 'chat', libelle: '#Chat', motifs: ['chats?(?![a-z0-9])', 'chaton', 'felis catus'], parents: ['animaux', 'nature'] },
  { id: 'cheval', libelle: '#Cheval', motifs: ['cheval(?![a-z0-9])', 'chevaux', 'equide', 'jument', 'poney'], parents: ['animaux', 'nature'] },
  { id: 'felin', libelle: '#Félin', motifs: ['lions?(?![a-z0-9])', 'lionne', 'tigre', 'guepard', 'leopard', 'panthere', 'felide'], parents: ['animaux', 'nature'] },
  { id: 'ours', libelle: '#Ours', motifs: ['ours(?![a-z0-9])', 'ourse(?![a-z0-9])'], parents: ['animaux', 'nature'] },
  { id: 'singe', libelle: '#Singe', motifs: ['singes?(?![a-z0-9])', 'primate', 'gorille', 'chimpanze', 'orang-outan'], parents: ['animaux', 'nature'] },
  { id: 'cetace', libelle: '#Cétacé', motifs: ['cetace', 'baleine', 'orque', 'cachalot', 'marsouin'], parents: ['animaux', 'nature'] },
  { id: 'requin', libelle: '#Requin', motifs: ['requin'], parents: ['animaux', 'nature'] },
  { id: 'serpent', libelle: '#Serpent', motifs: ['serpent', 'vipere', 'cobra', 'boa(?![a-z0-9])'], parents: ['animaux', 'nature'] },
  { id: 'rapace', libelle: '#Rapace', motifs: ['rapace', 'aigle', 'faucon', 'hibou', 'chouette', 'vautour', 'strigide'], parents: ['animaux', 'nature'] },
  { id: 'dinosaure', libelle: '#Dinosaure', motifs: ['dinosaure', 'theropode', 'sauropode'], parents: ['animaux', 'nature'] },
  { id: 'insecte', libelle: '#Insecte', motifs: ['insecte', 'coleoptere', 'fourmis?(?![a-z0-9])', 'abeille', 'guepe'], parents: ['animaux', 'nature'] },
  { id: 'papillon', libelle: '#Papillon', motifs: ['papillon', 'lepidoptere'], parents: ['animaux', 'nature'] },
  { id: 'araignee', libelle: '#Araignée', motifs: ['araignee', 'arachnide'], parents: ['animaux', 'nature'] },

  // Architecture
  { id: 'pont', libelle: '#Pont', motifs: ['ponts?(?![a-z0-9])', 'viaduc', 'passerelle'], parents: ['architecture', 'arts'] },
  { id: 'tunnel', libelle: '#Tunnel', motifs: ['tunnel'], parents: ['architecture', 'arts'] },
  { id: 'tour', libelle: '#Tour', motifs: ['tour eiffel', 'tour de guet', 'donjon', 'beffroi', 'minaret', 'campanile'], parents: ['architecture', 'arts'] },
  { id: 'chateau', libelle: '#Château', motifs: ['chateau', 'forteresse', 'citadelle'], parents: ['architecture', 'arts'] },
  { id: 'cathedrale', libelle: '#Cathédrale', motifs: ['cathedrale', 'basilique', 'abbaye'], parents: ['architecture', 'arts'] },
  { id: 'phare', libelle: '#Phare', motifs: ['phare de ', 'phare du ', "phare d'", 'phares(?![a-z0-9])', 'gardien de phare'], parents: ['architecture', 'arts'] },
  { id: 'barrage', libelle: '#Barrage', motifsCategories: ['(?<!match(?:s)? de )(?<!play-offs? de )barrage(?![a-z0-9])'], motifs: ['barrage hydroelectrique', 'barrages hydroelectriques', 'barrage-voute', 'barrage-poids', 'grands? barrages?', "retenue d'eau", '(?<!match(?:s)? de )barrages(?![a-z0-9])(?! de (?:ligue|promotion|relegation))'], parents: ['architecture', 'arts'] },
  { id: 'gratteciel', libelle: '#Gratte-ciel', motifs: ['gratte-ciel'], parents: ['architecture', 'arts'] },

  // Géographie
  { id: 'tibet', libelle: '#Tibet', motifs: ['tibet', 'lhassa', 'dalai'], parents: ['geographie'] },
  { id: 'ukraine', libelle: '#Ukraine', motifs: ['ukrain', 'kiev(?![a-z0-9])', 'kyiv', 'kharkiv', 'odessa', 'donbass'], parents: ['pays', 'geographie'] },
  { id: 'montagne', libelle: '#Montagne', motifs: ['montagne', 'massifs?(?![a-z0-9])', 'monts?(?![a-z0-9])'], parents: ['geographie'] },
  { id: 'volcan', libelle: '#Volcan', motifs: ['volcan'], parents: ['geographie'] },
  { id: 'ile', libelle: '#Île', motifs: ['iles?(?![a-z0-9-])', 'archipel', 'atoll'], parents: ['geographie'] },
  { id: 'fleuve', libelle: '#Fleuve', motifs: ['fleuve', 'riviere', 'affluent'], parents: ['geographie'] },
  { id: 'lac', libelle: '#Lac', motifs: ['lacs?(?![a-z0-9])'], parents: ['geographie'] },
  { id: 'desert', libelle: '#Désert', motifs: ['deserts?(?![a-z0-9])', 'desertique'], parents: ['geographie'] },
  { id: 'ocean', libelle: '#Océan', motifs: ['ocean', 'mers?(?![a-z0-9])'], parents: ['geographie'] },

  // Espace
  { id: 'planete', libelle: '#Planète', motifs: ['planete', 'exoplanete'], parents: ['espace', 'sciences'] },
  { id: 'etoile', libelle: '#Étoile', motifs: ['etoiles?(?![a-z0-9])', 'supernova', 'naine blanche'], parents: ['espace', 'sciences'] },
  { id: 'galaxie', libelle: '#Galaxie', motifs: ['galaxie'], parents: ['espace', 'sciences'] },
  { id: 'comete', libelle: '#Comète', motifs: ['comete', 'asteroide'], parents: ['espace', 'sciences'] },
  { id: 'fusee', libelle: '#Fusée', motifs: ['fusee', 'lanceur spatial'], parents: ['vehicule', 'espace', 'sciences'] },

  // Plantes et gastronomie
  { id: 'arbre', libelle: '#Arbre', motifs: ['arbre', 'conifere'], parents: ['plantes', 'nature'] },
  { id: 'fleur', libelle: '#Fleur', motifs: ['fleurs?(?![a-z0-9])', 'orchidee'], parents: ['plantes', 'nature'] },
  { id: 'champignon', libelle: '#Champignon', motifs: ['champignon'], parents: ['plantes', 'nature'] },
  { id: 'fromage', libelle: '#Fromage', motifs: ['fromage'], parents: ['gastronomie'] },
  { id: 'vin', libelle: '#Vin', motifs: ['vins?(?![a-z0-9])', 'vignoble', 'cepage'], parents: ['gastronomie'] },
  { id: 'biere', libelle: '#Bière', motifs: ['biere'], parents: ['gastronomie'] },
  { id: 'fruit', libelle: '#Fruit', motifs: ['fruit', 'agrume'], parents: ['gastronomie'] },
  { id: 'dessert', libelle: '#Dessert', motifs: ['dessert', 'patisserie', 'gateau'], parents: ['gastronomie'] },

  // Sport
  { id: 'tennis', libelle: '#Tennis', motifs: ['tennis'], parents: ['sport'] },
  { id: 'rugby', libelle: '#Rugby', motifs: ['rugby'], parents: ['sport'] },
  { id: 'basketball', libelle: '#Basketball', motifs: ['basket'], parents: ['sport'] },
  { id: 'ski', libelle: '#Ski', motifs: ['skis?(?![a-z0-9])', 'skieur', 'skieuse'], parents: ['sport'] },
  { id: 'golf', libelle: '#Golf', motifs: ['golf(?![a-z0-9])', 'golfeur', 'golfeuse'], parents: ['sport'] },
  { id: 'natation', libelle: '#Natation', motifs: ['natation', 'nageur', 'nageuse'], parents: ['sport'] },
  { id: 'velo', libelle: '#Vélo', motifs: ['velos?(?![a-z0-9])', 'bicyclette'], parents: ['vehicule'] },

  // Histoire, religion, bande dessinée
  { id: 'egypteantique', libelle: '#Égypte antique', motifs: ['pharaon', 'egypte antique', 'ancienne egypte'], parents: ['histoire'] },
  { id: 'romeantique', libelle: '#Rome antique', motifs: ['rome antique', 'empire romain', 'empereur romain', 'legion romaine'], parents: ['histoire'] },
  { id: 'greceantique', libelle: '#Grèce antique', motifs: ['grece antique', 'antiquite grecque', 'cite grecque'], parents: ['histoire'] },
  { id: 'moyenage', libelle: '#Moyen Âge', motifs: ['moyen age', 'medieval', 'chevalier'], parents: ['histoire'] },
  { id: 'prehistoire', libelle: '#Préhistoire', motifs: ['prehistor', 'neolithique', 'paleolithique'], parents: ['histoire'] },
  { id: 'premiereguerre', libelle: '#Première Guerre mondiale', motifs: ['premiere guerre mondiale', 'grande guerre'], parents: ['guerre', 'histoire'] },
  { id: 'secondeguerre', libelle: '#Seconde Guerre mondiale', motifs: ['seconde guerre mondiale', 'deuxieme guerre mondiale'], parents: ['guerre', 'histoire'] },
  { id: 'mythologie', libelle: '#Mythologie', motifs: ['mytholog', 'divinite'], parents: ['religion'] },
  { id: 'superheros', libelle: '#Super-héros', motifs: ['super-heros', 'super heros', 'super-heroine'], parents: ['bd', 'litterature'] },
];

export const LIBELLES_THEMES: Record<string, string> = {
  ...Object.fromEntries(DEFINITIONS_THEMES.map((t) => [t.id, t.libelle])),
  [THEME_AUTRES]: '#Autres',
};

const parLibelle = (a: string, b: string): number => (LIBELLES_THEMES[a] ?? a).localeCompare(LIBELLES_THEMES[b] ?? b, 'fr');

export const IDS_THEMES: string[] = [...DEFINITIONS_THEMES.map((t) => t.id).sort(parLibelle), THEME_AUTRES];

// Un motif doit commencer un mot : « art » ne doit pas trouver « partie ».
const REGLES = DEFINITIONS_THEMES.map(({ id, motifs, parents = [] }) => ({
  id,
  parents,
  motif: new RegExp(`(^|[^a-z0-9])(${motifs.join('|')})`),
}));

const REGLES_CATEGORIES = DEFINITIONS_THEMES.map(({ id, motifs, motifsCategories = [], parents = [] }) => ({
  id,
  parents,
  motif: new RegExp(`(^|[^a-z0-9])(${[...motifs, ...motifsCategories].join('|')})`),
}));

/** Thèmes (parents compris) trouvés dans un texte libre ; liste vide s'il n'y en a aucun. */
export function themesDeTexte(texte: string, categories = false): string[] {
  const normalise = `${normaliser(texte)} `.replaceAll('’', "'");
  const themes = new Set<string>();
  for (const { id, parents, motif } of categories ? REGLES_CATEGORIES : REGLES) {
    if (!motif.test(normalise)) continue;
    themes.add(id);
    for (const parent of parents) themes.add(parent);
  }
  return [...themes];
}

// Thèmes vérifiés sur Wikipédia (titre de carte → identifiants de thèmes), chargés depuis le cache local.
// Surcouche en mémoire : elle s'ajoute aux mots-clés, ne remplace rien et n'est jamais écrite ici.
let themesWikipedia: ReadonlyMap<string, readonly string[]> = new Map();

export function definirThemesWikipedia(themes: ReadonlyMap<string, readonly string[]>): void {
  themesWikipedia = themes;
}

export function themesDeCarte(carte: Pick<Carte, 'titre' | 'description'>): string[] {
  const themes = new Set(themesDeTexte(`${carte.titre} ${carte.description}`));
  for (const id of themesWikipedia.get(carte.titre) ?? []) themes.add(id);
  return themes.size > 0 ? [...themes] : [THEME_AUTRES];
}

export function compterThemes(cartes: Carte[]): Record<string, number> {
  const compte: Record<string, number> = Object.fromEntries(IDS_THEMES.map((id) => [id, 0]));
  for (const carte of cartes) {
    for (const theme of themesDeCarte(carte)) compte[theme] = (compte[theme] ?? 0) + 1;
  }
  return compte;
}
