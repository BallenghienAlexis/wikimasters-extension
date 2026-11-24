// Part « étiquettes » de la sauvegarde complète (Alexis, 2026-11-24 : « après l’import, l’attribution des tags est suspendue »).
// Logique pure, sans `chrome.*`. Le registre d’un PC (couples exemplaire × étiquette) est lié aux identifiants du site, qui ne
// voyagent jamais : le fichier porte donc des noms d’étiquettes par **carte locale** (`rareté|titre`), pas par exemplaire.
// À l’import, ces revendications ne sont jamais crues sur parole : seul ce que la liste d’étiquettes du site et les étiquettes
// lues sur chaque carte confirment entre dans le registre du PC qui reçoit (`adopterEtiquettes`). Aucune requête, aucune route.
import type { Carte } from './collection';
import type { Registre } from './actions';
import type { EtiquetteSite } from './etiquettesPreexistantes';
import { enregistrerEtiquette, estRefuse, poserCouple, refuserCouple } from './registre';
import { MODES_ETIQUETTES, type ModeEtiquettes } from './tri';
import { estObjet } from './valider';

const MAX_NOMS = 500;
const MAX_PAR_CARTE = 20;
const MAX_CLE = 300;
const MAX_TEXTE = 100;
/** Jamais posées par l’extension (AGENTS.md : « sans thème fiable = à classer »). */
const NOMS_INTERDITS: ReadonlySet<string> = new Set(['#À classer', '#Autres']);

type Table = Record<string, string[]>;
const table = (): Table => Object.create(null) as Table;

/** Ce que le fichier porte des étiquettes posées par l’extension. */
export interface EtiquettesSauvegardees {
  /** Dernière synchro du PC qui exporte (ms) : date de ce relevé, pour départager avec le PC qui reçoit. */
  releveLe: number | null;
  /** Mode des étiquettes choisi par le joueur (absent : jamais choisi). */
  mode?: ModeEtiquettes;
  /** Noms des étiquettes créées par l’extension (registre). */
  noms: string[];
  /** Étiquettes posées par l’extension, par identifiant de carte locale. */
  parCarte: Table;
  /** Étiquettes retirées à la main par le joueur : jamais reposées, par identifiant de carte locale. */
  refus: Table;
}

/** Revendications gardées en attente (clé `etiquettesImportees`) jusqu’à la première synchro qui suit l’import. */
export interface EtiquettesImportees {
  version: 1;
  /** Moment de l’import (ms). */
  importeLe: number;
  noms: string[];
  parCarte: Table;
  refus: Table;
}

export interface EtatLocalEtiquettes {
  registre: Registre;
  cartes: readonly Pick<Carte, 'id' | 'idsSite'>[];
  derniereSynchro: number | null;
  mode: ModeEtiquettes | undefined;
}

export function exporterEtiquettes(l: EtatLocalEtiquettes): EtiquettesSauvegardees {
  const parCarte = table();
  const refus = table();
  for (const c of l.cartes) {
    const ex = new Set(c.idsSite ?? []);
    if (ex.size === 0) continue;
    const poses = [...new Set(l.registre.couples.filter((x) => ex.has(x.ex) && !NOMS_INTERDITS.has(x.nom)).map((x) => x.nom))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (poses.length > 0) parCarte[c.id] = poses;
    const retires = [...new Set((l.registre.refus ?? []).filter((x) => ex.has(x.ex) && !NOMS_INTERDITS.has(x.nom)).map((x) => x.nom))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (retires.length > 0) refus[c.id] = retires;
  }
  return {
    releveLe: l.derniereSynchro,
    ...(l.mode === undefined ? {} : { mode: l.mode }),
    noms: Object.keys(l.registre.etiquettes).filter((n) => !NOMS_INTERDITS.has(n)).sort((a, b) => a.localeCompare(b, 'fr')),
    parCarte: { ...parCarte },
    refus: { ...refus },
  };
}

const nomValide = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXTE;

function lireTable(brut: unknown): Table | null {
  if (brut === undefined) return table();
  if (!estObjet(brut)) return null;
  const cles = Object.keys(brut);
  if (cles.length > 20_000) return null;
  const t = table();
  for (const cle of cles) {
    const v = brut[cle];
    if (cle.length === 0 || cle.length > MAX_CLE || !Array.isArray(v) || v.length > MAX_PAR_CARTE || !v.every(nomValide)) return null;
    const noms = [...new Set(v.filter((n) => !NOMS_INTERDITS.has(n)))];
    if (noms.length > 0) t[cle] = noms;
  }
  return t;
}

/** Valide la part « étiquettes » d'un fichier (absente : `undefined`, fichier d'une ancienne version) ; une erreur dit quoi corriger. */
export function lireEtiquettes(brut: unknown): EtiquettesSauvegardees | undefined | string {
  if (brut === undefined) return undefined;
  if (!estObjet(brut)) return 'Les étiquettes de la sauvegarde sont invalides.';
  const d = brut.releveLe;
  if (d !== null && !(typeof d === 'number' && Number.isSafeInteger(d) && d >= 0)) return 'La date du relevé des étiquettes est invalide.';
  if (!Array.isArray(brut.noms) || brut.noms.length > MAX_NOMS || !brut.noms.every(nomValide)) return 'La liste des étiquettes de la sauvegarde est invalide.';
  const parCarte = lireTable(brut.parCarte);
  if (parCarte === null) return 'Les étiquettes posées par carte de la sauvegarde sont invalides.';
  const refus = lireTable(brut.refus);
  if (refus === null) return 'Les étiquettes retirées à la main de la sauvegarde sont invalides.';
  // Un mode inconnu (fichier d'une version plus récente) est ignoré : le mode d'ici est gardé.
  const mode = typeof brut.mode === 'string' && (MODES_ETIQUETTES as readonly string[]).includes(brut.mode) ? (brut.mode as ModeEtiquettes) : undefined;
  return {
    releveLe: d,
    ...(mode === undefined ? {} : { mode }),
    noms: [...new Set(brut.noms.filter((n) => !NOMS_INTERDITS.has(n)))],
    parCarte: { ...parCarte },
    refus: { ...refus },
  };
}

/** Mode des étiquettes après import : celui d'ici s'il a été choisi, sinon celui de la sauvegarde (sinon `undefined` = suspendu). */
export const modeApresImport = (ici: ModeEtiquettes | undefined, s: EtiquettesSauvegardees | undefined): ModeEtiquettes | undefined => ici ?? s?.mode;

/** Vrai si la dernière synchro d'ici est plus récente que le relevé du fichier (les informations d'ici priment alors). */
export const synchroIciPlusRecente = (ici: number | null, fichier: number | null): boolean => ici !== null && (fichier === null || ici > fichier);

const unir = (a: Table, b: Table): Table => {
  const t = table();
  for (const [cle, noms] of [...Object.entries(a), ...Object.entries(b)]) t[cle] = [...new Set([...(t[cle] ?? []), ...noms])].slice(0, MAX_PAR_CARTE);
  return t;
};

/**
 * Revendications à garder après un import (aucune écriture sur le registre ici).
 * Règle « le plus récent gagne » : si la synchro d'ici est plus récente que le relevé du fichier, les étiquettes retirées à la main
 * dans le fichier sont ignorées (les décisions d'ici, plus récentes, priment) ; les poses ne servent qu'à reconnaître des
 * étiquettes que le site confirme, donc elles ne peuvent pas contredire une synchro plus récente.
 */
export function fusionnerImportees(existantes: EtiquettesImportees | null, s: EtiquettesSauvegardees, derniereSynchroIci: number | null, maintenant: number): EtiquettesImportees {
  const refusRepris = synchroIciPlusRecente(derniereSynchroIci, s.releveLe) ? table() : s.refus;
  return {
    version: 1,
    importeLe: maintenant,
    noms: [...new Set([...(existantes?.noms ?? []), ...s.noms])].slice(0, MAX_NOMS),
    parCarte: { ...unir(existantes?.parCarte ?? table(), s.parCarte) },
    refus: { ...unir(existantes?.refus ?? table(), refusRepris) },
  };
}

/** Valide les revendications stockées ; `null` si la forme est inattendue (elles sont alors ignorées, jamais bloquantes). */
export function validerImportees(brut: unknown): EtiquettesImportees | null {
  if (!estObjet(brut) || brut.version !== 1 || typeof brut.importeLe !== 'number' || !Number.isSafeInteger(brut.importeLe) || brut.importeLe < 0) return null;
  if (!Array.isArray(brut.noms) || brut.noms.length > MAX_NOMS || !brut.noms.every(nomValide)) return null;
  const parCarte = lireTable(brut.parCarte);
  const refus = lireTable(brut.refus);
  if (parCarte === null || refus === null) return null;
  return { version: 1, importeLe: brut.importeLe, noms: [...brut.noms], parCarte: { ...parCarte }, refus: { ...refus } };
}

export interface BilanAdoption {
  registre: Registre;
  etiquettes: number;
  couples: number;
  refus: number;
}

/**
 * Reprend dans le registre ce que le site confirme (jamais autre chose) :
 * - une étiquette du fichier qui existe sur le site sous le même nom : son identifiant entre dans le registre (le lot ne la recrée pas) ;
 * - une pose du fichier que la carte porte réellement sur le site : couple ajouté pour ses exemplaires (le lot ne la repose pas, et pourra la retirer) ;
 * - un retrait à la main du fichier que la carte ne porte pas (et que le registre d'ici ne pose pas) : mémorisé, jamais reposé.
 * Sans liste d'étiquettes du site (absente ou vide), rien ne change. Une étiquette hors fichier n'est jamais reprise : l'extension
 * ne retire que ce qu'elle a posée. Idempotente ; ne modifie jamais l'entrée.
 */
export function adopterEtiquettes(registre: Registre, importees: EtiquettesImportees, cartes: readonly Pick<Carte, 'id' | 'idsSite' | 'etiquettesSite'>[], site: readonly EtiquetteSite[] | null): BilanAdoption {
  const rien: BilanAdoption = { registre, etiquettes: 0, couples: 0, refus: 0 };
  if (site === null || site.length === 0) return rien;
  const idParNom = new Map<string, string>();
  for (const e of site) if (!idParNom.has(e.nom)) idParNom.set(e.nom, e.id);

  let r = registre;
  let nbEtiquettes = 0;
  let nbCouples = 0;
  let nbRefus = 0;
  const revendiquees = new Set([...importees.noms, ...Object.values(importees.parCarte).flat()]);
  for (const nom of revendiquees) {
    const id = idParNom.get(nom);
    if (id === undefined || NOMS_INTERDITS.has(nom) || Object.hasOwn(r.etiquettes, nom)) continue;
    r = enregistrerEtiquette(r, nom, id);
    nbEtiquettes += 1;
  }
  for (const c of cartes) {
    const exemplaires = c.idsSite ?? [];
    if (exemplaires.length === 0) continue;
    const sur = new Set(c.etiquettesSite);
    for (const nom of importees.parCarte[c.id] ?? []) {
      if (!sur.has(nom) || !Object.hasOwn(r.etiquettes, nom)) continue;
      for (const ex of exemplaires) {
        if (estRefuse(r, ex, nom)) continue;
        const suivant = poserCouple(r, ex, nom);
        if (suivant !== r) nbCouples += 1;
        r = suivant;
      }
    }
    for (const nom of importees.refus[c.id] ?? []) {
      if (sur.has(nom)) continue;
      for (const ex of exemplaires) {
        if (r.couples.some((x) => x.ex === ex && x.nom === nom)) continue;
        const suivant = refuserCouple(r, ex, nom);
        if (suivant !== r) nbRefus += 1;
        r = suivant;
      }
    }
  }
  return { registre: r, etiquettes: nbEtiquettes, couples: nbCouples, refus: nbRefus };
}
