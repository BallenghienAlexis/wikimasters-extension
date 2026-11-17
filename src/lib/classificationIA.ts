// Classement des cartes sans thème fiable par l’API Claude (décision d’Alexis, 2026-11-15) : logique pure.
// Prompt générique et fixe, réponse JSON validée strictement (1 à 4 thèmes du catalogue), cache persistant par titre.
// Aucun appel réseau ici : l’exécuteur est `src/app/classerIA.ts`. Aucune clé n’est lue ni stockée dans ce module.
import type { Carte } from './collection';
import { DEFINITIONS_THEMES, MAX_THEMES_PAR_CARTE } from './themes';

/** Modèle utilisé : le plus économique de la famille, suffisant pour classer un titre dans un catalogue fermé. */
export const MODELE_IA = 'claude-haiku-5-5';
export const URL_API_IA = 'https://api.anthropic.com/v1/messages';
export const VERSION_API_IA = '2023-06-01';
/** Cartes par requête : assez pour amortir le prompt, assez peu pour garder une réponse courte et vérifiable. */
export const TAILLE_LOT_IA = 40;
const MAX_DESCRIPTION = 200;
const MAX_SORTIE_PAR_CARTE = 40;

/** Estimation de tarif (dollars par million de jetons), à vérifier sur la console Anthropic : elle ne sert qu’à annoncer un ordre de grandeur. */
export const PRIX_ENTREE_MTOK = 1;
export const PRIX_SORTIE_MTOK = 5;

/** Thèmes que l’IA peut attribuer : tout le catalogue, sauf « autres ». */
export const IDS_CATALOGUE_IA: readonly string[] = DEFINITIONS_THEMES.map((t) => t.id);
const ENSEMBLE_IDS = new Set(IDS_CATALOGUE_IA);

/** Prompt système : fixe et générique, donc identique d’un lot à l’autre (résultats reproductibles). */
export const PROMPT_SYSTEME = [
  'Tu classes des cartes d’un jeu de collection dont chaque carte porte le titre d’un article de Wikipédia (personne, œuvre, lieu, objet, notion, animal…).',
  `Pour chaque carte, choisis de 1 à ${MAX_THEMES_PAR_CARTE} thèmes parmi le catalogue ci-dessous, du plus caractéristique au moins caractéristique.`,
  'Règles : réponds d’après le sens du sujet (ce qu’il est, ce qu’il fait), pas d’après les mots du titre ; choisis le thème le plus précis qui existe (« Moto » plutôt que « Véhicule ») ;',
  'n’ajoute pas un thème parent en plus de son thème précis ; n’invente aucun identifiant ; si tu ne reconnais pas le sujet, réponds une liste vide pour cette carte.',
  'Format de réponse : uniquement un objet JSON, sans texte autour, dont les clés sont les numéros des cartes et les valeurs des listes d’identifiants. Exemple : {"1":["moto"],"2":["litterature","histoire"],"3":[]}',
  `Catalogue (identifiant : libellé) :\n${DEFINITIONS_THEMES.map((t) => `${t.id} : ${t.libelle.replace(/^#/, '')}`).join('\n')}`,
].join('\n');

export interface CarteAClasser {
  titre: string;
  description: string;
}

/** Cache : un résultat par titre de carte, sans expiration (une entrée dont un identifiant a quitté le catalogue est écartée à la lecture). */
export interface CacheIA {
  version: 1;
  modele: string;
  /** titre → thèmes ; une liste vide veut dire « l’IA n’a pas reconnu le sujet » (jamais redemandé tout seul). */
  entrees: Record<string, string[]>;
}

export const cacheIAVide = (): CacheIA => ({ version: 1, modele: MODELE_IA, entrees: Object.create(null) as Record<string, string[]> });

export function validerCacheIA(brut: unknown): CacheIA | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const o = brut as Record<string, unknown>;
  if (o['version'] !== 1 || typeof o['modele'] !== 'string') return null;
  const entrees = o['entrees'];
  if (typeof entrees !== 'object' || entrees === null || Array.isArray(entrees)) return null;
  const propres = Object.create(null) as Record<string, string[]>;
  // Une entrée invalide (identifiant retiré du catalogue, par exemple) est écartée seule : le reste du cache, payé, est gardé.
  for (const [titre, ids] of Object.entries(entrees)) {
    if (!Array.isArray(ids) || ids.length > MAX_THEMES_PAR_CARTE || !ids.every((id) => typeof id === 'string' && ENSEMBLE_IDS.has(id))) continue;
    propres[titre] = [...new Set(ids as string[])];
  }
  return { version: 1, modele: o['modele'], entrees: propres };
}

/** Titre → thèmes, pour la surcouche de `themes.ts` (les listes vides sont ignorées). */
export function themesIAParTitre(cache: CacheIA): ReadonlyMap<string, readonly string[]> {
  return new Map(Object.entries(cache.entrees).filter(([, ids]) => ids.length > 0));
}

/**
 * Cartes à envoyer : reliées au site, sans thème fiable avec les seuls moyens locaux, absentes du cache, une fois par titre.
 * `sansTheme` est injecté (c’est `themesPrincipaux(carte).length === 0` sans la surcouche IA) pour garder ce module sans état.
 */
export function cartesAClasser(cartes: readonly Carte[], cache: CacheIA, sansTheme: (c: Carte) => boolean): CarteAClasser[] {
  const vus = new Set<string>();
  const liste: CarteAClasser[] = [];
  for (const c of cartes) {
    if (c.idsSite === null || vus.has(c.titre) || Object.hasOwn(cache.entrees, c.titre) || !sansTheme(c)) continue;
    vus.add(c.titre);
    liste.push({ titre: c.titre, description: c.description });
  }
  return liste;
}

export const decouperEnLotsIA = (cartes: readonly CarteAClasser[]): CarteAClasser[][] => {
  const lots: CarteAClasser[][] = [];
  for (let i = 0; i < cartes.length; i += TAILLE_LOT_IA) lots.push(cartes.slice(i, i + TAILLE_LOT_IA));
  return lots;
};

const nettoyer = (s: string, max: number): string => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** Corps de la requête pour un lot : seuls le titre et la description publique de chaque carte sont envoyés. */
export function corpsRequete(lot: readonly CarteAClasser[]): { model: string; max_tokens: number; system: string; messages: { role: 'user'; content: string }[] } {
  const lignes = lot.map((c, i) => `${i + 1}. ${nettoyer(c.titre, 120)}${c.description.trim() === '' ? '' : ` — ${nettoyer(c.description, MAX_DESCRIPTION)}`}`);
  return {
    model: MODELE_IA,
    max_tokens: 200 + lot.length * MAX_SORTIE_PAR_CARTE,
    system: PROMPT_SYSTEME,
    messages: [{ role: 'user', content: `Cartes à classer :\n${lignes.join('\n')}` }],
  };
}

/**
 * Lit la réponse de l’API : texte JSON `{"1":["moto"],…}`. Chaque entrée est validée (identifiants du catalogue, 4 au plus,
 * sans doublon) ; une entrée invalide ou absente est ignorée, jamais devinée. Renvoie titre → thèmes pour les entrées lues.
 */
export function lireReponseIA(reponse: unknown, lot: readonly CarteAClasser[]): Map<string, string[]> {
  const resultat = new Map<string, string[]>();
  if (typeof reponse !== 'object' || reponse === null) return resultat;
  const contenu = (reponse as Record<string, unknown>)['content'];
  if (!Array.isArray(contenu)) return resultat;
  const texte = contenu
    .map((b) => (typeof b === 'object' && b !== null && (b as Record<string, unknown>)['type'] === 'text' ? (b as Record<string, unknown>)['text'] : ''))
    .filter((t): t is string => typeof t === 'string')
    .join('');
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut === -1 || fin <= debut) return resultat;
  let json: unknown;
  try {
    json = JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    return resultat;
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return resultat;
  for (const [cle, ids] of Object.entries(json)) {
    const rang = Number(cle);
    const carte = Number.isInteger(rang) ? lot[rang - 1] : undefined;
    if (!carte || !Array.isArray(ids)) continue;
    const propres = [...new Set(ids)].filter((id): id is string => typeof id === 'string' && ENSEMBLE_IDS.has(id));
    // Un identifiant inconnu rend l’entrée douteuse : on l’ignore plutôt que de garder une part de réponse.
    if (propres.length !== new Set(ids).size || propres.length > MAX_THEMES_PAR_CARTE) continue;
    resultat.set(carte.titre, propres);
  }
  return resultat;
}

export function ajouterAuCache(cache: CacheIA, resultats: ReadonlyMap<string, readonly string[]>): CacheIA {
  const entrees = Object.assign(Object.create(null) as Record<string, string[]>, cache.entrees);
  for (const [titre, ids] of resultats) entrees[titre] = [...ids];
  return { ...cache, entrees };
}

export interface EstimationIA {
  cartes: number;
  requetes: number;
  jetonsEntree: number;
  jetonsSortie: number;
  /** Coût en dollars (ordre de grandeur). */
  cout: number;
}

/** Ordre de grandeur du coût avant lancement (3 caractères par jeton en français, réponse d’environ 15 jetons par carte). */
export function estimerCout(cartes: readonly CarteAClasser[]): EstimationIA {
  const lots = decouperEnLotsIA(cartes);
  let jetonsEntree = 0;
  let jetonsSortie = 0;
  for (const lot of lots) {
    const corps = corpsRequete(lot);
    jetonsEntree += Math.ceil((corps.system.length + (corps.messages[0]?.content.length ?? 0)) / 3);
    jetonsSortie += lot.length * 15 + 10;
  }
  const cout = (jetonsEntree * PRIX_ENTREE_MTOK + jetonsSortie * PRIX_SORTIE_MTOK) / 1_000_000;
  return { cartes: cartes.length, requetes: lots.length, jetonsEntree, jetonsSortie, cout };
}

/** Cartes par fichier d’export : une réponse d’IA tient en un seul bloc de code JSON (≈ 20 tokens par carte). */
export const CARTES_PAR_FICHIER_EXPORT = 150;

export interface FichierExport {
  nom: string;
  contenu: string;
}

const contenuExport = (cartes: readonly CarteAClasser[], debut: number): string =>
  // Le fichier porte son propre prompt : il suffit de le transférer tel quel dans un chat IA, qui renvoie un JSON { titre: [thèmes] }.
  JSON.stringify({ prompt: PROMPT_EXPORT, cartes: cartes.map((c, i) => ({ id: debut + i + 1, titre: nettoyer(c.titre, 120), description: nettoyer(c.description, MAX_DESCRIPTION) })) }, null, 1);

/** Fichier d’export pour classer hors de l’extension (abonnement Claude, par exemple) : titre et description courte, rien d’autre. */
export function exporterCartesAClasser(cartes: readonly CarteAClasser[]): string {
  return contenuExport(cartes, 0);
}

/** Un fichier par tranche de 150 cartes (`cartes-sans-theme-1-sur-4.json`…) : chaque fichier donne une réponse d’IA complète et unique. */
export function exporterEnFichiers(cartes: readonly CarteAClasser[], taille = CARTES_PAR_FICHIER_EXPORT): FichierExport[] {
  if (cartes.length <= taille) return [{ nom: 'cartes-sans-theme.json', contenu: contenuExport(cartes, 0) }];
  const total = Math.ceil(cartes.length / taille);
  return Array.from({ length: total }, (_, n) => ({ nom: `cartes-sans-theme-${n + 1}-sur-${total}.json`, contenu: contenuExport(cartes.slice(n * taille, (n + 1) * taille), n * taille) }));
}

/** Objets JSON de premier niveau d’un texte (accolades équilibrées, chaînes respectées) : tolère texte autour et blocs de code. */
function objetsJson(texte: string): { objets: unknown[]; illisibles: number } {
  const objets: unknown[] = [];
  let illisibles = 0;
  let profondeur = 0;
  let debut = -1;
  let dansChaine = false;
  let echappe = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === '\\') echappe = true;
      else if (c === '"') dansChaine = false;
    } else if (c === '"' && profondeur > 0) dansChaine = true;
    else if (c === '{') {
      if (profondeur === 0) debut = i;
      profondeur++;
    } else if (c === '}' && profondeur > 0) {
      profondeur--;
      if (profondeur === 0) {
        try {
          objets.push(JSON.parse(texte.slice(debut, i + 1)));
        } catch {
          illisibles++; // morceau illisible : compté, jamais deviné
        }
      }
    }
  }
  if (profondeur > 0) illisibles++; // objet jamais refermé (réponse coupée)
  return { objets, illisibles };
}

export type LectureImport = { type: 'ok'; resultats: Map<string, string[]>; ignores: number } | { type: 'invalide'; raison: string };

/** Clé de comparaison d’un titre : une IA remplace souvent l’apostrophe droite par ’, change les espaces ou la casse. */
const cleTitre = (t: string): string => t.normalize('NFC').replace(/[’‘ʼ`´]/g, '\'').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();

/**
 * Valide une réponse `{ "titre": ["theme", …] }` classée hors de l’extension : 1 à 4 identifiants du catalogue par carte, sans doublon.
 * `titresConnus` limite l’import aux cartes réellement sans thème ; une entrée invalide est comptée dans `ignores`, jamais devinée.
 * Le titre est retrouvé malgré l’apostrophe, la casse ou la coupe à 120 caractères de l’export ; un identifiant est accepté en minuscules sans espace.
 */
export function lireImportThemes(texte: string, titresConnus: ReadonlySet<string>): LectureImport {
  // Réponse d’un chat IA : JSON pur, ou entouré de texte / d’un bloc ```json, ou en plusieurs objets (un par lot) fusionnés.
  const lu = objetsJson(texte);
  const objets = lu.objets.filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o));
  if (objets.length === 0) return { type: 'invalide', raison: 'Aucun objet JSON { "titre": ["thème", …] } trouvé dans le texte.' };
  const json = Object.create(null) as Record<string, unknown>;
  for (const o of objets) for (const [k, v] of Object.entries(o)) json[k] = v;
  const parCle = new Map<string, string>();
  const ambigues = new Set<string>();
  const noter = (cle: string, t: string): void => {
    const deja = parCle.get(cle);
    if (deja !== undefined && deja !== t) ambigues.add(cle);
    else parCle.set(cle, t);
  };
  for (const t of titresConnus) {
    noter(cleTitre(t), t);
    noter(cleTitre(nettoyer(t, 120)), t);
  }
  for (const cle of ambigues) parCle.delete(cle); // deux cartes pour une même clé : l’entrée est ignorée, jamais devinée
  const resultats = new Map<string, string[]>();
  let ignores = lu.illisibles;
  for (const [cle, brut] of Object.entries(json)) {
    const titre = titresConnus.has(cle) ? cle : parCle.get(cleTitre(cle));
    const liste = typeof brut === 'string' ? [brut] : brut;
    const ids = Array.isArray(liste) ? liste.map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : id)) : [];
    const uniques = [...new Set(ids)];
    const valide = titre !== undefined && uniques.length >= 1 && uniques.length <= MAX_THEMES_PAR_CARTE && uniques.every((id) => typeof id === 'string' && ENSEMBLE_IDS.has(id));
    if (valide) resultats.set(titre, uniques as string[]);
    else ignores++;
  }
  return resultats.size === 0 ? { type: 'invalide', raison: 'Aucune entrée valide (titres inconnus, thèmes hors liste ou plus de 4 thèmes).' } : { type: 'ok', resultats, ignores };
}

/**
 * Prompt à coller dans un abonnement Claude pour classer le fichier exporté : le même catalogue que `PROMPT_SYSTEME`, des règles propres à l’export : les clés de la réponse sont les titres exacts et une carte non reconnue est omise (jamais de liste vide ni de thème deviné).
 * `docs/classement-par-ia.md` en contient le texte exact (test de synchronisation).
 */
export const PROMPT_EXPORT = [
  'Tu classes des cartes d’un jeu de collection dont chaque carte porte le titre d’un article de Wikipédia (personne, œuvre, lieu, objet, notion, animal…). Tu reçois un fichier avec une liste "cartes" (id, titre, description courte).',
  `Pour chaque carte, choisis de 1 à ${MAX_THEMES_PAR_CARTE} thèmes parmi le catalogue ci-dessous, du plus caractéristique au moins caractéristique.`,
  'Règles : appuie-toi sur la description quand il y en a une, puis sur ce que le sujet est réellement (pas sur les mots du titre) ; choisis le thème le plus précis qui existe (« Moto » plutôt que « Véhicule ») ;',
  'n’ajoute pas un thème parent en plus de son thème précis ; n’invente aucun identifiant ; une liste, une année (« 2013 en Bulgarie »), une résolution, une commune ou un établissement ont un sujet : classe-les.',
  'À omettre (ne les écris pas dans la réponse) : pages d’homonymie, noms de famille, prénoms, et sujets que tu ne reconnais pas avec certitude. Ces cartes restent « à classer » dans l’extension, c’est voulu. Jamais de liste vide, jamais de thème deviné, jamais de thème « À classer » ni « Autres ».',
  'Format de réponse : ta réponse entière est UN SEUL bloc de code JSON (```json … ```), sans aucune phrase avant ou après, sans explication ni liste des cartes omises. Si tu peux créer un fichier téléchargeable, donne-le sous le nom classement.json avec le même contenu.',
  'Ce bloc est un unique objet dont les clés sont les TITRES EXACTS des cartes (champ "titre", recopié caractère pour caractère) et les valeurs des listes de 1 à 4 identifiants. Exemple : {"Honda CB 900":["moto"],"Morcilla":["gastronomie"]}.',
  'Traite toutes les cartes du fichier dans cette seule réponse (il en contient 150 au plus), sans la couper en plusieurs messages.',
  `Catalogue (identifiant : libellé) :\n${DEFINITIONS_THEMES.map((t) => `${t.id} : ${t.libelle.replace(/^#/, '')}`).join('\n')}`,
].join('\n');
