// Modèle de la collection et logique pure, sans dépendance à chrome.*.

export const VERSION_SCHEMA = 1;
export const MAX_CARTES = 50_000;
export const MAX_NOTE = 2_000;
const MAX_TITRE = 300;

export const STATUTS = ['a-trier', 'garder', 'echanger', 'vendre'] as const;
export type Statut = (typeof STATUTS)[number];

export const LIBELLES_STATUT: Record<Statut, string> = {
  'a-trier': 'À trier',
  garder: 'Garder',
  echanger: 'Échanger',
  vendre: 'Vendre',
};

export interface Carte {
  id: string;
  titre: string;
  rarete: string | null;
  quantite: number;
  url: string | null;
  // Édition locale : jamais envoyée au site.
  statut: Statut;
  prixCible: number | null;
  note: string;
}

export interface Collection {
  version: typeof VERSION_SCHEMA;
  cartes: Carte[];
}

export type EditionCarte = Partial<Pick<Carte, 'statut' | 'prixCible' | 'note'>>;

// Une carte importée : l'édition n'est présente que si le fichier la fournit.
export type CarteImportee = Omit<Carte, 'statut' | 'prixCible' | 'note'> & EditionCarte;

export type ResultatImport = { ok: true; cartes: CarteImportee[] } | { ok: false; erreur: string };

export const collectionVide = (): Collection => ({ version: VERSION_SCHEMA, cartes: [] });

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const estPrixValide = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

function analyserCarte(brut: unknown, rang: number): CarteImportee | string {
  const position = `Carte n° ${rang + 1}`;
  if (!estObjet(brut)) return `${position} : format invalide.`;

  const { id, titre, rarete, quantite, url, statut, prixCible, note } = brut;
  if (typeof id !== 'string' || id.trim() === '') return `${position} : identifiant manquant.`;
  if (typeof titre !== 'string' || titre.trim() === '') return `${position} : titre manquant.`;
  if (titre.length > MAX_TITRE) return `${position} : titre trop long.`;
  if (rarete !== undefined && rarete !== null && typeof rarete !== 'string') return `${position} : rareté invalide.`;
  if (quantite !== undefined && (!Number.isSafeInteger(quantite) || (quantite as number) < 1)) {
    return `${position} : quantité invalide.`;
  }
  if (url !== undefined && url !== null && !(typeof url === 'string' && URL.canParse(url) && new URL(url).protocol === 'https:')) {
    return `${position} : seul un lien https:// est accepté.`;
  }
  if (statut !== undefined && !STATUTS.includes(statut as Statut)) return `${position} : statut inconnu.`;
  if (prixCible !== undefined && prixCible !== null && !estPrixValide(prixCible)) return `${position} : prix cible invalide.`;
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) return `${position} : note invalide.`;

  const carte: CarteImportee = {
    id,
    titre,
    rarete: (rarete as string | null | undefined) ?? null,
    quantite: (quantite as number | undefined) ?? 1,
    url: (url as string | null | undefined) ?? null,
  };
  if (statut !== undefined) carte.statut = statut as Statut;
  if (prixCible !== undefined) carte.prixCible = prixCible as number | null;
  if (note !== undefined) carte.note = note as string;
  return carte;
}

// Valide un contenu non fiable (fichier importé ou stockage).
export function analyserImport(brut: unknown): ResultatImport {
  if (!estObjet(brut)) return { ok: false, erreur: 'Le fichier doit contenir un objet JSON.' };
  if (brut.version !== VERSION_SCHEMA) return { ok: false, erreur: `Version de fichier non prise en charge (attendue : ${VERSION_SCHEMA}).` };
  if (!Array.isArray(brut.cartes)) return { ok: false, erreur: 'La liste « cartes » est absente.' };
  if (brut.cartes.length > MAX_CARTES) return { ok: false, erreur: `Trop de cartes (maximum : ${MAX_CARTES}).` };

  const cartes: CarteImportee[] = [];
  const ids = new Set<string>();
  for (const [rang, element] of brut.cartes.entries()) {
    const carte = analyserCarte(element, rang);
    if (typeof carte === 'string') return { ok: false, erreur: carte };
    if (ids.has(carte.id)) return { ok: false, erreur: `Carte n° ${rang + 1} : identifiant en double.` };
    ids.add(carte.id);
    cartes.push(carte);
  }
  return { ok: true, cartes };
}

// Les données du jeu viennent de l'import ; l'édition locale existante est gardée
// sauf si le fichier en fournit une. Les cartes absentes du fichier restent en place.
export function fusionnerImport(collection: Collection, importees: CarteImportee[]): Collection {
  const parId = new Map(collection.cartes.map((c) => [c.id, c]));
  for (const importee of importees) {
    const existante = parId.get(importee.id);
    parId.set(importee.id, {
      statut: existante?.statut ?? 'a-trier',
      prixCible: existante?.prixCible ?? null,
      note: existante?.note ?? '',
      ...importee,
    });
  }
  return { version: VERSION_SCHEMA, cartes: [...parId.values()] };
}

export function appliquerEdition(collection: Collection, id: string, edition: EditionCarte): Collection {
  return {
    ...collection,
    cartes: collection.cartes.map((c) => (c.id === id ? { ...c, ...edition } : c)),
  };
}

export const excedent = (carte: Pick<Carte, 'quantite'>): number => Math.max(0, carte.quantite - 1);

const normaliser = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export interface Filtres {
  recherche: string;
  statut: Statut | 'tous';
  doublonsSeulement: boolean;
}

export function filtrerCartes(cartes: Carte[], filtres: Filtres): Carte[] {
  const recherche = normaliser(filtres.recherche.trim());
  return cartes.filter(
    (c) =>
      (filtres.statut === 'tous' || c.statut === filtres.statut) &&
      (!filtres.doublonsSeulement || excedent(c) > 0) &&
      (recherche === '' || normaliser(c.titre).includes(recherche)),
  );
}

export interface Resume {
  exemplaires: number;
  doublons: number;
  parStatut: Record<Statut, number>;
}

export function resumer(cartes: Carte[]): Resume {
  const resume: Resume = {
    exemplaires: 0,
    doublons: 0,
    parStatut: { 'a-trier': 0, garder: 0, echanger: 0, vendre: 0 },
  };
  for (const carte of cartes) {
    resume.exemplaires += carte.quantite;
    resume.doublons += excedent(carte);
    resume.parStatut[carte.statut] += 1;
  }
  return resume;
}
