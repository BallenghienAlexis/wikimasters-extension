// Lecture du sens d’une présentation (site ou Wikipédia) : de quoi s’agit-il (personne, œuvre, organisation, lieu, espèce) et
// quelle est la définition (« X est un film d’animation japonais… ») ? Logique pure, sans dépendance aux thèmes.
import { normaliser } from './collection';

export type Genre = 'personne' | 'oeuvre' | 'organisation' | 'lieu' | 'espece' | 'autre';

const PARENTHESES = /\([^()]*\)/g;
const COPULE = /(?:^|[\s,])(?:est|etait|fut|sont|etaient|furent|sera)\s+(?:(?:une|un|les|le|la|l'|des|du|de la|d')\s*)?/;
// La définition s’arrête au premier complément qui ne qualifie plus la nature du sujet.
const FIN_DEFINITION = /(?:[,;.:!?]|\s(?:qui|dont|ou|que|situe|situee|installe|base|basee|fonde|fondee|cree|creee|realise|realisee|produit|produite|publie|publiee|sorti|sortie|depuis|ayant|avec|pour|sous|par)\s|\s(?:de|en|le|au)\s(?:\d|1er))/;
const MAX_MOTS = 14;

/** Phrase de définition : ce que le texte dit être le sujet, sans les noms propres et compléments qui suivent. */
export function definition(texte: string): string {
  const net = texte.replaceAll('’', "'").replace(PARENTHESES, ' ').replace(PARENTHESES, ' ').replace(/\s+/g, ' ').trim();
  if (net === '') return '';
  const premiere = /^.*?(?<!(?:^|\s)\p{Lu})[.!?](?=\s|$)/u.exec(net)?.[0] ?? net;
  const norm = normaliser(premiere);
  // Sans verbe (« physicienne et chimiste polonaise »), la définition est le début de la phrase, jusqu’à la première virgule.
  const m = COPULE.exec(norm);
  const reste = m ? norm.slice(m.index + m[0].length) : norm;
  const fin = FIN_DEFINITION.exec(reste);
  const coupe = (fin ? reste.slice(0, fin.index) : reste).split(' ').slice(0, MAX_MOTS).join(' ').trim();
  return coupe;
}

// Mots de tête classés : le premier qui apparaît dans la définition donne le genre.
const GENRES: [Genre, RegExp][] = [
  ['oeuvre', /(^|[^a-z])(film|serie|anime|manga|roman|album|chanson|single|jeu video|jeu de|bande dessinee|telefilm|dessin anime|oeuvre|piece de theatre|opera|emission|comedie|documentaire|feuilleton|nouvelle|poeme|tableau|sculpture|episode|saga|recueil)/],
  ['organisation', /(^|[^a-z])(equipe|club|entreprise|societe|groupe|parti|association|franchise|ligue|marque|constructeur|label|studio|federation|syndicat|organisation|institution|ecole|universite|journal|magazine|chaine|banque|armee|gouvernement|ministere)/],
  ['espece', /(^|[^a-z])(espece|taxon|genre de|famille de|sous-espece|race de|ordre de|plante|animal|mammifere|oiseau|insecte|poisson|reptile|champignon|arbre)/],
  ['lieu', /(^|[^a-z])(ville|commune|village|localite|region|departement|province|pays|etat|fleuve|riviere|montagne|volcan|ile|lac|desert|ocean|mer|quartier|capitale|monument|batiment|pont|barrage|tour|chateau|cathedrale|parc|site|territoire|canton|comte)/],
];

// Sur texte normalisé (minuscules, sans accents) : « né le », « née en 1930 », « (14 décembre 1960 - … ». Des années seules « (1994-2004) » ne suffisent pas (séries).
const NAISSANCE = /\(\s*(?:ne|nee)\b|\(\s*\d{1,2}(?:er)?\s+[a-z]+\s+\d{3,4}\s*[-–]|\b(?:ne|nee)\s+(?:le|en|a)\b/;
const METIERS = /(^|[^a-z])(chanteu|chanteuse|acteur|actrice|realisat|ecrivain|autrice|auteur|peintre|sculpteur|compositeur|compositrice|musicien|musicienne|rappeu|pianiste|guitariste|batteur|homme|femme|personnalite|dirigeant|dirigeante|president|presidente|ministre|depute|senateur|chancelier|roi|reine|empereur|imperatrice|prince|princesse|duc|duchesse|pape|saint|sainte|philosophe|physicien|physicienne|chimiste|mathematicien|mathematicienne|biologiste|astronome|explorateur|exploratrice|inventeur|inventrice|ingenieur|ingenieure|journaliste|animateur|animatrice|humoriste|comedien|comedienne|athlete|joueur|joueuse|footballeur|footballeuse|sportif|sportive|cycliste|pilote|boxeur|boxeuse|nageur|nageuse|tennisman|tenniswoman|entraineur|entraineuse|general|maréchal|marechal|militaire|dictateur|criminel|tueur|poete|poetesse|dramaturge|architecte|photographe|dessinateur|dessinatrice|scenariste|producteur|productrice|danseur|danseuse|medecin|chirurgien|avocat|juge|espion|espionne|activiste|militant|militante|diplomate|economiste|sociologue|historien|historienne|theologien|theologienne|mannequin|influenceur|influenceuse|youtubeur|youtubeuse)/;

/** Genre du sujet d’après sa présentation (définition d’abord, indices de naissance ensuite). */
export function genreDe(texte: string, def = definition(texte)): Genre {
  if (NAISSANCE.test(normaliser(texte.replaceAll('’', "'")).slice(0, 400))) return 'personne';
  // Le premier mot de tête qui apparaît dans la définition l’emporte : « équipe de hockey » est une organisation, pas un lieu.
  let meilleur: { genre: Genre; position: number } | null = null;
  for (const [genre, motif] of GENRES) {
    const m = motif.exec(def);
    if (m && (meilleur === null || m.index < meilleur.position)) meilleur = { genre, position: m.index };
  }
  if (meilleur) return meilleur.genre;
  if (METIERS.test(def)) return 'personne';
  return 'autre';
}
