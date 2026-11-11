import { CONFIG_AFFLUENCE, type ConfigAffluence } from '../config/affluence';

/** Évènement de vente noté par le joueur (horodatages en ms). */
export interface EvenementVente {
  type: 'debut' | 'fin';
  at: number;
}

export const VERSION_VENTES = 1;
export const MAX_EVENEMENTS = 500;

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
export function validerEvenements(brut: unknown): EvenementVente[] {
  if (!Array.isArray(brut)) return [];
  const sortie: EvenementVente[] = [];
  for (const e of brut) {
    if (typeof e !== 'object' || e === null) continue;
    const o = e as Record<string, unknown>;
    if ((o.type !== 'debut' && o.type !== 'fin') || typeof o.at !== 'number' || !Number.isSafeInteger(o.at) || o.at < 0) continue;
    sortie.push({ type: o.type, at: o.at });
  }
  return sortie.slice(-MAX_EVENEMENTS);
}

export function ajouterEvenement(evenements: readonly EvenementVente[], e: EvenementVente): EvenementVente[] {
  return [...evenements, e].slice(-MAX_EVENEMENTS);
}

const dansCreneaux = (heure: number, creneaux: [number, number][]): boolean => creneaux.some(([a, b]) => heure >= a && heure < b);

export function observations(evenements: readonly EvenementVente[]): number {
  return evenements.filter((e) => e.type === 'debut').length;
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
  const seuil = utilises[Math.max(0, Math.ceil(utilises.length / 4) - 1)]!;
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
