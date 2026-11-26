// Part « synchro » de la sauvegarde complète (Alexis, 2026-11-23 : « l’import doit compter comme une synchro complète
// et comme source de vérité »). Logique pure, sans `chrome.*`. Liste blanche : horodatage de la dernière synchro, relevés
// de prix (identifiant local `rareté|titre`, jamais d’identifiant d’exemplaire ni de `card_id` du site), caches de
// classement (Wikipédia, IA, Wikidata, thèmes appris). Aucun secret, aucun état de bail, de pause ou de requête.
import type { Carte } from './collection';
import { etatInitial, type EtatOrdonnanceur } from './ordonnanceur';
import { MAX_ENTREES as MAX_ENTREES_WIKIPEDIA, validerCache, type CacheWikipedia } from './wikipedia';
import { validerCacheIA, type CacheIA } from './classificationIA';
import { validerEtatAppris, type EtatAppris } from './themesAppris';
import { MAX_ENTITES_GRAPHE, validerGraphe, type GrapheWikidata } from './classesWikidata';
import { validerEtatSynchro } from './validerEtatSynchro';
import { estObjet } from './valider';
import { fusionnerActiviteJours, validerActiviteJours, type ActiviteJours } from './graphiquesTableauDeBord';
import { MAX_EVENEMENTS, validerEvenements, type EvenementVente } from './affluence';

/** Partie de l'état de l'ordonnanceur qui voyage : de quoi savoir que la collection a déjà été lue en entier. */
export type EtatSauvegarde = Pick<EtatOrdonnanceur, 'total' | 'totalUnique' | 'signatureEtiquettes' | 'derniereComplete' | 'prix'>;

/** Ce que la sauvegarde couvre côté synchro, tel qu'il vit dans le stockage. */
export interface DonneesSynchro {
  derniereSynchro: number | null;
  etat: EtatOrdonnanceur | null;
  wikipedia: CacheWikipedia;
  classementIA: CacheIA;
  themesAppris: EtatAppris;
  grapheWikidata: GrapheWikidata;
  /** Graphiques du tableau de bord (2026-11-24) : activité par jour et enchères terminées (heures de forte affluence). Facultatifs : absents des anciens fichiers. */
  activite?: ActiviteJours;
  resultatsVentes?: EvenementVente[];
}

export interface SynchroSauvegardee {
  derniereSynchro: number | null;
  etat: EtatSauvegarde | null;
  wikipedia: CacheWikipedia;
  classementIA: CacheIA;
  themesAppris: EtatAppris;
  grapheWikidata: GrapheWikidata;
  activite?: ActiviteJours;
  resultatsVentes?: EvenementVente[];
}

export function exporterSynchro(d: DonneesSynchro): SynchroSauvegardee {
  return {
    derniereSynchro: d.derniereSynchro,
    etat:
      d.etat === null
        ? null
        : { total: d.etat.total, totalUnique: d.etat.totalUnique, signatureEtiquettes: d.etat.signatureEtiquettes, derniereComplete: d.etat.derniereComplete, prix: { ...d.etat.prix } },
    wikipedia: d.wikipedia,
    classementIA: d.classementIA,
    themesAppris: d.themesAppris,
    grapheWikidata: d.grapheWikidata,
    ...(d.activite ? { activite: d.activite } : {}),
    ...(d.resultatsVentes ? { resultatsVentes: d.resultatsVentes } : {}),
  };
}

/** Valide la part « synchro » d'un fichier (absente : `undefined`, fichier d'une ancienne version) ; une erreur dit quoi corriger. */
export function lireSynchro(brut: unknown): SynchroSauvegardee | undefined | string {
  if (brut === undefined) return undefined;
  if (!estObjet(brut)) return 'L’état de synchronisation de la sauvegarde est invalide.';
  const d = brut.derniereSynchro;
  if (d !== null && !(typeof d === 'number' && Number.isSafeInteger(d) && d >= 0)) return 'La date de dernière synchronisation est invalide.';
  let etat: EtatSauvegarde | null = null;
  if (brut.etat !== null) {
    if (!estObjet(brut.etat)) return 'Les relevés de prix de la sauvegarde sont invalides.';
    const e = brut.etat;
    // Même validation que le stockage : les champs hors liste blanche sont remplacés par des valeurs neutres.
    const valide = validerEtatSynchro({ version: 1, total: e.total, totalUnique: e.totalUnique, signatureEtiquettes: e.signatureEtiquettes, derniereComplete: e.derniereComplete, arretJusqua: null, requetes: [], cardIds: {}, prix: e.prix });
    if (valide === null) return 'Les relevés de prix de la sauvegarde sont invalides.';
    // `sansVente` ne vient jamais d'un fichier : une sauvegarde modifiée ne peut pas faire défausser une carte.
    const prix = Object.create(null) as EtatSauvegarde['prix'];
    for (const [id, r] of Object.entries(valide.prix)) {
      // `v` et `sansRoute` sont gardés (2026-11-26) : sans eux, une carte sans prix était redemandée à chaque reprise du Drive ou import.
      prix[id] = {
        valeur: r.valeur,
        releveLe: r.releveLe,
        ...(r.tendance ? { tendance: r.tendance } : {}),
        ...(r.v === 2 ? { v: 2 as const } : {}),
        ...(r.sansRoute === true ? { sansRoute: true } : {}),
      };
    }
    etat = { total: valide.total, totalUnique: valide.totalUnique, signatureEtiquettes: valide.signatureEtiquettes, derniereComplete: valide.derniereComplete, prix };
  }
  const wikipedia = validerCache(brut.wikipedia);
  if (wikipedia === null) return 'Le cache Wikipédia de la sauvegarde est invalide.';
  const classementIA = validerCacheIA(brut.classementIA);
  if (classementIA === null) return 'Le cache du classement par l’IA de la sauvegarde est invalide.';
  const themesAppris = validerEtatAppris(brut.themesAppris);
  if (themesAppris === null) return 'Les thèmes appris de la sauvegarde sont invalides.';
  const grapheWikidata = validerGraphe(brut.grapheWikidata, MAX_ENTITES_GRAPHE);
  if (grapheWikidata === null) return 'Le graphe Wikidata de la sauvegarde est invalide.';
  // Facultatifs et tolérants : une partie illisible est ignorée (le graphique se reconstruit), jamais une erreur d'import.
  const activite = brut.activite === undefined ? undefined : validerActiviteJours(brut.activite);
  const resultatsVentes = brut.resultatsVentes === undefined ? undefined : validerEvenements(brut.resultatsVentes).filter((e) => e.type === 'resultat');
  return { derniereSynchro: d, etat, wikipedia, classementIA, themesAppris, grapheWikidata, ...(activite ? { activite } : {}), ...(resultatsVentes ? { resultatsVentes } : {}) };
}

const plusRecent = (a: number | null, b: number | null): number | null => (a === null ? b : b === null ? a : Math.max(a, b));

/**
 * Fusionne la synchro de la sauvegarde dans celle d'ici, sans rien écraser de plus récent :
 * - dernière synchro et lecture complète : la plus récente des deux (la suivante est donc incrémentale) ;
 * - relevé de prix : le plus récent par carte, et seulement s'il correspond à la valeur marchande finale de la carte
 *   (sinon la synchro le prendrait pour une saisie à la main) ;
 * - caches : réunis, l'entrée la plus récente (Wikipédia) ou celle d'ici (IA, Wikidata) l'emporte ;
 * - thèmes appris : ceux d'ici s'il y en a, sinon ceux de la sauvegarde.
 */
export function fusionnerSynchro(locale: DonneesSynchro, s: SynchroSauvegardee, cartes: readonly Carte[], maintenant: number = Date.now()): DonneesSynchro {
  // Un horodatage postérieur à maintenant (horloge d'un autre PC, fichier modifié) bloquerait la synchro : on le ramène à maintenant.
  const borne = (t: number): number => Math.min(t, maintenant);
  const parId = new Map(cartes.map((c) => [c.id, c]));
  let etat = locale.etat;
  if (s.etat !== null) {
    const base: EtatOrdonnanceur = locale.etat ? { ...locale.etat, prix: { ...locale.etat.prix } } : etatInitial();
    for (const [id, r] of Object.entries(prixRepris(s, parId))) {
      const ici = base.prix[id];
      const releveLe = borne(r.releveLe);
      if (ici === undefined || ici.releveLe < releveLe) {
        // Même absence de valeur ici et dans le fichier : la preuve d'absence de vente locale est gardée (le fichier n'en porte jamais).
        const garde = ici !== undefined && ici.valeur === null && r.valeur === null && ici.sansVente === true;
        base.prix[id] = { ...r, releveLe, ...(garde ? { sansVente: true, ...(ici.ancienMax !== undefined ? { ancienMax: ici.ancienMax } : {}) } : {}) };
      }
    }
    if (s.etat.derniereComplete !== null && (base.derniereComplete === null || base.derniereComplete < borne(s.etat.derniereComplete))) {
      base.total = s.etat.total;
      base.totalUnique = s.etat.totalUnique;
      base.signatureEtiquettes = s.etat.signatureEtiquettes;
      base.derniereComplete = borne(s.etat.derniereComplete);
    }
    etat = base;
  }

  const entreesWiki = Object.assign(Object.create(null) as CacheWikipedia['entrees'], locale.wikipedia.entrees);
  for (const [titre, e] of Object.entries(s.wikipedia.entrees)) {
    const ici = Object.hasOwn(entreesWiki, titre) ? entreesWiki[titre] : undefined;
    if (ici === undefined) {
      if (Object.keys(entreesWiki).length < MAX_ENTREES_WIKIPEDIA) entreesWiki[titre] = { ...e, verifieLe: borne(e.verifieLe) };
    } else if (ici.verifieLe < borne(e.verifieLe)) entreesWiki[titre] = { ...e, verifieLe: borne(e.verifieLe) };
  }

  const entreesIA: CacheIA['entrees'] = { ...s.classementIA.entrees, ...locale.classementIA.entrees };
  const graphe: GrapheWikidata = { ...locale.grapheWikidata };
  for (const [qid, e] of Object.entries(s.grapheWikidata)) {
    if (graphe[qid] === undefined && Object.keys(graphe).length < MAX_ENTITES_GRAPHE) graphe[qid] = e;
  }
  const apprisIci = locale.themesAppris.themes.length > 0 || locale.themesAppris.journal.length > 0;

  return {
    derniereSynchro: plusRecent(locale.derniereSynchro, s.derniereSynchro === null ? null : borne(s.derniereSynchro)),
    etat,
    wikipedia: { version: 1, entrees: { ...entreesWiki } },
    classementIA: { version: 1, modele: locale.classementIA.modele, entrees: entreesIA },
    themesAppris: apprisIci ? locale.themesAppris : s.themesAppris,
    grapheWikidata: graphe,
    ...fusionnerGraphiques(locale, s),
  };
}

/** Activité : le plus grand compte par jour et par catégorie ; enchères terminées : union par date de mise en vente (500 au plus, les plus récentes). */
function fusionnerGraphiques(locale: DonneesSynchro, s: SynchroSauvegardee): Pick<DonneesSynchro, 'activite' | 'resultatsVentes'> {
  const sortie: Pick<DonneesSynchro, 'activite' | 'resultatsVentes'> = {};
  if (locale.activite || s.activite) sortie.activite = fusionnerActiviteJours(locale.activite ?? {}, s.activite ?? {});
  if (locale.resultatsVentes || s.resultatsVentes) {
    const parDate = new Map<number, EvenementVente>();
    for (const e of [...(s.resultatsVentes ?? []), ...(locale.resultatsVentes ?? [])]) parDate.set(e.at, e);
    sortie.resultatsVentes = [...parDate.values()].sort((a, b) => a.at - b.at).slice(-MAX_EVENEMENTS);
  }
  return sortie;
}

/** Relevés de la sauvegarde repris : la carte existe et sa valeur marchande concorde (sinon la synchro y verrait une saisie à la main). */
function prixRepris(s: SynchroSauvegardee, parId: ReadonlyMap<string, Carte>): EtatSauvegarde['prix'] {
  const repris: EtatSauvegarde['prix'] = {};
  for (const [id, r] of Object.entries(s.etat?.prix ?? {})) {
    const carte = parId.get(id);
    if (carte && carte.valeurMarchande === r.valeur) repris[id] = r;
  }
  return repris;
}

export interface ApercuSynchro {
  prixRestaures: number;
  entreesWikipedia: number;
  derniereSynchro: number | null;
}

export function apercuSynchro(locale: DonneesSynchro | undefined, s: SynchroSauvegardee, cartesFinales: readonly Carte[]): ApercuSynchro {
  const ici = locale?.etat?.prix ?? {};
  const wikiIci = locale?.wikipedia.entrees ?? {};
  return {
    prixRestaures: Object.entries(prixRepris(s, new Map(cartesFinales.map((c) => [c.id, c])))).filter(([id, r]) => ici[id] === undefined || ici[id].releveLe < r.releveLe).length,
    entreesWikipedia: Object.keys(s.wikipedia.entrees).filter((t) => wikiIci[t] === undefined).length,
    derniereSynchro: s.derniereSynchro,
  };
}
