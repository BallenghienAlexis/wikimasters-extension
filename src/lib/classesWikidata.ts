// Thèmes d’une carte d’après les classes de son entité Wikidata (instance de, métier, genre, sport, sous-classe de…).
// Logique pure : le graphe est lu ailleurs (`src/app/grapheWikidata.ts` fait les requêtes). Issue du POC B (PR #197 et #199),
// mesurée sur les 277 cartes réelles : « production, sinon Wikidata » passe de 49,2 % à 59,5 % de rappel pour 4,5 points de précision.
// Aucun mot-clé libre, aucun texte lu : seuls des identifiants publics de Wikidata entrent, seuls des identifiants de thèmes sortent.
import { BARRIERES, TABLE } from './tableWikidata';
import { estObjet } from './valider';

/** Propriétés lues sur l’entité de la carte (liste fermée) : ce que la carte est, son métier, son genre, son sport, son domaine, sa place. */
export const PROPRIETES_CARTE = ['P31', 'P106', 'P136', 'P641', 'P101', 'P921', 'P495', 'P17', 'P279', 'P361'] as const;
/** Propriétés retenues pour une entité ancêtre : de quoi remonter le graphe, rien d’autre. */
export const PROPRIETES_ANCETRE = ['P279', 'P171', 'P361'] as const;
type Propriete = (typeof PROPRIETES_CARTE)[number] | 'P171';

/** Valeurs d’une propriété par entité (identifiants Q seulement) ; absente = propriété sans valeur. */
export type EntiteGraphe = Partial<Record<Propriete, string[]>>;
export type GrapheWikidata = Record<string, EntiteGraphe>;

const POIDS_PROPRIETE: Readonly<Record<string, number>> = { P31: 1, P106: 1, P136: 1.1, P641: 1.1, P101: 0.5, P921: 0.6, P279: 1, P361: 0.8, P17: 0.5, P495: 0.5, self: 1 };
/** Profondeur de remontée (P279) : au-delà, la classe est trop lointaine pour dire quoi que ce soit. */
export const PROFONDEUR_MAX = 6;
const MAX_THEMES = 4;
const PAR_PROPRIETE = 8;
/** Classes de taxons : leur chaîne P171 (taxon parent) mène au règne (animaux, plantes, champignons). */
export const CLASSES_TAXON: ReadonlySet<string> = new Set(['Q16521', 'Q23038290', 'Q713623', 'Q55983715', 'Q136772238', 'Q1160573']);
const REGNES: Readonly<Record<string, string>> = { Q729: 'animaux', Q756: 'plantes', Q764: 'champignon' };
const QID = /^Q\d{1,12}$/;

/** Valeur (identifiant Q) de chaque déclaration non dépréciée d’une propriété, 8 au plus. */
function identifiants(claims: Record<string, unknown>, propriete: string): string[] {
  const liste = claims[propriete];
  if (!Array.isArray(liste)) return [];
  const ids: string[] = [];
  for (const c of liste) {
    if (!estObjet(c) || c.rank === 'deprecated' || !estObjet(c.mainsnak) || !estObjet(c.mainsnak.datavalue) || !estObjet(c.mainsnak.datavalue.value)) continue;
    const id = c.mainsnak.datavalue.value.id;
    if (typeof id === 'string' && QID.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= PAR_PROPRIETE) break;
  }
  return ids;
}

/** GET en lecture seule : les déclarations de 50 entités au plus (identifiants publics de Wikidata, jamais une donnée du compte). */
export function urlEntitesWikidata(ids: readonly string[]): string {
  return `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims', ids: ids.slice(0, 50).join('|') }).toString()}`;
}

/**
 * Liste blanche : pour chaque entité demandée, les propriétés utiles (`proprietes`) et leurs identifiants.
 * Une entité absente ou illisible n’apparaît pas ; null si la réponse n’a pas la forme attendue.
 */
export function lireEntitesWikidata(brut: unknown, proprietes: readonly string[]): GrapheWikidata | null {
  if (!estObjet(brut) || !estObjet(brut.entities)) return null;
  const graphe: GrapheWikidata = {};
  for (const [qid, e] of Object.entries(brut.entities)) {
    if (!QID.test(qid) || !estObjet(e)) continue;
    const claims = estObjet(e.claims) ? e.claims : {};
    const entite: EntiteGraphe = {};
    for (const p of proprietes) {
      const ids = identifiants(claims, p);
      if (ids.length > 0) entite[p as Propriete] = ids;
    }
    graphe[qid] = entite;
  }
  return graphe;
}

/** Identifiants à charger après l’entité de la carte : les valeurs de ses propriétés (sauf « partie de »). */
export function ciblesDeLaCarte(entite: EntiteGraphe): string[] {
  const ids = new Set<string>();
  for (const p of PROPRIETES_CARTE) if (p !== 'P361') for (const v of entite[p] ?? []) ids.add(v);
  return [...ids];
}

/** Vrai si l’entité est un taxon (espèce, genre…) : sa chaîne P171 est alors suivie. */
export const estTaxon = (entite: EntiteGraphe): boolean => (entite.P31 ?? []).some((c) => CLASSES_TAXON.has(c));

/** Ancêtres directs d’un ensemble d’entités déjà connues (P279), non encore présents dans `graphe`. */
export function ancetresAChargerDe(graphe: Readonly<GrapheWikidata>, ids: readonly string[], propriete: 'P279' | 'P171' = 'P279'): string[] {
  const suivants = new Set<string>();
  for (const id of ids) for (const v of graphe[id]?.[propriete] ?? []) if (!(v in graphe)) suivants.add(v);
  return [...suivants];
}

interface Resultat {
  scores: Map<string, number>;
}

/** Remonte le graphe depuis l’entité : { thème → meilleur score }, chaque classe de la table comptant selon sa distance. */
function candidats(graphe: Readonly<GrapheWikidata>, qid: string): Resultat {
  const racine = graphe[qid];
  const scores = new Map<string, number>();
  if (racine === undefined) return { scores };
  const vus = new Map<string, number>();
  const file: [string, number, string, number][] = [];
  // Départ : la valeur de chaque propriété descriptive est à distance 0 ; sa propre chaîne P279 monte ensuite.
  // Les valeurs d’une même propriété sont classées par Wikidata : la 1re pèse plus que la 5e (basketteur avant joueur de baseball).
  for (const p of ['P31', 'P106', 'P136', 'P641', 'P101', 'P921', 'P279', 'P361', 'P17', 'P495'] as const) {
    (racine[p] ?? []).forEach((v, i) => file.push([v, 0, p, 1 / (1 + (p === 'P106' ? 0.6 : 0.3) * i)]));
  }
  file.push([qid, 0, 'self', 1]); // le sujet lui-même est un thème (Bouddhisme, Guerre du Vietnam…)
  for (let tete = 0; tete < file.length; tete++) {
    const [n, d, p, rang] = file[tete] as [string, number, string, number];
    if (d > PROFONDEUR_MAX) continue;
    const deja = vus.get(n);
    if (deja !== undefined && deja <= d) continue;
    vus.set(n, d);
    if (BARRIERES.has(n)) continue; // classe trop générale : on ne monte pas plus haut
    for (const entree of TABLE[n] ?? []) {
      const [t, w] = entree.split(':') as [string, string | undefined];
      const s = ((POIDS_PROPRIETE[p] ?? 1) * rang * (w ? Number(w) : 1)) / (1 + d);
      if (s > (scores.get(t) ?? 0)) scores.set(t, s);
    }
    const e = graphe[n];
    if (e === undefined) continue;
    for (const v of e.P279 ?? []) file.push([v, d + 1, p, rang]);
    for (const v of e.P171 ?? []) file.push([v, d + 0.2, p, rang]); // taxon parent : chaînes longues, pas de perte de score à chaque rang
    if (p === 'P361') for (const v of e.P361 ?? []) file.push([v, d + 1, p, rang]);
  }
  return { scores };
}

function regneDuTaxon(graphe: Readonly<GrapheWikidata>, qid: string): string | null {
  let n: string | undefined = qid;
  for (let i = 0; i < 30 && n !== undefined; i++) {
    const regne = REGNES[n];
    if (regne !== undefined) return regne;
    n = graphe[n]?.P171?.[0];
  }
  return null;
}

/**
 * Thèmes d’une entité : seuil de score, thèmes parents retirés (on garde le plus précis), 4 au plus.
 * Une personne garde seulement les thèmes proches du meilleur (métiers secondaires écartés). Liste vide = aucune classe connue de la table.
 * `parentsDe` vient du catalogue de `themes.ts` (injecté pour éviter une dépendance circulaire).
 */
export function themesDeGraphe(graphe: Readonly<GrapheWikidata>, qid: string, parentsDe: (id: string) => readonly string[]): string[] {
  const { scores } = candidats(graphe, qid);
  // Repli taxon : aucune classe précise (félin, rapace…) mais la chaîne P171 mène au règne des animaux ou des plantes.
  if (scores.size === 0) {
    const regne = regneDuTaxon(graphe, qid);
    if (regne !== null) scores.set(regne, 1);
  }
  const tries = [...scores.entries()].filter(([, s]) => s >= 0.3).sort((a, b) => b[1] - a[1]);
  const meilleur = tries[0]?.[1] ?? 0;
  const humain = (graphe[qid]?.P31 ?? []).includes('Q5');
  const relatif = humain ? 0.8 : 0.6;
  let choisis = tries.filter(([, s]) => s >= meilleur * relatif).map(([t]) => t);
  const aEcarter = new Set<string>();
  for (const t of choisis) for (const p of parentsDe(t)) aEcarter.add(p);
  choisis = choisis.filter((t) => !aEcarter.has(t));
  return choisis.slice(0, MAX_THEMES);
}

/** Graphe mémorisé : liste blanche des propriétés d’ancêtre, identifiants Q seulement, borné. Illisible = null (le graphe se reconstruit). */
export function validerGraphe(brut: unknown, maxEntites: number): GrapheWikidata | null {
  if (!estObjet(brut)) return null;
  const cles = Object.keys(brut);
  if (cles.length > maxEntites) return null;
  const graphe: GrapheWikidata = Object.create(null) as GrapheWikidata;
  for (const qid of cles) {
    const e = brut[qid];
    if (!QID.test(qid) || !estObjet(e)) return null;
    const entite: EntiteGraphe = {};
    for (const p of PROPRIETES_ANCETRE) {
      const v = e[p];
      if (v === undefined) continue;
      if (!Array.isArray(v) || v.length > PAR_PROPRIETE || !v.every((x): x is string => typeof x === 'string' && QID.test(x))) return null;
      entite[p] = [...v];
    }
    graphe[qid] = entite;
  }
  return { ...graphe };
}
