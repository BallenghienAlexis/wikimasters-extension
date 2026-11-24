// Synchro entre PC par dossier partagé (spec `specs/synchro-pc/spec.md`). Logique pure, sans `chrome.*` ni système de fichiers :
// chaque PC écrit son seul fichier `wm-sync-<pc>.json` (une sauvegarde complète) et fusionne ceux des autres.
import { appliquerImport, creerSauvegarde, lireSauvegarde, serialiserSauvegarde, type Donnees, type PolitiqueConflit } from './sauvegarde';

/** Écriture au plus une fois par minute ; lecture des autres PC au plus toutes les 5 minutes. */
export const INTERVALLE_ECRITURE_MS = 60_000;
export const INTERVALLE_LECTURE_MS = 5 * 60_000;
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

/** Texte du fichier de ce PC à `maintenant`. */
export const instantane = (donnees: Donnees, maintenant: Date): string => serialiserSauvegarde(creerSauvegarde(donnees, maintenant));

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
 * Règle « le plus récent gagne » : un fichier plus récent que `modifieLe` (dernière modification saisie ici ; `null` = jamais, par exemple PC neuf)
 * l'emporte sur les cartes en conflit. Un fichier plus ancien laisse l'édition locale et n'ajoute aucune carte
 * (une carte vendue ou défaussée ici ne ressuscite pas) ; thèmes, amis et ventes sont toujours réunis (voir `appliquerImport`).
 * Un fichier illisible, d'un format inconnu ou déjà lu est ignoré sans rien modifier.
 */
export function fusionnerFichiersPc(locales: Donnees, fichiers: FichierPc[], monNom: string, dejaLus: Record<string, string>, modifieLe: string | null): RapportFusion {
  const ignores: FichierIgnore[] = [];
  const lus = { ...dejaLus };
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
    const plusRecent = modifieLe === null || v.creeLe > modifieLe;
    const politique: PolitiqueConflit = plusRecent ? 'remplacer' : 'garder-ici';
    const locales_ = new Set(courantes.collection.cartes.map((c) => c.id));
    const sauvegarde = plusRecent ? v.sauvegarde : { ...v.sauvegarde, cartes: v.sauvegarde.cartes.filter((c) => locales_.has(c.id)) };
    const r = appliquerImport(courantes, sauvegarde, politique);
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

function lireOk(texte: string) {
  const r = lireSauvegarde(texte);
  return r.ok ? r.sauvegarde : null;
}
