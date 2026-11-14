// Modèle de la collection et logique pure, sans dépendance à chrome.*.

// Schéma de stockage (v2 : identifiants d’exemplaires du site ; v3 : étiquettes lues sur le site).
export const VERSION_SCHEMA = 3;
const MAX_ID_SITE = 200;
const MAX_ETIQUETTES_SITE = 100;
const MAX_ETIQUETTE_SITE = 300;
export const MAX_CARTES = 50_000;
export const MAX_NOTE = 2_000;
const MAX_TITRE = 300;

export const STATUTS = ['a-trier', 'garder', 'echanger', 'vendre', 'en-vente', 'defausser'] as const;
export type Statut = (typeof STATUTS)[number];

export const LIBELLES_STATUT: Record<Statut, string> = {
  'a-trier': 'À trier',
  garder: 'Garder',
  echanger: 'Échanger',
  vendre: 'Vendre',
  'en-vente': 'En vente',
  defausser: 'Défausser',
};

export type DecidePar = 'moi' | 'assistant' | null;

export interface Carte {
  id: string;
  titre: string;
  rarete: string | null;
  description: string;
  quantite: number;
  url: string | null;
  // Sur le site, un favori est verrouillé : ni défausse, ni vente, ni échange.
  favori: boolean;
  // Identifiants d’exemplaires sur le site (`user_card_id`) ; null = inconnu, jamais un tableau vide.
  idsSite: string[] | null;
  // Noms des étiquettes posées sur la carte sur le site (lecture seule, jamais envoyée) ; [] = aucune ou inconnu.
  etiquettesSite: string[];
  // Édition locale : jamais envoyée au site.
  statut: Statut;
  prixCible: number | null;
  note: string;
  ami: string | null;
  // Moyenne du marché, relevée quand le joueur ouvre « Mettre aux enchères », ou saisie à la main.
  valeurMarchande: number | null;
  // « moi » : l'assistant de tri ne remplace jamais cette décision.
  decidePar: DecidePar;
}

/** Vrai si la carte porte une édition locale du joueur (jamais à perdre en silence). */
export const aEditionLocale = (c: Carte): boolean =>
  c.decidePar !== null || c.note !== '' || c.prixCible !== null || c.ami !== null || c.statut !== 'a-trier';

export interface Collection {
  version: typeof VERSION_SCHEMA;
  cartes: Carte[];
}

export type EditionCarte = Partial<Pick<Carte, 'statut' | 'prixCible' | 'note' | 'ami' | 'decidePar' | 'valeurMarchande'>>;

// Une carte lue sur le site : l'édition locale n'est présente que si la lecture la fournit.
export type CarteLueSite = Omit<Carte, 'idsSite' | 'etiquettesSite' | 'statut' | 'prixCible' | 'note' | 'favori' | 'description' | 'ami' | 'decidePar' | 'valeurMarchande'> &
  EditionCarte & { favori?: boolean; description?: string };

export type ResultatStockage = { ok: true; collection: Collection } | { ok: false; erreur: string };

export const collectionVide = (): Collection => ({ version: VERSION_SCHEMA, cartes: [] });

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const estPrixValide = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

export const estIdSiteValide = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_SITE;

const idsSiteValides = (ids: unknown[]): boolean => ids.length > 0 && ids.every(estIdSiteValide) && new Set(ids).size === ids.length;

const etiquettesSiteValides = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= MAX_ETIQUETTES_SITE && v.every((e) => typeof e === 'string' && e.trim() !== '' && e.length <= MAX_ETIQUETTE_SITE);

interface CarteLue {
  carte: CarteLueSite;
  idsSite: string[] | null;
  etiquettesSite: string[];
}

function analyserCarte(brut: unknown, rang: number): CarteLue | string {
  const position = `Carte n° ${rang + 1}`;
  if (!estObjet(brut)) return `${position} : format invalide.`;

  const { id, titre, rarete, description, quantite, url, favori, statut, prixCible, note, ami, decidePar, valeurMarchande, idsSite, etiquettesSite } = brut;
  if (typeof id !== 'string' || id.trim() === '') return `${position} : identifiant manquant.`;
  if (typeof titre !== 'string' || titre.trim() === '') return `${position} : titre manquant.`;
  if (titre.length > MAX_TITRE) return `${position} : titre trop long.`;
  if (rarete !== undefined && rarete !== null && typeof rarete !== 'string') return `${position} : rareté invalide.`;
  // Une quantité nulle n'existe que pour une carte éditée dont le dernier exemplaire a disparu du site (`idsSite` nul).
  const minimum = idsSite === null ? 0 : 1;
  if (quantite !== undefined && (!Number.isSafeInteger(quantite) || (quantite as number) < minimum)) {
    return `${position} : quantité invalide.`;
  }
  if (url !== undefined && url !== null && !(typeof url === 'string' && URL.canParse(url) && new URL(url).protocol === 'https:')) {
    return `${position} : seul un lien https:// est accepté.`;
  }
  if (favori !== undefined && typeof favori !== 'boolean') return `${position} : favori invalide.`;
  if (statut !== undefined && !STATUTS.includes(statut as Statut)) return `${position} : statut inconnu.`;
  if (prixCible !== undefined && prixCible !== null && !estPrixValide(prixCible)) return `${position} : prix cible invalide.`;
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) return `${position} : note invalide.`;
  if (valeurMarchande !== undefined && valeurMarchande !== null && !estPrixValide(valeurMarchande)) return `${position} : valeur marchande invalide.`;
  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_NOTE)) return `${position} : description invalide.`;
  if (ami !== undefined && ami !== null && (typeof ami !== 'string' || ami.length > MAX_TITRE)) return `${position} : ami invalide.`;
  if (decidePar !== undefined && decidePar !== null && decidePar !== 'moi' && decidePar !== 'assistant') return `${position} : origine invalide.`;

  let ids: string[] | null = null;
  if (idsSite !== undefined && idsSite !== null) {
    if (!Array.isArray(idsSite) || !idsSiteValides(idsSite)) return `${position} : identifiants du site invalides.`;
    ids = idsSite as string[];
  }
  let etiquettes: string[] = [];
  if (etiquettesSite !== undefined) {
    if (!etiquettesSiteValides(etiquettesSite)) return `${position} : étiquettes du site invalides.`;
    etiquettes = etiquettesSite;
  }

  const carte: CarteLueSite = {
    id,
    titre,
    rarete: (rarete as string | null | undefined) ?? null,
    quantite: (quantite as number | undefined) ?? 1,
    url: (url as string | null | undefined) ?? null,
  };
  if (favori !== undefined) carte.favori = favori as boolean;
  if (statut !== undefined) carte.statut = statut as Statut;
  if (prixCible !== undefined) carte.prixCible = prixCible as number | null;
  if (note !== undefined) carte.note = note as string;
  if (description !== undefined) carte.description = description as string;
  if (ami !== undefined) carte.ami = ami as string | null;
  if (decidePar !== undefined) carte.decidePar = decidePar as DecidePar;
  if (valeurMarchande !== undefined) carte.valeurMarchande = valeurMarchande as number | null;
  return { carte, idsSite: ids, etiquettesSite: etiquettes };
}

function analyserCartes(brut: Record<string, unknown>): CarteLue[] | string {
  if (!Array.isArray(brut.cartes)) return 'La liste « cartes » est absente.';
  if (brut.cartes.length > MAX_CARTES) return `Trop de cartes (maximum : ${MAX_CARTES}).`;

  const lues: CarteLue[] = [];
  const ids = new Set<string>();
  for (const [rang, element] of brut.cartes.entries()) {
    const lue = analyserCarte(element, rang);
    if (typeof lue === 'string') return lue;
    if (ids.has(lue.carte.id)) return `Carte n° ${rang + 1} : identifiant en double.`;
    ids.add(lue.carte.id);
    lues.push(lue);
  }
  return lues;
}

// v1 → v3 et v2 → v3 : chaque carte garde ses champs et reçoit `idsSite: null` (v1) et `etiquettesSite: []`. Une v3 (ou un contenu inconnu) passe telle quelle.
export function migrerCollection(brut: unknown): Collection {
  if (estObjet(brut) && (brut.version === 1 || brut.version === 2) && Array.isArray(brut.cartes)) {
    const defauts = brut.version === 1 ? { idsSite: null, etiquettesSite: [] } : { etiquettesSite: [] };
    return { version: VERSION_SCHEMA, cartes: brut.cartes.map((c: unknown) => (estObjet(c) ? { ...defauts, ...c } : c)) as Carte[] };
  }
  return brut as Collection;
}

// Valide le contenu stocké (v1 et v2 migrées, ou v3). Ne lève jamais : l'appelant décide quoi faire d'une erreur.
export function analyserStockage(brut: unknown): ResultatStockage {
  if (!estObjet(brut)) return { ok: false, erreur: 'Le contenu doit être un objet JSON.' };
  if (brut.version !== 1 && brut.version !== 2 && brut.version !== VERSION_SCHEMA) {
    return { ok: false, erreur: `Version de stockage non prise en charge (attendue : 1, 2 ou ${VERSION_SCHEMA}).` };
  }
  const migre = migrerCollection(brut) as unknown as Record<string, unknown>;
  const lues = analyserCartes(migre);
  if (typeof lues === 'string') return { ok: false, erreur: lues };
  const base = fusionnerCartesLues(
    collectionVide(),
    lues.map((l) => l.carte),
  );
  const ids = new Map(lues.map((l) => [l.carte.id, l]));
  return {
    ok: true,
    collection: { version: VERSION_SCHEMA, cartes: base.cartes.map((c) => ({ ...c, idsSite: ids.get(c.id)?.idsSite ?? null, etiquettesSite: ids.get(c.id)?.etiquettesSite ?? [] })) },
  };
}

const sansPoints = (texte: string): string => texte.replace(/\s*(…|\.{3})\s*$/, '').trim();

/** Le site charge la description en deux temps (courte, puis complète) : une lecture vide ou tronquée n'efface pas la complète. */
export function meilleureDescription(actuelle: string, lue: string | undefined): string {
  if (lue === undefined) return actuelle;
  if (lue === '') return actuelle;
  if (actuelle === '') return lue;
  const debut = sansPoints(lue);
  if (actuelle.length > lue.length && actuelle.startsWith(debut)) return actuelle;
  return lue;
}

// Les données du jeu viennent de la lecture du site ; l'édition locale existante est gardée
// sauf si la lecture en fournit une ; une description vide ou tronquée n'efface pas la complète. Les cartes absentes de la lecture restent en place.
export function fusionnerCartesLues(collection: Collection, lues: CarteLueSite[]): Collection {
  const parId = new Map(collection.cartes.map((c) => [c.id, c]));
  for (const lue of lues) {
    const existante = parId.get(lue.id);
    parId.set(lue.id, {
      favori: existante?.favori ?? false,
      idsSite: existante?.idsSite ?? null,
      etiquettesSite: existante?.etiquettesSite ?? [],
      ami: existante?.ami ?? null,
      decidePar: existante?.decidePar ?? null,
      valeurMarchande: existante?.valeurMarchande ?? null,
      statut: existante?.statut ?? 'a-trier',
      prixCible: existante?.prixCible ?? null,
      note: existante?.note ?? '',
      ...lue,
      description: meilleureDescription(existante?.description ?? '', lue.description),
      // Une lecture du site ne connaît pas l'URL : elle n'efface pas celle déjà connue.
      url: lue.url ?? existante?.url ?? null,
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

// Si la carte est encore possédée, la prochaine lecture du site la rajoutera.
export function retirerCarte(collection: Collection, id: string): Collection {
  return { ...collection, cartes: collection.cartes.filter((c) => c.id !== id) };
}

// Une enchère terminée retire un exemplaire. S'il en reste, la carte garde son édition (note, ami, valeur)
// et repasse « À trier » pour que l'assistant la reclasse ; sinon elle disparaît.
export function terminerEnchere(collection: Collection, id: string): Collection {
  const carte = collection.cartes.find((c) => c.id === id);
  if (!carte || carte.quantite <= 1) return retirerCarte(collection, id);
  return appliquerEdition(
    { ...collection, cartes: collection.cartes.map((c) => (c.id === id ? { ...c, quantite: c.quantite - 1 } : c)) },
    id,
    { statut: 'a-trier', prixCible: null, decidePar: null },
  );
}

export const idsSiteDe = (carte: Pick<Carte, 'idsSite'>): string[] | null => carte.idsSite;

const avecIdsSite = (collection: Collection, id: string, ids: string[] | null): Collection => ({
  ...collection,
  cartes: collection.cartes.map((c) => (c.id === id ? { ...c, idsSite: ids } : c)),
});

// Liste vide → null ; identifiant invalide, doublon ou carte inconnue → collection inchangée.
export function definirIdsSite(collection: Collection, id: string, ids: string[]): Collection {
  if (!collection.cartes.some((c) => c.id === id)) return collection;
  if (ids.length === 0) return avecIdsSite(collection, id, null);
  if (!idsSiteValides(ids)) return collection;
  return avecIdsSite(collection, id, [...ids]);
}

export function ajouterIdSite(collection: Collection, id: string, idExemplaire: string): Collection {
  const carte = collection.cartes.find((c) => c.id === id);
  if (!carte || !estIdSiteValide(idExemplaire)) return collection;
  const actuels = carte.idsSite ?? [];
  if (actuels.includes(idExemplaire)) return collection;
  return avecIdsSite(collection, id, [...actuels, idExemplaire]);
}

export function retirerIdSite(collection: Collection, id: string, idExemplaire: string): Collection {
  const carte = collection.cartes.find((c) => c.id === id);
  if (!carte?.idsSite?.includes(idExemplaire)) return collection;
  const reste = carte.idsSite.filter((x) => x !== idExemplaire);
  return avecIdsSite(collection, id, reste.length === 0 ? null : reste);
}

export const excedent =(carte: Pick<Carte, 'quantite'>): number => Math.max(0, carte.quantite - 1);

export const normaliser = (texte: string): string =>
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
    parStatut: { 'a-trier': 0, garder: 0, echanger: 0, vendre: 0, 'en-vente': 0, defausser: 0 },
  };
  for (const carte of cartes) {
    resume.exemplaires += carte.quantite;
    resume.doublons += excedent(carte);
    resume.parStatut[carte.statut] += 1;
  }
  return resume;
}
