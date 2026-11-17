// Déduit les thèmes d'une carte à partir de son titre et de sa description.
// Calcul local par mots-clés, complété par les catégories Wikipédia mises en cache (voir wikipedia.ts) ; le résultat n'est jamais stocké.
// Le libellé de chaque thème est l'étiquette à poser dans le jeu : c'est ici qu'on en ajoute.
import { normaliser, type Carte } from './collection';
import { definition, genreDe, type Genre } from './sens';

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
  { id: 'tracteur', libelle: '#Tracteur', motifs: ['tracteurs?(?! de semi)(?! semi)(?!s? routiers?)'], parents: ['vehicule'] },
  { id: 'train', libelle: '#Train', motifs: ['train ', 'trains ', 'chemin de fer', 'locomotive', 'ferroviaire', 'tramway', 'metro '], parents: ['vehicule'] },
  { id: 'avion', libelle: '#Avion', motifs: ['avion', 'aeronef', 'aviation', 'compagnie aerienne', 'helicoptere', 'accident aerien', 'aeroport', 'aerodrome'], parents: ['vehicule'] },
  { id: 'bateaux', libelle: '#Bateaux', motifs: ['bateau', 'navire', 'paquebot', 'voilier', 'sous-marin', 'porte-avions', 'croiseur ', 'torpilleur'], parents: ['vehicule'] },
  { id: 'course', libelle: '#Course', motifs: ['course automobile', 'course de', 'pilote automobile', 'pilote de', 'grand prix', 'circuit automobile'], parents: ['sport'] },
  { id: 'formule1', libelle: '#Formule 1', motifs: ['formule 1', 'formula one'], parents: ['course', 'sport'] },
  { id: 'nascar', libelle: '#Nascar', motifs: ['nascar'], parents: ['course', 'sport'] },
  { id: 'rallye', libelle: '#Rallye', motifs: ['rallye'], parents: ['course', 'sport'] },

  // Musique
  { id: 'musique', libelle: '#Musique', motifs: ['musicien', 'musique', 'musical', 'chanteur', 'chanteuse', 'compositeur', 'compositrice', 'album', 'chanson', 'groupe de', 'rappeur', 'rappeuse', 'guitariste', 'batteur', 'pianiste', 'single ', 'compilation de', 'label discographique', 'troubadour'] },
  { id: 'rock', libelle: '#Rock', motifs: ['rock '], parents: ['musique'] },
  { id: 'poprock', libelle: '#Pop Rock', motifs: ['pop rock', 'pop-rock'], parents: ['pop', 'rock', 'musique'] },
  { id: 'pop', libelle: '#Pop', motifs: ['pop '], parents: ['musique'] },
  { id: 'metal', libelle: '#Métal', motifs: ['metal ', 'heavy metal', 'black metal', 'death metal'], parents: ['musique'] },
  { id: 'metalcore', libelle: '#Metalcore', motifs: ['metal-?core'], parents: ['metal', 'musique'] },
  { id: 'grunge', libelle: '#Grunge', motifs: ['grunge'], parents: ['rock', 'musique'] },
  { id: 'jazz', libelle: '#Jazz', motifs: ['jazz'], parents: ['musique'] },
  { id: 'techno', libelle: '#Techno', motifs: ['techno ', 'musique electronique'], parents: ['musique'] },
  { id: 'rap', libelle: '#Rap', motifs: ['rap ', 'rappeur', 'rappeuse', 'hip-hop', 'hip hop'], parents: ['musique'] },
  { id: 'classique', libelle: '#Musique classique', motifs: ['opera', 'symphonie', 'musique classique', 'chef d\'orchestre'], parents: ['musique'] },

  // Histoire et politique
  { id: 'histoire', libelle: '#Histoire', motifs: ['histoire', 'histori', 'antique', 'medieval', 'prehistor', 'siecle', 'dynastie', 'monument', 'cite inca', 'av. j.-c', 'passe du', 'chronologie', 'mois de [0-9]{4}', 'evenements lies'] },
  { id: 'guerre', libelle: '#Guerre', motifs: ['guerre', 'bataille', 'militaire', 'armee', 'soldat', 'combat de', 'contre-torpilleur', 'officier superieur'], parents: ['histoire'] },
  { id: 'nazis', libelle: '#Nazis', motifs: ['nazi', 'troisieme reich', 'fuhrer', 'hitler', 'petain'], parents: ['histoire', 'guerre'] },
  { id: 'politique', libelle: '#Politique', motifs: ["homme d'etat", "femme d'etat", 'politi', 'president', 'election', 'dictateur', 'chancelier', 'ministre', 'depute', 'senateur', 'parti ', 'circonscriptions? (?:electorales?|legislatives?|provinciales?|federales?)', 'relations diplomatiques', 'administrateur colonial'] },
  { id: 'royaute', libelle: '#Royauté', motifs: ['roi ', 'reine ', 'prince', 'empereur', 'imperatrice', 'duc ', 'duchesse', 'cour suedoise', 'cour de', 'pairs? anglais', 'pairs? anglo-irlandais', 'noblesse', 'noble allemande'], parents: ['histoire'] },

  // Sciences et techniques
  { id: 'sciences', libelle: '#Sciences', motifs: ['physicien', 'physique', 'chimi', 'mathemati', 'biolog', 'scientifique', 'chercheur', 'chercheuse', 'molecule', 'atome', 'spectro', 'theoreme', 'adn', 'geolog', 'roche', 'mineral', 'element chimique', 'entomolog', 'arachnolog', 'botanist', 'zoolog', 'ornitholog', 'mycolog', 'paleontolog', 'naturaliste', 'astronome'] },
  { id: 'physique', libelle: '#Physique', motifs: ['physicien', '(?<!activite )(?<!education )(?<!condition )(?<!apparence )(?<!handicap )(?<!personne )(?<!personnes )(?<!force )(?<!forme )(?<!exercice )(?<!violence )(?<!preparation )physique', 'unites? de planck', 'constantes? fondamentales?'], parents: ['sciences'] },
  { id: 'espace', libelle: '#Espace', motifs: ['planete', 'etoile', 'asteroide', 'galaxie', 'astronom', 'constellation', 'comete', 'systeme solaire', 'cratere', 'nebuleuse'], parents: ['sciences'] },
  { id: 'sante', libelle: '#Santé', motifs: ['medecin', 'maladie', 'trouble', 'psychiatr', 'pedopsychiatr', 'chirurgien', 'syndrome', 'medicament', 'virus'], parents: ['sciences'] },
  { id: 'technologie', libelle: '#Technologies', motifs: ['ingenieur', 'inventeur', 'technologie', 'technique'] },
  { id: 'informatique', libelle: '#Informatique', motifs: ['informatique', 'logiciel', 'open source', 'site web', 'internet', 'programm', 'domaine de premier niveau', 'ordinateur', 'microblogage', 'reseau social', 'systeme d\'exploitation', 'protocole reseau', 'framework'], parents: ['technologie'] },
  { id: 'jeuvideo', libelle: '#Jeu vidéo', motifs: ['jeu video', 'jeux video', 'console de jeu'], parents: ['informatique', 'technologie'] },

  // Nature et cuisine
  { id: 'nature', libelle: '#Nature', motifs: ['espece', 'genre de', 'parc national', 'reserve naturelle', 'espace naturel', 'grottes?', 'ilots? '] },
  { id: 'animaux', libelle: '#Animaux', motifs: ['animal', 'animaux', 'mammifere', 'oiseau', 'insecte', 'poisson', 'reptile', 'amphibien', 'felide', 'canide', 'strigide', 'octopode', 'dinosaure', 'araignee', 'papillon'], parents: ['nature'] },
  { id: 'plantes', libelle: '#Plantes', motifs: ['plante', 'arbre', 'fleur', 'champignon', 'graminee', 'tribu d[eu] [a-z]+aceae', 'algues?'], parents: ['nature'] },
  { id: 'gastronomie', libelle: '#Gastronomie', motifs: ['agrume', 'fruit', 'legume', 'cereale', 'plat ', 'cuisine', 'culinaire', 'charcuterie', 'boisson', 'fromage', 'vin ', 'patisserie', 'epice', 'lait '] },

  // Lieux
  { id: 'geographie', libelle: '#Géographie', motifs: ['region', 'fleuve', 'riviere', 'montagne', 'volcan', 'ile ', 'lac ', 'departement', 'province', 'territoire', 'detroit', 'mer ', 'ocean', 'desert', 'etat des', 'etat federe', 'districts? (?:de |du |administratif)', 'comtes? des etats-unis', 'comtes? d[eu][^.;(),]{0,40}(?:, dans l\'etat d[^,]{1,30})?, (?:aux |des )?(?:usa|etats-unis)', 'intercommunalite', 'canton ', 'sous-prefecture'] },
  { id: 'pays', libelle: '#Pays', motifs: ['pays', 'etat souverain', 'capitale'], parents: ['geographie'] },
  { id: 'ville', libelle: '#Ville', motifs: ['ville', 'commune', 'localite', 'village', 'quartier', 'etablissement humain', 'census-designated place', 'unite urbaine', 'raion municipal', 'town d[eu] ', 'bourg ', 'freguesia', 'municipalite', 'gmina', 'hameau', 'voies? d(?:e |u |\')(?!fait|communication|droit|garage|acces|recours|circulation)', 'rues? (?:a |de |du |des |d\')', 'avenues? (?:de |du |des |d\')'], parents: ['geographie'] },

  // Culture
  { id: 'arts', libelle: '#Art', motifs: ['peintre', 'sculpt', 'artiste', 'art ', 'musee', 'tableau', 'photograph', 'dessinat', 'peinture d', 'peinture murale'] },
  { id: 'architecture', libelle: '#Architecture', motifs: ['architect', 'cathedrale', 'chateau', 'pont ', 'gratte-ciel', 'batiment', 'manoir (?:d[eu] |du |a |en |situe)', 'hotel particulier', 'chapelle (?:d[eu] |du |situee|catholique|romane|gothique|a |en )', 'immeuble a '], parents: ['arts'] },
  { id: 'cinema', libelle: '#Cinéma', motifs: ['film', 'acteur', 'actrice', 'realisat', 'cineaste', 'comedien', 'comedienne', 'humoriste'] },
  { id: 'television', libelle: '#Télévision', motifs: ['serie televisee', 'television', 'animateur', 'animatrice', 'emission', 'episodes? (?:de|du|des) (?!la guerre|l\'histoire|la revolution|la bataille|la campagne)'], parents: ['cinema'] },
  { id: 'litterature', libelle: '#Littérature', motifs: ['ecrivain', 'roman', 'auteur', 'autrice', 'poete', 'poetesse', 'livre', 'theatre', 'dramaturge', 'maison d\'edition', 'revue litteraire'] },
  { id: 'bd', libelle: '#BD et Manga', motifs: ['bande dessinee', 'manga', 'anime ', 'comics', 'one piece'], parents: ['litterature'] },
  { id: 'langue', libelle: '#Langue', motifs: ['langue', 'linguist', 'terme ', 'mot ', 'consonne', 'voyelle', 'alphabet', 'dialecte'] },
  { id: 'idees', libelle: '#Philosophie', motifs: ['philosoph', 'theolog', 'orthodoxe'] },
  { id: 'religion', libelle: '#Religion', motifs: ['religi', 'dieu', 'deesse', 'saint', 'pape', 'eglise', 'mytholog', 'prelat', 'eparchie', 'diocese', 'abbaye', 'monastere', 'eveque', 'vicaire', 'anglican', 'catholique', 'clerge'] },

  // Sport et société
  { id: 'sport', libelle: '#Sport', motifs: ['athlete', 'sportif', '(?<!motos? )(?<!voitures? )(?<!automobiles? )sportives?', 'joueur de', 'joueuse de', 'championnat', 'tournoi', 'olympique', 'coureur', 'coureuse', 'rugby', 'tennis', 'basket', 'joueu(?:r|se) (?:[a-z-]+ )?(?:de |d\')?(?:baseball|squash|badminton|volley|handball|cricket|polo|curling|hockey)', 'rameu(?:r|se)', 'compet[a-z]* de patinage', 'etapes? du tour d[eu]', 'saisons? [0-9]{4}-[0-9]{4} d', 'patineu(?:r|se)', 'fondeu(?:r|se)', 'skieu(?:r|se)', 'nageu(?:r|se)', 'gymnaste', 'tir a l\'arc', 'handballeu(?:r|se)', 'lutte professionnelle', 'competition de [a-z-]+ball', 'haltero', 'escrimeu(?:r|se)'] },
  { id: 'football', libelle: '#Football', motifs: ['football', 'club de foot'], parents: ['sport'] },
  { id: 'hockey', libelle: '#Hockey', motifs: ['hockey'], parents: ['sport'] },
  { id: 'cyclisme', libelle: '#Cyclisme', motifs: ['cyclis', 'tour de france (?:cycliste|[0-9]{4})', 'tour d\'italie [0-9]{4}', 'tour d\'espagne [0-9]{4}'], parents: ['sport'] },
  { id: 'combat', libelle: '#Arts martiaux', motifs: ['arts martiaux', 'boxeur', 'boxeuse', 'catcheur', 'judoka', 'karate'], parents: ['sport'] },
  { id: 'societe', libelle: '#Société', motifs: ['sociolog', "homme d'affaires", "femme d'affaires", 'entreprise', 'econom', 'droit', 'adulter', 'habitants', 'journaliste'] },
  { id: 'crime', libelle: '#Crime', motifs: ['tueur', 'criminel', 'cartel', 'assassin', 'torture', 'mafia', 'gang ', 'meurtres?(?![a-z0-9])', 'meurtrier ou meurtriere', 'condamnee? pour crime'], parents: ['societe'] },

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

  // Sexualité et adulte
  { id: 'sexualite', libelle: '#Sexualité', motifs: ['sexuel', 'sexualite', 'erotis', 'erotique', 'prostitu', 'libertin', 'fetichis', 'fetish', 'kamasutra', 'sexe(?![a-z0-9])'], parents: ['societe'] },
  { id: 'pornographie', libelle: '#Pornographie', motifs: ['pornograph', 'porno(?![a-z0-9])', 'film x(?![a-z0-9])', 'film pour adultes', 'actrice x(?![a-z0-9])'], parents: ['sexualite', 'societe'] },

  // Autres domaines
  { id: 'drogue', libelle: '#Drogue', motifs: ['drogue', 'stupefiant', 'cannabis', 'cocaine', "trafic d'heroine", 'heroine pure', 'heroine de synthese', 'heroinoman', 'opioide', 'opiace', 'opium', 'amphetamine', 'narcotique', 'narcotrafic', 'tabac(?![a-z0-9])', 'cigarette'], parents: ['societe'] },
  { id: 'jeux', libelle: '#Jeux', motifs: ['jeu de societe', 'jeux de societe', 'jeu de cartes', 'jeu de role', 'echecs', 'poker', '(?<!groupe )casino(?![a-z0-9])(?! de paris)', 'jouet', 'puzzle', 'jeu de plateau'] },
  { id: 'mode', libelle: '#Mode', motifs: ['couturier', 'couturiere', 'haute couture', 'defile de mode', 'mannequin', 'styliste', 'vetement', 'maison de couture', 'maison de mode', 'creation de mode', 'magazine de mode'] },
  { id: 'danse', libelle: '#Danse', motifs: ['danse', 'danseu', 'choregraph', 'ballet'], parents: ['arts'] },
  { id: 'armes', libelle: '#Armes', motifs: ['(?<!beton )(?<!conflit )(?<!groupe )(?<!force )(?<!forces )(?<!lutte )arme(?![a-z0-9])', 'armes(?![a-z0-9])', 'fusil', 'pistolet', 'epee(?![a-z0-9])', 'missile', 'arme a feu', 'munition'] },
  { id: 'ecologie', libelle: '#Écologie', motifs: ['ecolog', 'climat', "protection de l'environnement", 'pollution', 'biodiversite', 'developpement durable', 'rechauffement'] },
  { id: 'finance', libelle: '#Finance', motifs: ['banque', 'bourse(?![a-z0-9])', 'monnaie', 'cryptomonnaie', 'finance', 'financier', 'investisseur', 'boursier'], parents: ['societe'] },
  { id: 'education', libelle: '#Éducation', motifs: ['education', 'pedagog', 'universite', 'lycee'], parents: ['societe'] },

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
  { id: 'vin', libelle: '#Vin', motifs: ['vins?(?![a-z0-9])', 'vignoble', 'cepage'], parents: ['alcool', 'gastronomie'] },
  { id: 'biere', libelle: '#Bière', motifs: ['biere'], parents: ['alcool', 'gastronomie'] },
  { id: 'alcool', libelle: '#Alcool', motifs: ['alcool', 'alcoolis', 'liqueur', 'cocktail', 'whisky', 'whiskey', 'vodka', 'rhum', 'gin(?![a-z0-9])', 'tequila', 'cognac', 'armagnac', 'spiritueux', 'eau-de-vie', '(?<!en )(?<!de )(?<!la )(?<!-)champagne(?![a-z0-9-])', 'coupe de champagne', 'aperitif', '(?<!appareil )(?<!systeme )(?<!tube )(?<!trouble )(?<!canal )digestifs?(?![a-z0-9])', 'absinthe', 'distillerie'], parents: ['gastronomie'] },
  { id: 'boisson', libelle: '#Boissons', motifs: ['boisson', 'soda', 'limonade', 'jus de', 'cafe(?![a-z0-9])(?! de | parisien)', 'the (?:vert|noir|blanc|glace)', 'infusion', 'eau minerale'], parents: ['gastronomie'] },
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
  global: new RegExp(`(^|[^a-z0-9])(${motifs.join('|')})`, 'g'),
}));

const REGLES_CATEGORIES = DEFINITIONS_THEMES.map(({ id, motifs, motifsCategories = [], parents = [] }) => ({
  id,
  parents,
  motif: new RegExp(`(^|[^a-z0-9])(${[...motifs, ...motifsCategories].join('|')})`),
  global: new RegExp(`(^|[^a-z0-9])(${[...motifs, ...motifsCategories].join('|')})`, 'g'),
}));

/** Nombre maximal d’étiquettes de thème posées par carte (demande d’Alexis, 2026-11-14). */
export const MAX_THEMES_PAR_CARTE = 4;

/**
 * Occurrences de chaque thème trouvé directement (sans parents) dans un texte libre. Un mot-clé écrit avec une majuscule
 * derrière un autre mot à majuscule (« studio Bee Train », « Kōichi Mashimo ») est un nom propre : il ne compte pas.
 */
const MEMO_OCCURRENCES = new Map<string, ReadonlyMap<string, number>>();
const MEMO_MAX = 20_000;

/** Le lot, l’aperçu et les écarts relisent les mêmes textes : le résultat est mémorisé (borné), il n’est jamais modifié par les appelants. */
function occurrencesDirectes(texte: string, categories = false): ReadonlyMap<string, number> {
  const cle = `${categories ? 1 : 0}\u0000${texte}`;
  const memo = MEMO_OCCURRENCES.get(cle);
  if (memo) return memo;
  const resultat = calculerOccurrences(texte, categories);
  if (MEMO_OCCURRENCES.size >= MEMO_MAX) MEMO_OCCURRENCES.clear();
  MEMO_OCCURRENCES.set(cle, resultat);
  return resultat;
}

function calculerOccurrences(texte: string, categories: boolean): Map<string, number> {
  const brut = texte.replaceAll('’', "'");
  const normalise = `${normaliser(brut)} `;
  // Les indices ne correspondent à l’original que si la normalisation conserve la longueur.
  const memeLongueur = normalise.length === brut.length + 1;
  const compte = new Map<string, number>();
  for (const { id, motif, global } of categories ? REGLES_CATEGORIES : REGLES) {
    if (!motif.test(normalise)) continue;
    let n = 0;
    global.lastIndex = 0;
    for (const m of normalise.matchAll(global)) {
      if (memeLongueur) {
        const mot = (m[2] ?? '').trim();
        const debut = (m.index ?? 0) + (m[1] ?? '').length;
        // Seul un mot-clé d’un seul mot peut être le bout d’un nom propre (« Bee Train ») ; une expression comme « Rome antique » reste.
        if (!/\s/.test(mot) && nomPropre(brut, debut)) continue;
      }
      n += 1;
    }
    if (n > 0) compte.set(id, n);
  }
  return compte;
}

const MAJUSCULE = /\p{Lu}/u;

/** Vrai si le mot à `debut` est en majuscule et directement précédé d’un mot en majuscule (nom propre composé). */
function nomPropre(texte: string, debut: number): boolean {
  if (!MAJUSCULE.test(texte.charAt(debut))) return false;
  const avant = /(\p{L}[\p{L}'’-]*) +$/u.exec(texte.slice(0, debut));
  if (avant?.[1] === undefined || !MAJUSCULE.test(avant[1].charAt(0))) return false;
  // « Le Chat botté », « La Tour » : un article en majuscule (titre en casse de titre) ne fait pas un nom propre.
  return !/^(le|la|les|l'|un|une|du|des|de|d')$/i.test(avant[1]);
}

const PARENTS = new Map(DEFINITIONS_THEMES.map((t) => [t.id, t.parents ?? []] as const));

/** Thèmes (parents compris) trouvés dans un texte libre ; liste vide s'il n'y en a aucun. */
export function themesDeTexte(texte: string, categories = false): string[] {
  const themes = new Set<string>();
  for (const id of occurrencesDirectes(texte, categories).keys()) {
    themes.add(id);
    for (const parent of PARENTS.get(id) ?? []) themes.add(parent);
  }
  return [...themes];
}

// Thèmes vérifiés sur Wikipédia (titre de carte → identifiants de thèmes), chargés depuis le cache local.
// Surcouche en mémoire : elle s'ajoute aux mots-clés, ne remplace rien et n'est jamais écrite ici.
let themesWikipedia: ReadonlyMap<string, readonly string[]> = new Map();
let versionSurcouches = 0;

/** Change à chaque remplacement d’une surcouche (Wikipédia, signaux, IA) : les résultats mémorisés par carte s’en servent pour expirer. */
export const versionThemes = (): number => versionSurcouches;

export function definirThemesWikipedia(themes: ReadonlyMap<string, readonly string[]>): void {
  themesWikipedia = themes;
  versionSurcouches++;
}

export function themesDeCarte(carte: Pick<Carte, 'titre' | 'description'>): string[] {
  const themes = new Set(themesDeTexte(`${carte.titre} ${carte.description}`));
  for (const id of themesWikipedia.get(carte.titre) ?? []) themes.add(id);
  // Thèmes fiables lus par le sens (définition, classes Wikidata) : ce sont ceux des étiquettes, ils ne doivent jamais laisser la carte en « autres ».
  const locaux = themesPrincipauxLocaux(carte);
  if (themes.size === 0) {
    for (const id of locaux) {
      themes.add(id);
      for (const parent of PARENTS.get(id) ?? []) themes.add(parent);
    }
  }
  // Thèmes de l’IA : dernier recours, seulement si aucun thème local n’est retenu (sinon un cache ancien fausserait amis et favoris).
  if (themesIA.has(carte.titre) && locaux.length === 0) {
    for (const id of themesIA.get(carte.titre) ?? []) {
      themes.add(id);
      for (const parent of PARENTS.get(id) ?? []) themes.add(parent);
    }
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

/** Tous les ancêtres (parents, parents des parents…) d'un thème. */
function ancetres(id: string, vus: Set<string> = new Set()): Set<string> {
  for (const p of PARENTS.get(id) ?? []) {
    if (vus.has(p)) continue;
    vus.add(p);
    ancetres(p, vus);
  }
  return vus;
}

const NB_ANCETRES_THEME = (() => {
  const profondeur = new Map<string, number>();
  const calcul = (id: string, vus: Set<string> = new Set()): number => {
    const connu = profondeur.get(id);
    if (connu !== undefined) return connu;
    if (vus.has(id)) return 0;
    vus.add(id);
    const p = PARENTS.get(id) ?? [];
    const v = p.length === 0 ? 0 : 1 + Math.max(...p.map((x) => calcul(x, vus)));
    profondeur.set(id, v);
    return v;
  };
  for (const t of DEFINITIONS_THEMES) calcul(t.id);
  return profondeur;
})();

/** Thèmes trouvés directement (parents non ajoutés) dans un texte : sert aux signaux mis en cache. */
export const themesDirectsDeTexte = (texte: string, categories = false): string[] => [...occurrencesDirectes(texte, categories).keys()];

/** Signaux lus par le sens sur la page Wikipédia ou Wikidata d’une carte (mis en cache avec l’entrée). */
export interface SignauxPage {
  /** Thèmes de la définition (« X est un film d’animation… ») et des classes Wikidata : fiables. */
  fortes: string[];
  /** Thèmes des catégories : utiles, mais seulement s’ils sont compatibles avec la nature du sujet. */
  faibles: string[];
  genre: Genre;
}

let signauxWikipedia: ReadonlyMap<string, SignauxPage> = new Map();

export function definirSignauxWikipedia(signaux: ReadonlyMap<string, SignauxPage>): void {
  signauxWikipedia = signaux;
  versionSurcouches++;
}

// Thèmes attribués par l’API Claude aux cartes que les moyens locaux ne savent pas classer (titre → identifiants, cache persistant).
// Dernier recours : ils ne servent que si aucun thème local n’est retenu, donc un résultat local n’est jamais écrasé.
let themesIA: ReadonlyMap<string, readonly string[]> = new Map();

export function definirThemesIA(themes: ReadonlyMap<string, readonly string[]>): void {
  themesIA = themes;
  versionSurcouches++;
}

/** La carte n’a aucun thème par les moyens locaux (mots-clés, Wikipédia, Wikidata), sans la surcouche IA. */
export function sansThemeLocal(carte: Pick<Carte, 'titre' | 'description'>): boolean {
  return themesPrincipauxLocaux(carte).length === 0;
}

// Thèmes « physiques » (animal, véhicule, astre, lieu naturel, science) : une personne, une œuvre ou une organisation ne les reçoit
// que si sa définition le dit (« pilote de ligne »), jamais parce que son texte ou ses catégories citent un lion ou un avion.
const PHYSIQUES = new Set(['nature', 'vehicule', 'espace', 'geographie', 'sciences']);
const estPhysique = (id: string, vus = new Set<string>()): boolean => {
  if (PHYSIQUES.has(id)) return true;
  if (vus.has(id)) return false;
  vus.add(id);
  return (PARENTS.get(id) ?? []).some((p) => estPhysique(p, vus));
};
const GENRES_HUMAINS: ReadonlySet<Genre> = new Set(['personne', 'oeuvre', 'organisation', 'produit', 'notion']);

/**
 * Thèmes qui caractérisent le plus la carte (au plus `MAX_THEMES_PAR_CARTE`), du mieux établi au moins bien établi.
 * Le sens passe avant les mots : la définition (« X est un film d’animation japonais ») et les classes Wikidata pèsent 5,
 * les catégories 2, le titre 1, le reste du texte moins encore. Un thème physique (animal, véhicule, astre…) venant d’un
 * canal faible est écarté pour une personne, une œuvre ou une organisation. Un thème dont le poids est inférieur à 40 % du
 * meilleur est écarté ; à poids égal, le plus précis passe avant. Les parents ne sont pas ajoutés (`themesDeCarte` les donne aux amis).
 */
export function themesPrincipaux(carte: Pick<Carte, 'titre' | 'description'>): string[] {
  const locaux = themesPrincipauxLocaux(carte);
  return locaux.length > 0 ? locaux : (themesIA.get(carte.titre) ?? []).slice(0, MAX_THEMES_PAR_CARTE);
}

function themesPrincipauxLocaux(carte: Pick<Carte, 'titre' | 'description'>): string[] {
  const poids = new Map<string, number>();
  const ajouter = (ids: Iterable<string>, valeur: number): void => {
    for (const id of ids) poids.set(id, (poids.get(id) ?? 0) + valeur);
  };
  const description = carte.description;
  const defSite = definition(description);
  const page = signauxWikipedia.get(carte.titre);
  let genre = genreDe(description, defSite);
  if (genre === 'autre' && page) genre = page.genre;
  const faible = (ids: Iterable<string>, valeur: number): void => {
    ajouter([...ids].filter((id) => !(GENRES_HUMAINS.has(genre) && estPhysique(id))), valeur);
  };
  ajouter(themesDirectsDeTexte(defSite), 5);
  ajouter(page?.fortes ?? [], 5);
  const finPhrase = description.search(/[.!?](\s|$)/);
  const premiere = finPhrase === -1 ? description : description.slice(0, finPhrase + 1);
  faible(themesDirectsDeTexte(carte.titre), 1);
  faible(themesDirectsDeTexte(premiere), 1.5);
  faible(themesDirectsDeTexte(description.slice(premiere.length)), 0.5);
  if (page) faible(page.faibles, 2);
  else {
    // Entrée de cache ancienne (sans signaux) : elle contient les parents et le résumé, les ancêtres n'y comptent pas.
    const wiki = themesWikipedia.get(carte.titre) ?? [];
    const ancetresWiki = new Set(wiki.flatMap((id) => [...ancetres(id)]));
    faible(wiki.filter((id) => !ancetresWiki.has(id)), 2);
  }
  const meilleur = Math.max(0, ...poids.values());
  const retenus = [...poids.entries()].filter(([, p]) => p * 5 >= meilleur * 2);
  // Un thème qui est l'ancêtre d'un autre thème retenu est écarté : « #Chien » suffit, pas « #Animaux » en plus.
  const ancetresRetenus = new Set(retenus.flatMap(([id]) => [...ancetres(id)]));
  return retenus
    .filter(([id]) => !ancetresRetenus.has(id))
    .sort(([a, pa], [b, pb]) => pb - pa || (NB_ANCETRES_THEME.get(b) ?? 0) - (NB_ANCETRES_THEME.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, MAX_THEMES_PAR_CARTE)
    .map(([id]) => id);
}
