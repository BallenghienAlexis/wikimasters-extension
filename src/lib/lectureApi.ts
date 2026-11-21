// Validation et conversion des réponses de l'API du site (lecture seule).
// Fonctions pures : ni chrome.*, ni fetch. Liste blanche des champs : rien n'est copié hors de celle-ci.
import { RARETES, identifiantCarte } from './lecteur';
import { estEntier, estObjet } from './valider';

const MAX_TEXTE = 300;
const MAX_ID = 200;
const MAX_ETIQUETTES = 200;
/** Étiquettes d’un compte (`tagOptions`) : aligné sur la limite de stockage (`MAX_ETIQUETTES_SITE`). */
const MAX_ETIQUETTES_COMPTE = 500;

export interface EtiquetteStats {
  id: string;
  nom: string;
  couleur: string;
  nbCartes: number;
}

export interface StatsLues {
  total: number;
  /** Cartes distinctes ; `null` si le site ne le donne pas (champ facultatif : son absence n’est pas une erreur). */
  totalUnique: number | null;
  etiquettes: EtiquetteStats[];
}

export interface CarteLue {
  id: string;
  titre: string;
  rarete: string;
  cardId: string;
  idsSite: string[];
  quantite: number;
  favori: boolean;
  etiquettesSite: string[];
}

export interface PageLue {
  cartes: CarteLue[];
  ignorees: number;
  fin: boolean;
  /** Nombre de lignes brutes de la page (50 au plus) ; moins que la taille de page = dernière page. */
  lignes: number;
  /** Vrai si les dates d’ajout (`obtained_at`) de la page sont lisibles et du plus récent au plus ancien. */
  recentDabord: boolean;
}


const estTexte = (v: unknown, max = MAX_TEXTE): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Forme d’une réponse pour le journal : types et noms de champs seulement, jamais de valeur (ni titre, ni identifiant, ni jeton). */
export function decrireForme(json: unknown): string {
  if (json === null || json === undefined) return 'vide ou non JSON';
  if (Array.isArray(json)) return `tableau de ${json.length}`;
  if (typeof json !== 'object') return typeof json;
  const champs = Object.keys(json as Record<string, unknown>).slice(0, 12).map((k) => k.replace(/[^\w-]/g, '?').slice(0, 30));
  return `objet {${champs.join(', ')}}`;
}

/** Cause d’un refus de `analyserStats`, en noms de champs seulement (jamais une valeur). */
export function diagnosticStats(json: unknown): string {
  if (!estObjet(json)) return `réponse ${decrireForme(json)}`;
  if (!estEntier(json.total)) return 'champ « total » absent ou invalide';
  return `réponse ${decrireForme(json)}`;
}

// Lecture de `/api/my-collection/stats`.
export function analyserStats(json: unknown): StatsLues | null {
  if (!estObjet(json) || !estEntier(json.total)) return null;
  const options = json.tagOptions;
  // Étiquettes du compte : une option illisible (couleur absente, nom vide…) est ignorée au lieu de faire échouer toute la lecture.
  // `tagOptions` ou `totalUnique` absents (réponse allégée du site) : valeurs de repli, la lecture des pages continue.
  const etiquettes: EtiquetteStats[] = [];
  for (const o of (Array.isArray(options) ? options : []).slice(0, MAX_ETIQUETTES_COMPTE)) {
    if (!estObjet(o) || !estTexte(o.id, MAX_ID) || !estTexte(o.name) || !estEntier(o.cardCount)) continue;
    etiquettes.push({ id: o.id, nom: o.name, couleur: estTexte(o.color, 50) ? o.color : '', nbCartes: o.cardCount });
  }
  return { total: json.total, totalUnique: estEntier(json.totalUnique) ? json.totalUnique : null, etiquettes };
}

// Un exemplaire de `collection`, converti ; null si sa forme est inattendue.
function convertirExemplaire(brut: unknown): CarteLue | null {
  if (!estObjet(brut) || !estTexte(brut.id, MAX_ID) || !estTexte(brut.card_id, MAX_ID)) return null;
  if (!Number.isSafeInteger(brut.count) || (brut.count as number) < 1 || typeof brut.starred !== 'boolean') return null;
  if (!Array.isArray(brut.tags) || brut.tags.length > MAX_ETIQUETTES) return null;
  const carte = brut.card;
  if (!estObjet(carte) || typeof carte.rarity !== 'string' || !RARETES.includes(carte.rarity)) return null;
  if (!estTexte(carte.wikipedia_title)) return null;

  const etiquettesSite: string[] = [];
  for (const t of brut.tags) {
    if (!estObjet(t) || !estTexte(t.name)) return null;
    if (!etiquettesSite.includes(t.name)) etiquettesSite.push(t.name);
  }
  return {
    id: identifiantCarte(carte.rarity, carte.wikipedia_title),
    titre: carte.wikipedia_title,
    rarete: carte.rarity,
    cardId: brut.card_id,
    idsSite: [brut.id],
    quantite: brut.count as number,
    favori: brut.starred,
    etiquettesSite,
  };
}

// Dates d’ajout lisibles (au moins 1 ; une page d’un seul exemplaire ne peut pas contredire l’ordre) et non croissantes : l’ordre « plus récent d’abord » est confirmé.
function dateDecroissante(brut: unknown[]): boolean {
  const dates: number[] = [];
  for (const e of brut) {
    if (!estObjet(e) || typeof e.obtained_at !== 'string') return false;
    const t = Date.parse(e.obtained_at);
    if (Number.isNaN(t)) return false;
    dates.push(t);
  }
  return dates.length >= 1 && dates.every((t, i) => i === 0 || dates[i - 1]! >= t);
}

// Lecture d'une page de `/api/my-collection`. `collection: []` signale la fin du parcours.
// Les exemplaires d'une même carte (même identifiant local) sont regroupés.
export function analyserPage(json: unknown): PageLue | null {
  if (!estObjet(json) || !Array.isArray(json.collection)) return null;
  if (json.collection.length === 0) return { cartes: [], ignorees: 0, fin: true, lignes: 0, recentDabord: false };

  const parId = new Map<string, CarteLue>();
  let ignorees = 0;
  for (const brut of json.collection) {
    const lue = convertirExemplaire(brut);
    if (!lue) {
      ignorees += 1;
      continue;
    }
    const existante = parId.get(lue.id);
    if (!existante) {
      parId.set(lue.id, lue);
      continue;
    }
    for (const id of lue.idsSite) if (!existante.idsSite.includes(id)) existante.idsSite.push(id);
    for (const nom of lue.etiquettesSite) if (!existante.etiquettesSite.includes(nom)) existante.etiquettesSite.push(nom);
    existante.quantite += lue.quantite;
    existante.favori = existante.favori || lue.favori;
  }
  return { cartes: [...parId.values()], ignorees, fin: false, lignes: json.collection.length, recentDabord: dateDecroissante(json.collection) };
}

// Lecture de `/api/marketplace/mine` : enchères du joueur en cours et plafond du site.
export function analyserVentes(json: unknown): { enCours: number; max: number } | null {
  if (!estObjet(json) || !estEntier(json.maxConcurrentAuctions)) return null;
  // Rien en vente : le site peut omettre le compteur (ou le mettre à null) ; c’est « 0 vente en cours », pas une erreur.
  if (json.sellingCount === undefined || json.sellingCount === null) return { enCours: 0, max: json.maxConcurrentAuctions };
  if (!estEntier(json.sellingCount)) return null;
  return { enCours: json.sellingCount, max: json.maxConcurrentAuctions };
}

/**
 * Moyenne des ventes récentes d’une rareté, pour la nouvelle forme de réponse du site (2026-11-21) : plus de `summary`,
 * seulement `recent` (les dernières ventes : `final_price`, `settled_at`, `rarity`). `null` si `recent` n’est pas une liste ;
 * 0 vente pour la rareté = `{ ventes: 0 }`.
 */
function moyenneRecente(json: unknown, rarete: string): { ventes: number; moyenne: number } | null {
  if (!estObjet(json) || !Array.isArray(json.recent)) return null;
  const prix: number[] = [];
  for (const vente of json.recent) {
    if (!estObjet(vente) || vente.rarity !== rarete) continue;
    if (estEntier(vente.final_price)) prix.push(vente.final_price);
  }
  if (prix.length === 0) return { ventes: 0, moyenne: 0 };
  return { ventes: prix.length, moyenne: Math.round(prix.reduce((a, b) => a + b, 0) / prix.length) };
}

/** Tendance d’une rareté sur 4 semaines, telle que la fenêtre « Mettre aux enchères » du site l’affiche. */
export interface TendancePrix {
  /** Variation en % du prix moyen de la semaine par rapport à la semaine d’avant (null si pas de semaine d’avant). */
  variationPct: number | null;
  /** Fourchette des prix finaux sur les 4 dernières semaines. */
  min4: number;
  max4: number;
  /** Nombre de ventes sur ces 4 semaines. */
  ventes4: number;
}

const SEMAINE_MS = 7 * 24 * 3600 * 1000;
const debutDeSemaine = (maintenant: number): number => {
  const d = new Date(maintenant);
  const jour = (d.getUTCDay() + 6) % 7; // lundi = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - jour);
};

interface Historique { moyenne: number; tendance: TendancePrix }

/**
 * Lecture de `/api/marketplace/cards/<card_id>/price-history` (relevée le 2026-11-21) :
 * `{ computed_at, by_rarity: { <rareté>: { weekly: [{ start, avg, min, max, count }], monthly: [...] } } }`.
 * Prix moyen de la semaine = dernière semaine des 4 dernières (semaine en cours comprise) ; variation = contre la semaine
 * d’avant si elle existe ; fourchette = plus bas et plus haut sur ces 4 semaines. `undefined` : forme illisible ;
 * `null` : lisible mais aucune vente sur 4 semaines pour la rareté.
 */
function lireHistorique(json: unknown, rarete: string, maintenant: number): Historique | null | undefined {
  if (!estObjet(json) || !estObjet(json.by_rarity)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(json.by_rarity, rarete)) return null;
  const entree = json.by_rarity[rarete];
  if (!estObjet(entree) || !Array.isArray(entree.weekly)) return undefined;
  const debutCourante = debutDeSemaine(maintenant);
  const semaines = new Map<number, { avg: number; min: number; max: number; count: number }>();
  for (const w of entree.weekly) {
    if (!estObjet(w) || typeof w.start !== 'string') return undefined;
    const t = Date.parse(`${w.start}T00:00:00Z`);
    if (Number.isNaN(t) || !estEntier(w.avg) || !estEntier(w.min) || !estEntier(w.max) || !estEntier(w.count)) return undefined;
    semaines.set(t, { avg: w.avg, min: w.min, max: w.max, count: w.count });
  }
  const fenetre = [...semaines.entries()].filter(([t]) => t >= debutCourante - 3 * SEMAINE_MS && t <= debutCourante).sort((a, b) => a[0] - b[0]);
  if (fenetre.length === 0) return null;
  const [debutRef, ref] = fenetre[fenetre.length - 1];
  const avant = semaines.get(debutRef - SEMAINE_MS);
  const variationPct = avant && avant.avg > 0 ? Math.round(((ref.avg - avant.avg) / avant.avg) * 1000) / 10 : null;
  return {
    moyenne: ref.avg,
    tendance: {
      variationPct,
      min4: Math.min(...fenetre.map(([, w]) => w.min)),
      max4: Math.max(...fenetre.map(([, w]) => w.max)),
      ventes4: fenetre.reduce((n, [, w]) => n + w.count, 0),
    },
  };
}

/** Tendance de la rareté (`null` si la réponse n’est pas un historique lisible ou sans vente sur 4 semaines). */
export function analyserTendance(json: unknown, rarete: string, maintenant: number): TendancePrix | null {
  const h = lireHistorique(json, rarete, maintenant);
  return h ? h.tendance : null;
}

// Valeur marchande de la rareté demandée : `price-history` (prix moyen de la semaine) ; repli sur l’ancienne forme
// `summary`, puis sur la moyenne des ventes récentes (`sales`, 2026-11-21).
export function analyserPrix(json: unknown, rarete: string, maintenant: number = Date.now()): number | null {
  const h = lireHistorique(json, rarete, maintenant);
  if (h !== undefined) return h ? h.moyenne : null;
  if (estObjet(json) && !estObjet(json.summary)) {
    const recent = moyenneRecente(json, rarete);
    return recent && recent.ventes > 0 ? recent.moyenne : null;
  }
  if (!estObjet(json) || !estObjet(json.summary)) return null;
  if (!Object.prototype.hasOwnProperty.call(json.summary, rarete)) return null;
  const entree = json.summary[rarete];
  if (!estObjet(entree) || !estEntier(entree.average)) return null;
  return entree.average;
}

/**
 * Sens d’une réponse de prix : `valeur` (moyenne lue), `aucune-vente` (le site répond normalement mais la rareté n’a pas
 * d’historique : c’est une vraie absence, pas une erreur) ou `vide` (corps absent, `summary` manquant ou illisible :
 * souvent une limitation de débit, à redemander plus tard sans rien mémoriser).
 */
export type SensPrix = 'valeur' | 'aucune-vente' | 'vide';

export function sensDuPrix(json: unknown, rarete: string, maintenant: number = Date.now()): SensPrix {
  const h = lireHistorique(json, rarete, maintenant);
  if (h !== undefined) return h ? 'valeur' : 'aucune-vente';
  if (estObjet(json) && !estObjet(json.summary)) {
    const recent = moyenneRecente(json, rarete);
    if (recent) return recent.ventes > 0 ? 'valeur' : 'aucune-vente';
  }
  if (!estObjet(json) || !estObjet(json.summary)) return 'vide';
  if (!Object.prototype.hasOwnProperty.call(json.summary, rarete)) return 'aucune-vente';
  const entree = json.summary[rarete];
  if (!estObjet(entree)) return 'vide';
  if (entree.average === undefined || entree.average === null) return 'aucune-vente';
  return estEntier(entree.average) ? 'valeur' : 'vide';
}
