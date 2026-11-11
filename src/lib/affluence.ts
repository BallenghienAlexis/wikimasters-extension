import { CONFIG_AFFLUENCE, type ConfigAffluence } from '../config/affluence';

/** Évènement de vente noté par le joueur (horodatages en ms). */
export interface EvenementVente {
  type: 'debut' | 'fin' | 'site';
  at: number;
}

export const VERSION_VENTES = 1;
export const MAX_EVENEMENTS = 500;
/** Plus grande date représentable par `Date` (ms) ; au-delà, `getDay()` renvoie NaN. */
const DATE_MAX = 8.64e15;
/** 2020-01-01 : en deçà, un nombre est pris pour des secondes Unix et rejeté plutôt que de fausser l’histogramme. */
const DATE_MIN_RELEVE = Date.UTC(2020, 0, 1);

export type Histogramme = number[][]; // [jour 0-6][heure 0-23]

export function histogramme(evenements: readonly EvenementVente[]): Histogramme {
  const h: Histogramme = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const e of evenements) {
    const d = new Date(e.at);
    h[d.getDay()]![d.getHours()]! += 1;
  }
  return h;
}

/** Valide des évènements lus du stockage ; les entrées illisibles sont ignorées, le reste est borné. */
export function validerEvenements(brut: unknown, max: number = MAX_EVENEMENTS): EvenementVente[] {
  if (!Array.isArray(brut)) return [];
  const sortie: EvenementVente[] = [];
  for (const e of brut) {
    if (typeof e !== 'object' || e === null) continue;
    const o = e as Record<string, unknown>;
    if ((o.type !== 'debut' && o.type !== 'fin' && o.type !== 'site') || typeof o.at !== 'number' || !Number.isSafeInteger(o.at) || o.at < 0 || o.at > DATE_MAX) continue;
    sortie.push({ type: o.type, at: o.at });
  }
  return sortie.slice(-max);
}

export function ajouterEvenement(evenements: readonly EvenementVente[], e: EvenementVente): EvenementVente[] {
  return [...evenements, e].slice(-MAX_EVENEMENTS);
}

const dansCreneaux = (heure: number, creneaux: [number, number][]): boolean => creneaux.some(([a, b]) => heure >= a && heure < b);

export function observations(evenements: readonly EvenementVente[]): number {
  return evenements.filter((e) => e.type === 'debut' || e.type === 'site').length;
}

/** Vrai si l’instant est une heure forte : créneaux par défaut, ou top 25 % des créneaux observés. */
export function estHeureForte(at: number, evenements: readonly EvenementVente[], config: ConfigAffluence = CONFIG_AFFLUENCE): boolean {
  const d = new Date(at);
  if (observations(evenements) < config.minObservations) {
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    return dansCreneaux(d.getHours(), weekend ? config.creneauxWeekend : config.creneauxSemaine);
  }
  const h = histogramme(evenements);
  const utilises = h.flat().filter((n) => n > 0).sort((a, b) => b - a);
  if (utilises.length === 0) return false;
  // Un créneau à une seule vente n’est jamais « fort » : sans cela, les égalités rendraient tous les créneaux forts.
  const rangQuartile = Math.max(0, Math.ceil(utilises.length / 4) - 1);
  const seuil = Math.max(2, utilises[rangQuartile]!);
  return h[d.getDay()]![d.getHours()]! >= seuil;
}

export interface Conseil {
  delaiHeures: number | null;
  texte: string;
}

/** Délai conseillé pour une carte de cette valeur, à cet instant. */
export function conseillerDelai(valeur: number | null, at: number, evenements: readonly EvenementVente[], config: ConfigAffluence = CONFIG_AFFLUENCE): Conseil {
  if (valeur === null) return { delaiHeures: null, texte: 'valeur inconnue' };
  const forte = estHeureForte(at, evenements, config);
  if (valeur >= config.seuilCarteChere) {
    return forte
      ? { delaiHeures: config.delaiHeureForte, texte: `heure forte : délai ${config.delaiHeureForte} h` }
      : { delaiHeures: null, texte: 'carte chère : attendre une heure forte' };
  }
  return forte
    ? { delaiHeures: null, texte: 'heure forte : réserver aux cartes chères' }
    : { delaiHeures: config.delaiTempsLibre, texte: `temps libre : délai ${config.delaiTempsLibre} h` };
}

const CLES_LISTES = ['items', 'auctions', 'results', 'data', 'marketplace', 'listings'];

function enMs(valeur: unknown): number | null {
  const t = typeof valeur === 'string' ? Date.parse(valeur) : typeof valeur === 'number' ? valeur : NaN;
  return Number.isSafeInteger(t) && t >= DATE_MIN_RELEVE && t <= DATE_MAX ? t : null;
}

/**
 * Horodatages des annonces d’un listing du marché (liste à la racine ou dans un champ usuel). Liste blanche :
 * seul le champ d’horodatage de chaque annonce est lu, tout le reste (joueur, carte, montant) est ignoré.
 */
export function extraireHorodatages(json: unknown, champs: readonly string[] = CONFIG_AFFLUENCE.champsHorodatage): number[] {
  let liste: unknown = json;
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    liste = CLES_LISTES.map((k) => o[k]).find(Array.isArray);
  }
  if (!Array.isArray(liste)) return [];
  const sortie: number[] = [];
  for (const annonce of liste.slice(0, 1000)) {
    if (typeof annonce !== 'object' || annonce === null) continue;
    const o = annonce as Record<string, unknown>;
    for (const champ of champs) {
      const t = enMs(o[champ]);
      if (t !== null) {
        sortie.push(t);
        break;
      }
    }
  }
  return sortie;
}

/** Une route de listing du marché : chemin relatif `/api/marketplace`, jamais l’historique des ventes (segment `sales` sans `scope=summary`, réservé PRO). */
export function routeMarcheValide(route: string | null): route is string {
  if (route === null || !/^\/api\/marketplace(?:[/?]|$)[A-Za-z0-9_/?=&.,-]*$/.test(route)) return false;
  if (route.includes('..') || route.includes('//')) return false;
  const [chemin = '', requete = ''] = route.split('?');
  if (!chemin.split('/').includes('sales')) return true;
  return new URLSearchParams(requete).get('scope') === 'summary';
}
