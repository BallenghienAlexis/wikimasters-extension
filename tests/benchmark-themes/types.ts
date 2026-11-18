// Types du banc d’essai des thèmes (voir README.md).

/** Confiance dans la carte de référence : « a-verifier » = description du site reconstruite ou thème discutable. */
export type Fiabilite = 'haute' | 'moyenne' | 'a-verifier';

/** Famille de difficulté, pour lire les scores par type de cas. */
export type Categorie =
  | 'personne'
  | 'oeuvre'
  | 'organisation'
  | 'lieu'
  | 'objet'
  | 'evenement'
  | 'notion'
  | 'espece'
  | 'homonymie'
  | 'nom-propre';

/** Origine des cartes : « reelle » = titre et description lus dans la collection (sauvegarde de l’extension), « reconstruite » = d’après des pages publiques. */
export type SourceCarte = 'reelle' | 'reconstruite';

export interface CarteReference {
  /** Titre de la carte sur WikiMasters (= titre de la page Wikipédia, éventuellement désambiguïsé). */
  titre: string;
  /** Courte description du site (style Wikidata, une ligne). Reconstruite d’après la page publique, jamais lue sur le compte. */
  description: string;
  /** Titre de la page fr.wikipedia.org correspondante (URL : https://fr.wikipedia.org/wiki/<titre avec _>). */
  wikipedia: string;
  /** Thèmes de référence : 1 à 4 identifiants du catalogue de `src/lib/themes.ts`, le plus précis d’abord. Vide = « à classer » est la bonne réponse. */
  themes: string[];
  /** Thèmes tolérés en plus (parent, thème voisin défendable) : ni récompensés ni comptés comme faux. */
  acceptables?: string[];
  /** Thèmes qui seraient une erreur grave (le piège connu de la carte) ; comptés dans `piegesDeclenches`. */
  interdits?: string[];
  /** Pourquoi ces thèmes (une phrase). */
  justification: string;
  categorie: Categorie;
  /** Cas piégeux connu (homonymie, faux ami, motif trompeur). */
  piege?: boolean;
  fiabilite: Fiabilite;
  source: SourceCarte;
}

/** Une fonction de déduction : titre + description (+ titre Wikipédia) → identifiants de thème. Peut être asynchrone (POC avec réseau). */
export type FonctionDeduction = (carte: Pick<CarteReference, 'titre' | 'description' | 'wikipedia'>) => string[] | Promise<string[]>;
