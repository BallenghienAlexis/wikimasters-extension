// Déduit les thèmes d'une carte à partir de son titre et de sa description.
// Calcul local par mots-clés : aucun service externe, et le résultat n'est jamais stocké.
// Le libellé de chaque thème est l'étiquette à poser dans le jeu : c'est ici qu'on en ajoute.
import { normaliser, type Carte } from './collection';

export const THEME_AUTRES = 'autres';

interface DefinitionTheme {
  id: string;
  libelle: string;
  // Une espace finale vise le mot entier : « pop » ne doit pas trouver « population ».
  motifs: string[];
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

export function themesDeCarte(carte: Pick<Carte, 'titre' | 'description'>): string[] {
  const texte = `${normaliser(carte.titre)} ${normaliser(carte.description)} `.replaceAll('’', "'");
  const themes = new Set<string>();
  for (const { id, parents, motif } of REGLES) {
    if (!motif.test(texte)) continue;
    themes.add(id);
    for (const parent of parents) themes.add(parent);
  }
  return themes.size > 0 ? [...themes] : [THEME_AUTRES];
}

export function compterThemes(cartes: Carte[]): Record<string, number> {
  const compte: Record<string, number> = Object.fromEntries(IDS_THEMES.map((id) => [id, 0]));
  for (const carte of cartes) {
    for (const theme of themesDeCarte(carte)) compte[theme] = (compte[theme] ?? 0) + 1;
  }
  return compte;
}
