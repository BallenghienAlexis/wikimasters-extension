// Validation et conversion des réponses de l'API du site (lecture seule).
// Fonctions pures : ni chrome.*, ni fetch. Liste blanche des champs : rien n'est copié hors de celle-ci.
import { RARETES, identifiantCarte } from './lecteur';

const MAX_TEXTE = 300;
const MAX_ID = 200;
const MAX_ETIQUETTES = 200;

export interface EtiquetteStats {
  id: string;
  nom: string;
  couleur: string;
  nbCartes: number;
}

export interface StatsLues {
  total: number;
  totalUnique: number;
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
}

type Objet = Record<string, unknown>;

const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
const estEntier = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const estTexte = (v: unknown, max = MAX_TEXTE): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

// Lecture de `/api/my-collection/stats`.
export function analyserStats(json: unknown): StatsLues | null {
  if (!estObjet(json) || !estEntier(json.total) || !estEntier(json.totalUnique)) return null;
  const options = json.tagOptions;
  if (!Array.isArray(options) || options.length > MAX_ETIQUETTES) return null;
  const etiquettes: EtiquetteStats[] = [];
  for (const o of options) {
    if (!estObjet(o) || !estTexte(o.id, MAX_ID) || !estTexte(o.name) || !estTexte(o.color, 50) || !estEntier(o.cardCount)) return null;
    etiquettes.push({ id: o.id, nom: o.name, couleur: o.color, nbCartes: o.cardCount });
  }
  return { total: json.total, totalUnique: json.totalUnique, etiquettes };
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

// Lecture d'une page de `/api/my-collection`. `collection: []` signale la fin du parcours.
// Les exemplaires d'une même carte (même identifiant local) sont regroupés.
export function analyserPage(json: unknown): PageLue | null {
  if (!estObjet(json) || !Array.isArray(json.collection)) return null;
  if (json.collection.length === 0) return { cartes: [], ignorees: 0, fin: true };

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
  return { cartes: [...parId.values()], ignorees, fin: false };
}

// Lecture de `/api/marketplace/cards/<card_id>/sales?scope=summary` : valeur marchande de la rareté demandée.
export function analyserPrix(json: unknown, rarete: string): number | null {
  if (!estObjet(json) || !estObjet(json.summary)) return null;
  if (!Object.prototype.hasOwnProperty.call(json.summary, rarete)) return null;
  const entree = json.summary[rarete];
  if (!estObjet(entree) || !estEntier(entree.average)) return null;
  return entree.average;
}
