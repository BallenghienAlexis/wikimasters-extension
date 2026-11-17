// Harnais de scoring du banc d’essai des thèmes : donne à une fonction de déduction les cartes de référence et mesure l’écart.
// Aucune dépendance à la logique de production : les POC l’appellent avec n’importe quelle fonction (synchrone ou asynchrone)
// ou lui passent des prédictions déjà calculées (`scorerPredictions`).
import { CARTES_REFERENCE } from './cartes';
import type { CarteReference, Categorie, Fiabilite, FonctionDeduction } from './types';

export const MAX_THEMES = 4;

export interface DetailCarte {
  titre: string;
  categorie: Categorie;
  piege: boolean;
  predits: string[];
  reference: string[];
  /** Thèmes prédits et attendus. */
  corrects: string[];
  /** Thèmes prédits, ni attendus ni tolérés. */
  faux: string[];
  /** Thèmes attendus et absents. */
  manquants: string[];
  /** Thèmes interdits qui ont été prédits (piège déclenché). */
  interdits: string[];
  exacte: boolean;
}

export interface Mesures {
  cartes: number;
  /** Corrects / (corrects + faux) : les thèmes tolérés sont neutres. Vaut 1 sans aucune prédiction. */
  precision: number;
  /** Corrects / thèmes attendus. */
  rappel: number;
  f1: number;
  /** Faux / (corrects + faux) = 1 − précision. */
  tauxFauxThemes: number;
  /** Part des cartes portant au moins un faux thème. */
  tauxCartesAvecFauxTheme: number;
  /** Cartes de référence non vide dont la déduction est vide (« à classer » à tort) / cartes de référence non vides. */
  tauxSansThemeATort: number;
  /** Cartes de référence vide pour lesquelles la déduction propose quand même des thèmes / cartes de référence vides (null s’il n’y en a pas). */
  tauxFauxSurCartesVides: number | null;
  /** Cartes dont un thème interdit a été prédit / cartes ayant des thèmes interdits. */
  tauxPiegesDeclenches: number | null;
  /** Part des cartes dont l’ensemble prédit est exactement la référence. */
  tauxExactes: number;
  /** Cartes pour lesquelles plus de 4 thèmes sont proposés (la production en pose 4 au plus). */
  depassementsMax: number;
}

export interface Rapport {
  global: Mesures;
  parCategorie: Partial<Record<Categorie, Mesures>>;
  /** Cartes piégeuses seules. */
  pieges: Mesures;
  details: DetailCarte[];
}

export interface OptionsEvaluation {
  /** Cartes à évaluer (par défaut tout le jeu de référence). */
  cartes?: readonly CarteReference[];
  /** Exclut les cartes moins fiables que ce niveau (par défaut : tout est gardé). */
  fiabiliteMin?: Fiabilite;
  /** Erreur de la fonction sur une carte : la carte compte comme « aucun thème ». Par défaut : l’erreur est propagée. */
  ignorerErreurs?: boolean;
}

const RANG_FIABILITE: Record<Fiabilite, number> = { 'a-verifier': 0, moyenne: 1, haute: 2 };

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];
const ratio = (a: number, b: number, vide = 0): number => (b === 0 ? vide : a / b);

/** Compare une prédiction à la référence d’une carte. */
export function comparer(carte: CarteReference, predits: readonly string[]): DetailCarte {
  const p = unique(predits);
  const ref = new Set(carte.themes);
  const tolere = new Set(carte.acceptables ?? []);
  const interdits = new Set(carte.interdits ?? []);
  const corrects = p.filter((id) => ref.has(id));
  const faux = p.filter((id) => !ref.has(id) && !tolere.has(id));
  const manquants = carte.themes.filter((id) => !p.includes(id));
  return {
    titre: carte.titre,
    categorie: carte.categorie,
    piege: carte.piege === true,
    predits: p,
    reference: [...carte.themes],
    corrects,
    faux,
    manquants,
    interdits: p.filter((id) => interdits.has(id)),
    exacte: p.length === ref.size && p.every((id) => ref.has(id)),
  };
}

export function mesurer(cartes: readonly CarteReference[], details: readonly DetailCarte[]): Mesures {
  const parTitre = new Map(cartes.map((c) => [c.titre, c]));
  let corrects = 0;
  let faux = 0;
  let attendus = 0;
  let avecFaux = 0;
  let nonVides = 0;
  let sansThemeATort = 0;
  let vides = 0;
  let videsFaux = 0;
  let avecInterdits = 0;
  let piegesDeclenches = 0;
  let exactes = 0;
  let depassements = 0;
  for (const d of details) {
    const carte = parTitre.get(d.titre);
    corrects += d.corrects.length;
    faux += d.faux.length;
    attendus += d.reference.length;
    if (d.faux.length > 0) avecFaux += 1;
    if (d.reference.length > 0) {
      nonVides += 1;
      if (d.predits.length === 0) sansThemeATort += 1;
    } else {
      vides += 1;
      if (d.predits.length > 0) videsFaux += 1;
    }
    if ((carte?.interdits?.length ?? 0) > 0) {
      avecInterdits += 1;
      if (d.interdits.length > 0) piegesDeclenches += 1;
    }
    if (d.exacte) exactes += 1;
    if (d.predits.length > MAX_THEMES) depassements += 1;
  }
  const precision = ratio(corrects, corrects + faux, 1);
  const rappel = ratio(corrects, attendus, 1);
  return {
    cartes: details.length,
    precision,
    rappel,
    f1: precision + rappel === 0 ? 0 : (2 * precision * rappel) / (precision + rappel),
    tauxFauxThemes: 1 - precision,
    tauxCartesAvecFauxTheme: ratio(avecFaux, details.length),
    tauxSansThemeATort: ratio(sansThemeATort, nonVides),
    tauxFauxSurCartesVides: vides === 0 ? null : videsFaux / vides,
    tauxPiegesDeclenches: avecInterdits === 0 ? null : piegesDeclenches / avecInterdits,
    tauxExactes: ratio(exactes, details.length),
    depassementsMax: depassements,
  };
}

/** Score des prédictions déjà calculées (titre → identifiants de thème). Un titre absent compte comme « aucun thème ». */
export function scorerPredictions(predictions: ReadonlyMap<string, readonly string[]> | Readonly<Record<string, readonly string[]>>, options: OptionsEvaluation = {}): Rapport {
  const lire = (titre: string): readonly string[] => (predictions instanceof Map ? predictions.get(titre) : (predictions as Readonly<Record<string, readonly string[]>>)[titre]) ?? [];
  const minimum = RANG_FIABILITE[options.fiabiliteMin ?? 'a-verifier'];
  const cartes = (options.cartes ?? CARTES_REFERENCE).filter((c) => RANG_FIABILITE[c.fiabilite] >= minimum);
  const details = cartes.map((c) => comparer(c, lire(c.titre)));
  const parCategorie: Partial<Record<Categorie, Mesures>> = {};
  for (const categorie of new Set(cartes.map((c) => c.categorie))) {
    const sous = cartes.filter((c) => c.categorie === categorie);
    parCategorie[categorie] = mesurer(sous, details.filter((d) => d.categorie === categorie));
  }
  const pieges = cartes.filter((c) => c.piege === true);
  return {
    global: mesurer(cartes, details),
    parCategorie,
    pieges: mesurer(pieges, details.filter((d) => d.piege)),
    details,
  };
}

/** Évalue une fonction de déduction sur le jeu de référence (une carte à la fois, dans l’ordre : pas de rafale de requêtes). */
export async function evaluer(deduire: FonctionDeduction, options: OptionsEvaluation = {}): Promise<Rapport> {
  const minimum = RANG_FIABILITE[options.fiabiliteMin ?? 'a-verifier'];
  const cartes = (options.cartes ?? CARTES_REFERENCE).filter((c) => RANG_FIABILITE[c.fiabilite] >= minimum);
  const predictions = new Map<string, string[]>();
  for (const carte of cartes) {
    try {
      predictions.set(carte.titre, await deduire({ titre: carte.titre, description: carte.description, wikipedia: carte.wikipedia }));
    } catch (erreur) {
      if (!options.ignorerErreurs) throw erreur;
      predictions.set(carte.titre, []);
    }
  }
  return scorerPredictions(predictions, { ...options, cartes });
}

const pct = (x: number | null): string => (x === null ? 'n/a' : `${(x * 100).toFixed(1)} %`);

/** Texte de comparaison lisible : une ligne de mesures, puis les cartes qui posent problème. */
export function formaterRapport(rapport: Rapport, nom = 'déduction', max = 15): string {
  const g = rapport.global;
  const lignes = [
    `== ${nom} — ${g.cartes} cartes ==`,
    `précision ${pct(g.precision)} · rappel ${pct(g.rappel)} · F1 ${pct(g.f1)}`,
    `faux thèmes ${pct(g.tauxFauxThemes)} (cartes touchées ${pct(g.tauxCartesAvecFauxTheme)}) · « sans thème » à tort ${pct(g.tauxSansThemeATort)} · exactes ${pct(g.tauxExactes)}`,
    `pièges déclenchés ${pct(g.tauxPiegesDeclenches)} · fausses propositions sur cartes vides ${pct(g.tauxFauxSurCartesVides)} · dépassements de 4 : ${g.depassementsMax}`,
    `cartes piégeuses (${rapport.pieges.cartes}) : précision ${pct(rapport.pieges.precision)}, rappel ${pct(rapport.pieges.rappel)}`,
  ];
  const pires = rapport.details.filter((d) => d.faux.length > 0 || d.interdits.length > 0 || (d.predits.length === 0 && d.reference.length > 0)).slice(0, max);
  for (const d of pires) lignes.push(`  ${d.titre} : prédit [${d.predits.join(', ')}] attendu [${d.reference.join(', ')}]${d.interdits.length > 0 ? ` ⚠ interdit [${d.interdits.join(', ')}]` : ''}`);
  return lignes.join('\n');
}
