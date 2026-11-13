import { trierEtiquettesSite } from '../lib/etiquettesPreexistantes';
import { ID_CARTE_ETIQUETTES } from '../lib/actions';
import type { Action, CauseJournal, EtatExecutionV2, ErreurExecution, FamilleLot, Registre, ResultatAction } from '../lib/actions';
import type { Collection } from '../lib/collection';
import type { Journal } from '../lib/journal';
import { DUREE_BAIL_MS } from '../lib/ordonnanceur';
import { SUPPLEMENT_MAX_MS, creerFile, type ContexteErreur, type ContexteJournal, type File as FileLot, type SuiteExecution } from '../lib/file';
import { familleDe } from '../lib/familles';
import { ajouterIgnoree } from '../lib/ignorees';
import { completerEntree, ouvrirEntree, passerEntree } from '../lib/journal';
import { RAISON_RESULTAT_INCONNU, calculerPauseJusqua, raisonPause, resultatInconnu } from '../lib/reprise';
import { appliquerResultat, reverifierAction } from '../lib/revision';
import {
  chargerCollection,
  chargerBailSynchro,
  chargerExecution,
  chargerIgnorees,
  chargerJournal,
  chargerPreferences,
  chargerRegistre,
  chargerEtiquettesSite,
  enregistrerEtiquettesSite,
  enregistrerCollection,
  enregistrerBailSynchro,
  enregistrerExecution,
  enregistrerIgnorees,
  enregistrerJournal,
  enregistrerRegistre,
} from '../lib/stockage';
import { avecIdEtiquette } from '../lib/registre';
import { creerExecutionReelle, horlogeReelle, type Execution } from './execution';
import type { CoupleRetrait } from './Journal';
import { SYNCHRO_EN_COURS, bilanVide, configDuLot, type Bilan } from './apercuLot';

// ───────────────────────── Exécution (câblage de la file, T-017) ─────────────────────────

/** Poses et retraits en vol en même temps. */
const CONCURRENCE_PAR_DEFAUT = 3;

interface Pont {
  idLot: string;
  bilan: Bilan;
  deconnecte: boolean;
}

export interface ContexteExecution {
  execution: Execution;
  file: FileLot;
  pont: Pont;
  /** Écritures de l’état d’exécution, enchaînées pour garder l’ordre. */
  ecritures: Promise<void>;
}

const parametreDe = (a: Action): string | null =>
  a.type === 'enchere' ? String(a.prix) : a.type === 'lecture' || a.type === 'defausse' ? null : a.nomEtiquette;

let contexte: ContexteExecution | null = null;

const titreDe = async (idCarte: string): Promise<string> =>
  (await chargerCollection()).cartes.find((c) => c.id === idCarte)?.titre ?? idCarte;

/** Entrée de journal complétée du rang, de la taille et de la famille du lot (objets simples ; `journal.ts` inchangé). */
const avecContexte = (journal: Journal, id: string, champs: ContexteJournal & { cause?: CauseJournal | null }): Journal =>
  journal.map((e) => (e.id === id ? { ...e, rang: champs.rang, total: champs.total, lot: champs.lot, cause: champs.cause ?? null } : e));

/** Erreur stockée : liste fermée de champs, jamais d’identifiant d’exemplaire (SC-007). */
async function construireErreur(c: ContexteErreur, maintenant: number): Promise<ErreurExecution> {
  return {
    type: c.action.type,
    parametre: parametreDe(c.action),
    idCarte: c.action.idCarte,
    titre: await titreDe(c.action.idCarte),
    famille: c.famille,
    indexLot: c.indexLot,
    nbLots: c.nbLots,
    rang: c.rang,
    totalLot: c.totalLot,
    codeHttp: c.codeHttp,
    cause: c.cause,
    le: maintenant,
    reussies: c.reussies,
    autresEchecsEnVol: c.autresEchecsEnVol,
  };
}

// Reprise : les restantes ne vivent qu'en mémoire (SC-017) ; après un rechargement, plus de reprise possible.
let restantesMem: Action[] = [];
let suiteMem: SuiteExecution | null = null;
let idLotMem = '';
/** « Arrêter tout » demandé pendant l'exécution : les restantes sont abandonnées à la fin. */
let abandon = false;

/**
 * Contexte unique pour toute la durée de vie de la page : une seule file, une seule exécution
 * (la file garde sa mémoire de cadence). Créé au premier besoin : dans l’effet de montage du
 * composant ou au lancement d’un lot, jamais pendant le rendu.
 */
export function contexteExecution(): ContexteExecution {
  if (contexte) return contexte;
  const execution = creerExecutionReelle();
  const pont: Pont = { idLot: '', bilan: bilanVide(), deconnecte: false };
  const file = creerFile({
    horloge: horlogeReelle,
    // Délai variable entre les requêtes (décision d’Alexis du 2026-11-11), en plus de la seconde minimale.
    delaiSupplementaire: () => Math.floor(Math.random() * (SUPPLEMENT_MAX_MS + 1)),
    // Poses et retraits d’étiquettes en parallèle, par défaut (Alexis, 2026-11-12).
    concurrence: CONCURRENCE_PAR_DEFAUT,
    transport: async (ordre) => {
      if (ordre.type !== 'pose-etiquette' && ordre.type !== 'retrait-etiquette') return execution.transport(ordre);
      // L’identifiant d’étiquette du site vient du registre, au moment d’envoyer (la création précède la pose).
      const complete = avecIdEtiquette(ordre, await chargerRegistre());
      if (complete === null) return { classe: 'echec', codeHttp: null, cause: 'action non disponible' };
      return execution.transport(complete);
    },
    reverifier: async (action) => {
      const [collection, registre, preferences] = await Promise.all([chargerCollection(), chargerRegistre(), chargerPreferences()]);
      return reverifierAction(action, collection, registre, configDuLot(preferences));
    },
    appliquer: async (action, resultat) => {
      const [collection, registre] = await Promise.all([chargerCollection(), chargerRegistre()]);
      if (action.type === 'suppression-etiquette' && resultat.classe === 'reussie') {
        // L’étiquette n’existe plus sur le site : on la retire aussi de la liste lue.
        const liste = await chargerEtiquettesSite();
        if (liste !== null) await enregistrerEtiquettesSite(liste.filter((e) => e.id !== action.idEtiquette));
      }
      const suivant = appliquerResultat(collection, registre, action, resultat);
      if (suivant.collection !== collection) await enregistrerCollection(suivant.collection);
      if (suivant.registre !== registre) await enregistrerRegistre(suivant.registre);
    },
    journal: {
      ouvrir: async (action, champs) => {
        const titre = await titreDe(action.idCarte);
        const { journal, id } = ouvrirEntree(
          await chargerJournal(),
          { idCarte: action.idCarte, titre, type: action.type, parametre: parametreDe(action), idLot: pont.idLot },
          () => new Date(),
        );
        await enregistrerJournal(champs ? avecContexte(journal, id, champs) : journal);
        return id;
      },
      completer: async (id, resultat: ResultatAction) => {
        if (resultat.classe === 'reussie') pont.bilan.reussies++;
        else pont.bilan.erreurs++;
        pont.bilan.dernierCode = resultat.codeHttp;
        pont.bilan.dernierInconnu = resultat.classe === 'inconnu';
        await enregistrerJournal(completerEntree(await chargerJournal(), id, resultat));
      },
      passer: async (id) => {
        pont.bilan.passees++;
        await enregistrerJournal(passerEntree(await chargerJournal(), id));
      },
    },
  });
  // Chaque changement d’état est écrit : une exécution « en cours » orpheline sera close à la réouverture.
  const ctx: ContexteExecution = { execution, file, pont, ecritures: Promise.resolve() };
  // L'état stocké est une v2 : lots, pause de 30 min (heure murale) et contexte d'erreur ; les restantes n'y sont jamais.
  file.abonner((e) => {
    const maintenant = Date.now();
    ctx.ecritures = ctx.ecritures
      .then(async () => {
        const arretee = e.etat === 'arretee';
        await enregistrerExecution({
          version: 2,
          idLot: e.idLot,
          etat: e.etat,
          traitees: e.traitees,
          total: e.total,
          lots: e.lots,
          pauseJusqua: arretee && e.raison !== null ? calculerPauseJusqua({ raison: e.raison, codeHttp: e.erreur?.codeHttp ?? null }, maintenant) : null,
          erreur: arretee && e.erreur !== null ? await construireErreur(e.erreur, maintenant) : null,
        });
      })
      .catch(() => {});
  });
  execution.ecouter();
  void execution.signaler().catch(() => {});
  contexte = ctx;
  return ctx;
}

/**
 * Un seul point de passage pour tout lancement (nouveau lot, suppression d'étiquettes, reprise) : relit `pauseJusqua`
 * dans l'état stocké (donc valable pour tous les onglets) et refuse pendant les 30 minutes de pause (H11, SC-016).
 */
async function lireEtatStocke(): Promise<EtatExecutionV2 | null> {
  try {
    return await chargerExecution();
  } catch {
    // Impossible de savoir si une pause est en cours : rien ne part (la pause de 30 min ne se contourne pas).
    throw new Error('L’état de l’exécution est illisible : impossible de vérifier la pause de 30 minutes, rien n’est lancé.');
  }
}

async function verifierPause(): Promise<void> {
  const stocke = await lireEtatStocke();
  const raison = raisonPause(stocke?.pauseJusqua ?? null, Date.now());
  if (raison !== null) throw new Error(raison);
}

interface Lancement {
  actions: readonly Action[];
  idLot: string;
  /** Présente pour une reprise : même exécution, identifiant et compteurs conservés. */
  suite?: SuiteExecution;
}

/**
 * Lance (ou reprend) une exécution sous le verrou unique et le bail de la synchro. `preparer` s'exécute une fois ces
 * conditions réunies : si elles manquent, rien n'a été modifié (ni restantes, ni journal).
 */
async function lancerAvec(preparer: () => Promise<Lancement>): Promise<void> {
  if (lotEnCours) throw new Error('Une exécution est déjà en cours.');
  lotEnCours = true;
  try {
    await verifierPause();
    await sousBail(
      { lire: chargerBailSynchro, ecrire: enregistrerBailSynchro, maintenant: () => Date.now() },
      async () => executerLot(contexteExecution(), preparer),
    );
  } finally {
    lotEnCours = false;
  }
}

/**
 * Lance un lot sous le verrou unique ; l'exécution s'arrête si l'onglet WikiMasters se ferme. Refusé pendant la pause de
 * 30 minutes (message « Reprise possible à HH:MM »). Résout à la fin de l'exécution (terminée, arrêtée ou en erreur).
 */
export async function lancerLot(actions: readonly Action[], idLot: string): Promise<void> {
  return lancerAvec(async () => ({ actions, idLot }));
}

let lotEnCours = false;

export interface DependancesBail {
  lire: () => Promise<number | null>;
  ecrire: (expiration: number | null) => Promise<void>;
  maintenant: () => number;
}

/**
 * Exécute `f` en tenant le bail de la synchro automatique (une seule source de débit à la fois) : refus si le bail
 * est tenu, renouvellement tant que `f` tourne, libération dans tous les cas.
 */
export async function sousBail(deps: DependancesBail, f: () => Promise<void>): Promise<void> {
  const tenu = await deps.lire();
  if (tenu !== null && tenu > deps.maintenant()) throw new Error(SYNCHRO_EN_COURS);
  await deps.ecrire(deps.maintenant() + DUREE_BAIL_MS);
  // Le bail expire au bout de 2 min : il est renouvelé tant que le lot tourne.
  const renouvellement = setInterval(() => void deps.ecrire(deps.maintenant() + DUREE_BAIL_MS).catch(() => undefined), DUREE_BAIL_MS / 4);
  try {
    await f();
  } finally {
    clearInterval(renouvellement);
    await deps.ecrire(null).catch(() => undefined);
  }
}

async function executerLot(ctx: ContexteExecution, preparer: () => Promise<Lancement>): Promise<void> {
  await ctx.execution.demarrer(async (interruption) => {
    const { actions, idLot, suite } = await preparer();
    ctx.pont.idLot = idLot;
    if (suite === undefined) ctx.pont.bilan = bilanVide();
    ctx.pont.deconnecte = false;
    abandon = false;
    restantesMem = [];
    suiteMem = null;
    idLotMem = idLot;
    const arreter = (): void => {
      ctx.pont.deconnecte = true;
      ctx.file.arreter();
    };
    interruption.addEventListener('abort', arreter);
    try {
      const etat = await ctx.file.demarrer(actions, idLot, suite);
      restantesMem = abandon ? [] : etat.restantes;
      suiteMem = abandon ? null : { traitees: etat.traitees, total: etat.total, lots: etat.lots.map((l) => ({ ...l })), reussies: etat.reussies };
    } finally {
      interruption.removeEventListener('abort', arreter);
      await ctx.ecritures;
    }
  });
}

export const nouvelIdLot = (prefixe: string): string => `${prefixe}-${Date.now()}`;

/**
 * Lance la suppression des étiquettes que le joueur a validées une à une (RPC `delete_tag`). Même file, même cadence,
 * mêmes arrêts (401, 403, 429, 3 échecs) et même journal que les autres écritures ; à n’appeler qu'après confirmation.
 */
export async function lancerSuppressionEtiquettes(etiquettes: ReadonlyArray<{ id: string; nom: string }>): Promise<void> {
  // Pendant la pause de 30 minutes rien ne part, pas même la préparation de la suppression.
  await verifierPause();
  // Revérification juste avant l’envoi : seules restent les étiquettes encore connues du site et toujours préexistantes.
  const [site, registre, collection, preferences] = await Promise.all([chargerEtiquettesSite(), chargerRegistre(), chargerCollection(), chargerPreferences()]);
  if (site === null) throw new Error('La liste des étiquettes du site n’est pas lue : lancez une synchronisation.');
  const preexistantes = new Set(
    trierEtiquettesSite(site, collection.cartes, registre, configDuLot(preferences))
      .filter((e) => e.origine === 'preexistante')
      .map((e) => e.id),
  );
  const retenues = etiquettes.filter((e) => preexistantes.has(e.id));
  if (retenues.length === 0) throw new Error('Aucune des étiquettes choisies n’est encore supprimable (liste du site changée).');
  const actions: Action[] = retenues.map((e) => ({
    type: 'suppression-etiquette',
    idCarte: ID_CARTE_ETIQUETTES,
    nomEtiquette: e.nom,
    idEtiquette: e.id,
  }));
  return lancerLot(actions, nouvelIdLot('suppression'));
}

/** Actions de retrait pour un couple (carte, étiquette) encore posé au registre ; aucune si le retrait n’est pas disponible. */
export function actionsRetrait(couple: CoupleRetrait, collection: Collection, registre: Registre, retraitDisponible: boolean): Action[] {
  if (!retraitDisponible) return [];
  const carte = collection.cartes.find((c) => c.id === couple.idCarte);
  const ids = new Set(carte?.idsSite ?? []);
  return registre.couples
    .filter((c) => c.nom === couple.nomEtiquette && ids.has(c.ex))
    .map((c) => ({ type: 'retrait-etiquette', idCarte: couple.idCarte, idExemplaire: c.ex, nomEtiquette: couple.nomEtiquette }));
}

// ───────────────────────── Pilotage : pause, reprise, sauts (T-313) ─────────────────────────

/** Actions encore à envoyer après un arrêt (l'action en erreur d'abord) ; mémoire seulement, vides après un rechargement. */
export const restantes = (): readonly Action[] => restantesMem;

/** Vrai tant que le joueur a mis l'exécution en pause (aucun nouveau départ ; au plus 15 min, puis arrêt manuel). */
export const enPause = (): boolean => contexte?.file.etat()?.enPause ?? false;

/** Met la file en pause : les requêtes en vol vont à leur terme, verrou et bail sont gardés. */
export function pause(): void {
  contexte?.file.pause();
}

/** Reprend la même exécution, cadence conservée. */
export function reprendre(): void {
  contexte?.file.reprendre();
}

/**
 * Abandonne l'exécution : arrêt immédiat de tout nouveau départ, restantes vidées (plus de reprise possible).
 * Ne lève jamais la pause de 30 minutes stockée.
 */
export function arreterTout(): void {
  abandon = true;
  contexte?.file.arreter();
  restantesMem = [];
  suiteMem = null;
}

/**
 * Notifie chaque changement de l'état « en pause » (pour le bandeau d'activité) ; renvoie le désabonnement.
 * Le schéma stocké ne change pas : l'état de pause du joueur n'existe qu'en mémoire.
 */
export function abonnerPause(rappel: (enPause: boolean) => void): () => void {
  const { file } = contexteExecution();
  let precedent = file.etat()?.enPause ?? false;
  return file.abonner((e) => {
    if (e.enPause === precedent) return;
    precedent = e.enPause;
    rappel(e.enPause);
  });
}

/**
 * Réessaie l'action en erreur puis les suivantes, dans la même exécution (mêmes conditions de lancement : un seul onglet
 * WikiMasters, verrou, bail, revérification, cadence, arrêts). Refusé pendant la pause de 30 minutes et après un résultat
 * inconnu (la requête a peut-être abouti : vérifier sur le site, puis sauter).
 */
export async function reessayer(): Promise<void> {
  const tete = restantesMem[0];
  if (tete === undefined || suiteMem === null) throw new Error('Aucune action à reprendre : préparez un nouveau lot.');
  await verifierPause();
  const entree = { type: tete.type, parametre: parametreDe(tete), idCarte: tete.idCarte };
  if (resultatInconnu(await chargerJournal(), entree, idLotMem)) throw new Error(RAISON_RESULTAT_INCONNU);
  return lancerAvec(async () => ({ actions: [...restantesMem], idLot: idLotMem, suite: suiteMem ?? undefined }));
}

interface Saut {
  portee: 'action' | 'lot';
  cause: 'sautee' | 'ignoree';
}

/** Actions retirées des restantes : l'action en tête, ou toute sa famille ; une création d'étiquette entraîne ses poses (décision 4). */
function actionsSautees(saut: Saut, tete: Action): Action[] {
  if (saut.portee === 'lot') return restantesMem.filter((a) => familleDe(a) === familleDe(tete));
  if (tete.type !== 'creation-etiquette') return [tete];
  return restantesMem.filter((a) => a === tete || (a.type === 'pose-etiquette' && a.nomEtiquette === tete.nomEtiquette));
}

/**
 * Applique un saut : entrée de journal « passée » unique (cause `sautee` ou `ignoree`), restantes réduites, actions
 * retirées comptées « sautées ». Aucune requête. Renvoie la suite à reprendre ; ne modifie la mémoire qu'une fois
 * le journal écrit.
 */
async function appliquerSaut(saut: Saut): Promise<SuiteExecution> {
  const tete = restantesMem[0];
  const suite = suiteMem;
  if (tete === undefined || suite === null) throw new Error('Aucune action à sauter : préparez un nouveau lot.');
  const famille: FamilleLot = familleDe(tete);
  const lot = suite.lots.find((l) => l.famille === famille);
  if (lot === undefined) throw new Error('Lot introuvable.');
  const retirees = actionsSautees(saut, tete);
  if (saut.cause === 'ignoree') {
    // Écriture refusée ou clé illisible : l'exception sort ici, rien n'est ignoré ni sauté.
    await enregistrerIgnorees(
      ajouterIgnoree(await chargerIgnorees(), { type: tete.type, idCarte: tete.idCarte, parametre: parametreDe(tete), portee: 'synchro', date: Date.now() }),
    );
  }
  const { journal, id } = ouvrirEntree(
    await chargerJournal(),
    { idCarte: tete.idCarte, titre: await titreDe(tete.idCarte), type: tete.type, parametre: parametreDe(tete), idLot: idLotMem },
    () => new Date(),
  );
  await enregistrerJournal(avecContexte(passerEntree(journal, id), id, { rang: lot.traitees + lot.sautees + 1, total: lot.total, lot: famille, cause: saut.cause }));
  const suivante: SuiteExecution = {
    ...suite,
    traitees: suite.traitees + retirees.length,
    lots: suite.lots.map((l) => (l.famille === famille ? { ...l, sautees: l.sautees + retirees.length } : l)),
  };
  restantesMem = restantesMem.filter((a) => !retirees.includes(a));
  suiteMem = suivante;
  return suivante;
}

/**
 * Saute (ou ignore) l'action en tête des restantes puis reprend. Pendant la pause de 30 minutes : effet local seulement,
 * la reprise est différée (rien n'est envoyé, `pauseJusqua` est inchangé) ; l'action visée est alors la tête des restantes.
 */
async function sauter(saut: Saut): Promise<void> {
  if (restantesMem.length === 0 || suiteMem === null) throw new Error('Aucune action à sauter : préparez un nouveau lot.');
  const stocke = await lireEtatStocke();
  if (raisonPause(stocke?.pauseJusqua ?? null, Date.now()) !== null) {
    const suite = await appliquerSaut(saut);
    if (stocke !== null) await enregistrerExecution({ ...stocke, traitees: suite.traitees, lots: suite.lots.map((l) => ({ ...l })) });
    return;
  }
  return lancerAvec(async () => {
    const suite = await appliquerSaut(saut);
    return { actions: [...restantesMem], idLot: idLotMem, suite };
  });
}

/** Saute l'action en erreur (journal « passée », cause `sautee`, aucune requête) puis reprend. */
export const sauterAction = (): Promise<void> => sauter({ portee: 'action', cause: 'sautee' });

/** Saute toutes les actions restantes du lot de l'action en erreur : une seule entrée de journal, les autres comptées « sautées ». */
export const sauterLot = (): Promise<void> => sauter({ portee: 'lot', cause: 'sautee' });

/**
 * Ignore l'action en erreur jusqu'à la prochaine synchro (clé `ignorees`, écrite d'abord) puis agit comme `sauterAction`
 * (cause `ignoree`). Écriture impossible : exception, rien d'ignoré ni de sauté.
 */
export const ignorer = (): Promise<void> => sauter({ portee: 'action', cause: 'ignoree' });
