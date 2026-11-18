// POC thèmes — types partagés. Rien ici n'est branché sur la production.

/** Ce que la collecte (collecter.mjs) rapporte pour une carte : données publiques de Wikipédia et Wikidata, jamais de donnée du compte. */
export interface Page {
  titre: string;
  /** Description de la carte sur WikiMasters (indépendante de Wikipédia). */
  descriptionSite: string;
  /** Introduction complète de la page Wikipédia (texte brut), vide si page absente. */
  resume: string;
  /** Catégories visibles de la page (sans le préfixe « Catégorie: »). */
  categories: string[];
  /** Page d'homonymie. */
  homonymie: boolean;
  /** Courte description Wikidata (« film américain de 2005 »). */
  descriptionWikidata: string[];
  /** Libellés français des classes Wikidata (P31, P106, P136, P641). */
  classesWikidata: string[];
  /** Identifiants Wikidata des classes (pour un futur signal par table d'identifiants, indépendant des mots). */
  idsClassesWikidata?: string[];
  /** Instance de « être humain » (Q5). */
  humain: boolean;
}

export interface CarteTest {
  page: Page;
  /** Thèmes attendus (identifiants du catalogue) ; liste vide = « sans thème fiable » est la bonne réponse. */
  attendu: string[];
  /** Thèmes acceptables en plus (généraux ou voisins), non comptés comme faux. */
  toleres?: string[];
  note?: string;
}

export interface Jeu {
  /** « reel » = pages collectées sur Wikipédia ; « ecrit-a-la-main » = payloads rédigés sans accès réseau (ne prouve rien). */
  origine: 'reel' | 'ecrit-a-la-main';
  cartes: CarteTest[];
}

export type NomSignal = 'site' | 'definition' | 'wikidata' | 'categories' | 'lexical';

/** Thèmes (identifiants directs du catalogue) proposés par chaque signal, indépendamment des autres. */
export type Signaux = Record<NomSignal, string[]>;
