import { trierEtiquettesSite } from '../lib/etiquettesPreexistantes';
import { ID_CARTE_ETIQUETTES } from '../lib/actions';
import type { Action, Registre, ResultatAction } from '../lib/actions';
import type { Collection } from '../lib/collection';
import { DUREE_BAIL_MS } from '../lib/ordonnanceur';
import { SUPPLEMENT_MAX_MS, creerFile, type File as FileLot } from '../lib/file';
import { completerEntree, ouvrirEntree, passerEntree } from '../lib/journal';
import { appliquerResultat, reverifierAction } from '../lib/revision';
import {
  chargerCollection,
  chargerBailSynchro,
  chargerJournal,
  chargerPreferences,
  chargerRegistre,
  chargerEtiquettesSite,
  enregistrerEtiquettesSite,
  enregistrerCollection,
  enregistrerBailSynchro,
  enregistrerExecution,
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

/**
 * Contexte unique pour toute la durée de vie de la page : une seule file, une seule exécution
 * (la file garde sa mémoire de cadence). Créé au premier besoin : dans l’effet de montage du
 * composant ou au lancement d’un lot, jamais pendant le rendu.
 */
export function contexteExecution(): ContexteExecution {
  if (contexte) return contexte;
  const execution = creerExecutionReelle();
  const pont: Pont = { idLot: '', bilan: bilanVide(), deconnecte: false };
  const titreDe = async (idCarte: string): Promise<string> =>
    (await chargerCollection()).cartes.find((c) => c.id === idCarte)?.titre ?? idCarte;
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
      ouvrir: async (action) => {
        const titre = await titreDe(action.idCarte);
        const { journal, id } = ouvrirEntree(
          await chargerJournal(),
          { idCarte: action.idCarte, titre, type: action.type, parametre: parametreDe(action), idLot: pont.idLot },
          () => new Date(),
        );
        await enregistrerJournal(journal);
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
  file.abonner((e) => {
    const { raison: _raison, ...etat } = e;
    void _raison;
    ctx.ecritures = ctx.ecritures.then(() => enregistrerExecution(etat)).catch(() => {});
  });
  execution.ecouter();
  void execution.signaler().catch(() => {});
  contexte = ctx;
  return ctx;
}

/** Lance un lot sous le verrou unique ; l’exécution s’arrête si l’onglet WikiMasters se ferme. */
export async function lancerLot(actions: readonly Action[], idLot: string): Promise<void> {
  if (lotEnCours) throw new Error('Une exécution est déjà en cours.');
  lotEnCours = true;
  try {
    await sousBail(
      { lire: chargerBailSynchro, ecrire: enregistrerBailSynchro, maintenant: () => Date.now() },
      async () => {
        const ctx = contexteExecution();
        ctx.pont.idLot = idLot;
        ctx.pont.bilan = bilanVide();
        ctx.pont.deconnecte = false;
        await executerLot(ctx, actions, idLot);
      },
    );
  } finally {
    lotEnCours = false;
  }
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

async function executerLot(ctx: ContexteExecution, actions: readonly Action[], idLot: string): Promise<void> {
  await ctx.execution.demarrer(async (interruption) => {
    const arreter = (): void => {
      ctx.pont.deconnecte = true;
      ctx.file.arreter();
    };
    interruption.addEventListener('abort', arreter);
    try {
      await ctx.file.demarrer(actions, idLot);
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
