// Synchro entre PC par dossier partagé (spec `specs/synchro-pc/spec.md`). Logique pure, sans `chrome.*` ni système de fichiers :
// chaque PC écrit son seul fichier `wm-sync-<pc>.json` (une sauvegarde complète) et fusionne ceux des autres.
import { aEditionLocale } from './collection';
import { appliquerImport, creerSauvegarde, lireSauvegarde, serialiserSauvegarde, type Donnees, type PolitiqueConflit } from './sauvegarde';

/** Écriture et lecture des autres PC au plus toutes les 15 s (Alexis, 2026-11-24 : « instantanément entre les différents PC ») ; rien n'est écrit si le contenu n'a pas changé. */
export const INTERVALLE_ECRITURE_MS = 15_000;
export const INTERVALLE_LECTURE_MS = 15_000;
/** Marque d'un fichier trop gros : il est signalé sans être lu ni chargé en mémoire. */
export const FICHIER_TROP_GROS = '\u0000trop-gros';
/** Un fichier plus gros est ignoré (la sauvegarde manuelle accepte 20 Mo). */
export const TAILLE_MAX_FICHIER_PC = 20 * 1024 * 1024;

const MOTIF_NOM = /^[a-z0-9-]{3,24}$/;
const MOTIF_FICHIER = /^wm-sync-([a-z0-9-]{3,24})\.json$/;

export const nomPcValide = (nom: string): boolean => MOTIF_NOM.test(nom);

/** Nom par défaut, sans donnée personnelle : `pc-` plus 4 caractères. `alea` renvoie un nombre dans [0, 1[. */
export function genererNomPc(alea: () => number = Math.random): string {
  const lettres = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffixe = '';
  for (let i = 0; i < 4; i += 1) suffixe += lettres[Math.floor(alea() * lettres.length) % lettres.length];
  return `pc-${suffixe}`;
}

export const nomFichierPc = (nom: string): string => `wm-sync-${nom}.json`;
/** Nom de PC d'un fichier du dossier, ou `null` si ce n'est pas un fichier de la synchro (fichiers temporaires et copies de conflit exclus). */
export const nomPcDeFichier = (fichier: string): string | null => MOTIF_FICHIER.exec(fichier)?.[1] ?? null;

/**
 * Texte du fichier de ce PC à `maintenant`. `modifieLe` (dernière saisie faite sur ce PC) est écrit à côté de la sauvegarde :
 * c'est lui, et non l'heure d'écriture, que les autres PC comparent (un PC qui réécrit son fichier sans rien saisir ne gagne pas).
 */
export function instantane(donnees: Donnees, maintenant: Date, modifieLe: string | null = null): string {
  const s = creerSauvegarde(donnees, maintenant);
  return serialiserSauvegarde(modifieLe === null ? s : ({ ...s, modifieLe } as typeof s));
}

/** Date de dernière saisie annoncée par un fichier (texte ISO), ou `null` si absente ou illisible. */
export function modifieLeDuFichier(texte: string): string | null {
  try {
    const v = (JSON.parse(texte) as { modifieLe?: unknown }).modifieLe;
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
  } catch {
    return null;
  }
}

/** Le joueur a-t-il déjà saisi quelque chose ici (note, prix cible, ami, favori ou thèmes choisis) ? */
export const aDesSaisies = (donnees: Donnees): boolean =>
  donnees.collection.cartes.some((c) => c.note !== '' || c.prixCible !== null || c.ami !== null || c.choixFavori != null || c.themesChoisis != null);

/** Contenu sans la date : deux instantanés identiques à la date près ne justifient pas une écriture (évite les va-et-vient entre PC). */
export function empreinte(texte: string): string {
  const lu = lireSauvegarde(texte);
  return lu.ok ? JSON.stringify({ ...lu.sauvegarde, creeLe: '' }) : texte;
}

/** Ce que le joueur a saisi (cartes éditées, réglages, ventes), sans les relevés du site ni la mémoire de synchro : un changement ici date une modification locale. */
export function empreinteEdition(donnees: Donnees): string {
  return JSON.stringify({
    cartes: donnees.collection.cartes.map((c) => [c.id, c.prixCible, c.note, c.ami, c.choixFavori ?? null, c.themesChoisis ?? null]),
    preferences: donnees.preferences,
    ventes: donnees.ventes.filter((e) => e.type !== 'site'),
  });
}

export interface FichierPc {
  nom: string;
  texte: string;
}

export interface FichierIgnore {
  nom: string;
  raison: string;
}

export interface RapportFusion {
  donnees: Donnees;
  /** PC dont le fichier a été fusionné, du plus ancien au plus récent. */
  fusionnes: string[];
  ignores: FichierIgnore[];
  /** Date du dernier instantané lu de chaque PC (à rendre à l'appel suivant). */
  lus: Record<string, string>;
  changements: boolean;
}

/**
 * Fusionne les fichiers des autres PC dans les données locales, du plus ancien au plus récent.
 * Règle « le plus récent gagne » : un fichier dont la dernière saisie (`modifieLe` écrit dedans, sinon sa date d'écriture) est plus récente que `modifieLe` d'ici (`null` = jamais, par exemple PC neuf)
 * l'emporte sur les cartes en conflit. Un fichier plus ancien laisse l'édition locale et n'ajoute aucune carte
 * (une carte vendue ou défaussée ici ne ressuscite pas) ; thèmes, amis et ventes sont toujours réunis (voir `appliquerImport`).
 * Un fichier illisible, d'un format inconnu ou déjà lu est ignoré sans rien modifier.
 */
export function fusionnerFichiersPc(locales: Donnees, fichiers: FichierPc[], monNom: string, dejaLus: Record<string, string>, modifieLe: string | null): RapportFusion {
  const ignores: FichierIgnore[] = [];
  const lus = { ...dejaLus };
  const texteDe = new Map(fichiers.map((f) => [f.nom, f.texte]));
  const valides: { nom: string; creeLe: string; sauvegarde: NonNullable<ReturnType<typeof lireOk>> }[] = [];
  for (const f of fichiers) {
    if (f.nom === monNom) continue;
    if (f.texte === FICHIER_TROP_GROS || f.texte.length > TAILLE_MAX_FICHIER_PC) {
      ignores.push({ nom: f.nom, raison: 'fichier trop volumineux' });
      continue;
    }
    const s = lireOk(f.texte);
    if (!s) {
      const brut = lireSauvegarde(f.texte);
      ignores.push({ nom: f.nom, raison: brut.ok ? 'illisible' : brut.erreur });
      continue;
    }
    if (dejaLus[f.nom] !== undefined && s.creeLe <= dejaLus[f.nom]!) continue;
    valides.push({ nom: f.nom, creeLe: s.creeLe, sauvegarde: s });
  }
  valides.sort((a, b) => (a.creeLe < b.creeLe ? -1 : a.creeLe > b.creeLe ? 1 : a.nom.localeCompare(b.nom, 'fr')));

  let courantes = locales;
  const fusionnes: string[] = [];
  for (const v of valides) {
    const sienne = modifieLeDuFichier(texteDe.get(v.nom) ?? '') ?? v.creeLe;
    const plusRecent = modifieLe === null || sienne > modifieLe;
    const politique: PolitiqueConflit = plusRecent ? 'remplacer' : 'garder-ici';
    const locales_ = new Set(courantes.collection.cartes.map((c) => c.id));
    // Dernière lecture complète du site de chaque côté : la plus récente fait foi sur les cartes présentes ou absentes.
    // Fichier plus frais : une carte d'ici absente du fichier a disparu du site (défaussée, vendue) ; fichier plus ancien :
    // une carte absente d'ici ne ressuscite pas, même si ses saisies sont plus récentes.
    const lectureFichier = v.sauvegarde.synchro?.etat?.derniereComplete ?? null;
    const lectureIci = courantes.synchro?.etat?.derniereComplete ?? null;
    const fichierPlusFrais = lectureFichier !== null && (lectureIci === null || lectureFichier > lectureIci);
    const iciPlusFrais = lectureIci !== null && (lectureFichier === null || lectureIci > lectureFichier);
    const nouvellesCartes = plusRecent && !iciPlusFrais;
    const sauvegarde = nouvellesCartes ? v.sauvegarde : { ...v.sauvegarde, cartes: v.sauvegarde.cartes.filter((c) => locales_.has(c.id)) };
    const avant = fichierPlusFrais ? retirerAbsentes(courantes, new Set(v.sauvegarde.cartes.map((c) => c.id))) : courantes;
    const r = appliquerImport(avant, sauvegarde, politique);
    if (!r.ok) {
      ignores.push({ nom: v.nom, raison: r.erreur });
      continue;
    }
    courantes = r.donnees;
    fusionnes.push(v.nom);
    lus[v.nom] = v.creeLe;
  }
  const date = new Date(0);
  const changements = empreinte(instantane(courantes, date)) !== empreinte(instantane(locales, date));
  return { donnees: courantes, fusionnes, ignores, lus, changements };
}

/** Plus de cartes absentes que ce seuil (10 et 10 %) : l'écart vient plutôt d'un changement de forme que de défausses, rien n'est retiré. */
const MAX_RETRAITS_MIN = 10;

/**
 * Cartes d'ici absentes d'un fichier dont la lecture du site est plus récente : défaussées ou vendues ailleurs.
 * Sans édition locale la carte disparaît ; sinon elle reste, déliée du site (comme `retirerDisparues` de la synchro). Aucune requête.
 */
export function retirerAbsentes(donnees: Donnees, presentes: ReadonlySet<string>): Donnees {
  const absentes = donnees.collection.cartes.filter((c) => !presentes.has(c.id));
  if (absentes.length === 0 || absentes.length > Math.max(MAX_RETRAITS_MIN, Math.floor(donnees.collection.cartes.length * 0.1))) return donnees;
  const ids = new Set(absentes.map((c) => c.id));
  const cartes = donnees.collection.cartes
    .filter((c) => !ids.has(c.id) || aEditionLocale(c))
    .map((c) => (ids.has(c.id) ? { ...c, idsSite: null, etiquettesSite: [] } : c));
  return { ...donnees, collection: { ...donnees.collection, cartes } };
}

function lireOk(texte: string) {
  const r = lireSauvegarde(texte);
  return r.ok ? r.sauvegarde : null;
}
