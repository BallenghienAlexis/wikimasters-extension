import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type {
  Action,
  CarteEcartee,
  EntreeJournal,
  RaisonEcart,
  Registre,
  ResultatAction,
  TypeAction,
  TypesDisponibles,
} from '../lib/actions';
import type { Carte, Collection } from '../lib/collection';
import { typesDisponibles } from '../lib/contrat';
import { CODES_ARRET, SUPPLEMENT_MAX_MS, creerFile, type Decision, type EtatFile, type File as FileLot, type RaisonArret } from '../lib/file';
import { regrouperEtiquettes, type ApercuEtiquettes } from '../lib/apercuEtiquettes';
import { completerEntree, ouvrirEntree, passerEntree } from '../lib/journal';
import { construireLot, type Config, type EtiquetteObsolete, type LotConstruit } from '../lib/lot';
import { appliquerResultat, reverifierAction } from '../lib/revision';
import {
  chargerCollection,
  chargerExecution,
  chargerJournal,
  chargerPreferences,
  chargerRegistre,
  enregistrerCollection,
  enregistrerExecution,
  enregistrerJournal,
  enregistrerRegistre,
} from '../lib/stockage';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import DialogueDefausse from './DialogueDefausse';
import EtiquettesPrevues from './EtiquettesPrevues';
import { creerExecutionReelle, horlogeReelle, type Execution } from './execution';
import Journal, { type CoupleRetrait } from './Journal';

/** Secondes entre deux requêtes (cadence fixe de la file). */
const SECONDES_PAR_ACTION = 6;
/** Nombre maximal de lignes d’actions affichées (SC-025). */
const LIGNES_MAX = 100;
/** Au-delà, les cartes écartées sont regroupées par raison. */
const ECARTEES_MAX = 50;

/** Espace insécable : typographie française avant « : » (D-40). */
const NB = ' ';

export const CADENCE_TEXTE = `Cadence fixe${NB}: 10 actions par minute · arrêt après 3 erreurs`;

const RAISONS: Record<RaisonEcart, string> = {
  'non-reliee': 'non reliée au site',
  'identifiant-en-conflit': 'identifiant d’exemplaire en conflit avec une autre carte',
  'en-attente-place': 'en attente d’une place libre',
  'action-non-disponible': 'action non disponible',
  'prix-invalide': 'prix de départ invalide',
  'prix-superieur-valeur': 'prix de départ supérieur ou égal à la valeur marchande',
  'valeur-absente': 'valeur marchande absente',
  'nom-trop-long': 'nom d’étiquette trop long',
  homonyme: 'une étiquette du même nom existe déjà sur le site',
  'exemplaires-non-relies': 'exemplaires non reliés au site',
};

export const libelleRaison = (raison: RaisonEcart): string => RAISONS[raison];

export function libelleType(type: TypeAction): string {
  switch (type) {
    case 'enchere':
      return 'Mettre aux enchères';
    case 'defausse':
      return 'Défausser';
    case 'lecture':
      return 'Lecture';
    default:
      return 'Étiquette';
  }
}

/** Classe de couleur du libellé : jamais la couleur seule ne porte le sens (D-05). */
function classeType(type: TypeAction): string {
  if (type === 'enchere') return 'text-vendre';
  if (type === 'defausse') return 'text-defausser';
  if (type === 'lecture' || type === 'creation-etiquette') return 'text-paper';
  return 'text-echanger';
}

export function titreApercu(n: number): string {
  if (n === 0) return 'Aucune action à envoyer';
  return `Lot prêt${NB}: ${n} ${n > 1 ? 'actions' : 'action'}`;
}

export interface Totaux {
  etiquettes: number;
  encheres: number;
  defausses: number;
  lectures: number;
}

export function totauxParType(actions: readonly Action[]): Totaux {
  const t: Totaux = { etiquettes: 0, encheres: 0, defausses: 0, lectures: 0 };
  for (const a of actions) {
    if (a.type === 'enchere') t.encheres++;
    else if (a.type === 'defausse') t.defausses++;
    else if (a.type === 'lecture') t.lectures++;
    else t.etiquettes++;
  }
  return t;
}

export function texteTotaux(t: Totaux): string {
  const parts: string[] = [];
  const ajouter = (n: number, singulier: string, pluriel: string): void => {
    if (n > 0) parts.push(`${n} ${n > 1 ? pluriel : singulier}`);
  };
  ajouter(t.lectures, 'lecture', 'lectures');
  ajouter(t.etiquettes, 'étiquette', 'étiquettes');
  ajouter(t.encheres, 'enchère', 'enchères');
  ajouter(t.defausses, 'défausse', 'défausses');
  return parts.join(' · ');
}

export const dureeMinutes = (nbRequetes: number): number => Math.ceil((nbRequetes * SECONDES_PAR_ACTION) / 60);

export const texteDuree = (nbRequetes: number): string => `Durée estimée${NB}: ${dureeMinutes(nbRequetes)} min`;

export function separerDisponibles(
  actions: readonly Action[],
  disponibles: TypesDisponibles,
): { disponibles: Action[]; indisponibles: Action[] } {
  const r = { disponibles: [] as Action[], indisponibles: [] as Action[] };
  for (const a of actions) (disponibles.has(a.type) ? r.disponibles : r.indisponibles).push(a);
  return r;
}

export interface ConditionsLancement {
  nbOnglets: number;
  /** L’état de l’exécution n’a pas pu être lu : on ne lance rien. */
  executionIllisible: boolean;
  executionEnCours: boolean;
  nbDisponibles: number;
}

/** Raison pour laquelle « Lancer » est désactivé, ou `null` s’il peut l’être (D-18). */
export function raisonDesactivation(c: ConditionsLancement): string | null {
  if (c.executionIllisible) return `L’état de l’exécution est illisible${NB}: Lancer est impossible.`;
  if (c.executionEnCours) return 'Une exécution est déjà en cours.';
  if (c.nbOnglets === 0) return 'Aucun onglet WikiMasters ouvert.';
  if (c.nbOnglets > 1) return `Plusieurs onglets WikiMasters sont ouverts${NB}: gardez-en un seul.`;
  if (c.nbDisponibles === 0) return 'Aucune action n’est disponible pour le moment.';
  return null;
}

export function pageActions<T>(actions: readonly T[], max: number = LIGNES_MAX): { visibles: T[]; restantes: number } {
  return { visibles: actions.slice(0, max), restantes: Math.max(0, actions.length - max) };
}

export type RaisonLigne = RaisonEcart | 'etiquette-obsolete';

/** Ligne de la liste « Cartes non incluses » : écartée ou étiquette obsolète conservée. */
export interface LigneNonIncluse {
  idCarte: string;
  titre: string;
  raison: RaisonLigne;
  nomEtiquette?: string;
}

export type Ecartees =
  | { type: 'liste'; lignes: LigneNonIncluse[] }
  | { type: 'groupes'; groupes: Array<{ raison: RaisonLigne; nombre: number; nomEtiquette?: string }> };

/** Fusionne écartées et obsolètes : une ligne par carte et par raison (et par nom pour une obsolète). */
export function lignesNonIncluses(
  ecartees: readonly CarteEcartee[],
  obsoletes: readonly EtiquetteObsolete[],
): LigneNonIncluse[] {
  const vues = new Set<string>();
  const lignes: LigneNonIncluse[] = [];
  const ajouter = (l: LigneNonIncluse): void => {
    const cle = `${l.idCarte}\u0000${l.raison}\u0000${l.nomEtiquette ?? ''}`;
    if (vues.has(cle)) return;
    vues.add(cle);
    lignes.push(l);
  };
  for (const e of ecartees) ajouter({ idCarte: e.idCarte, titre: e.titre, raison: e.raison });
  for (const o of obsoletes) {
    ajouter({ idCarte: o.idCarte, titre: o.titre, raison: 'etiquette-obsolete', nomEtiquette: o.nomEtiquette });
  }
  return lignes;
}

/** Places d’enchère occupées sur le maximum, pour la raison « en attente d’une place libre » (D-17). */
export interface Places {
  occupees: number;
  max: number;
}

/** Raison en toutes lettres (D-17) : nom de l’étiquette obsolète, compte de places si connu. */
export function libelleLigne(raison: RaisonLigne, detail: { nomEtiquette?: string; places?: Places } = {}): string {
  if (raison === 'etiquette-obsolete') {
    return detail.nomEtiquette ? `étiquette obsolète conservée${NB}: ${detail.nomEtiquette}` : 'étiquette obsolète conservée';
  }
  if (raison === 'en-attente-place' && detail.places) {
    return `${RAISONS[raison]} (${detail.places.occupees} / ${detail.places.max})`;
  }
  return RAISONS[raison];
}

/** Nombre de cartes distinctes (une carte à deux raisons compte une fois). */
export const nombreCartes = (lignes: readonly LigneNonIncluse[]): number => new Set(lignes.map((l) => l.idCarte)).size;

/** Phrase de D-13 : les noms d’amis apparaissent dans des étiquettes visibles (H34, tant que la visibilité n’est pas relevée). */
export const AVERTISSEMENT_AMIS = `Les étiquettes sont visibles des autres joueurs${NB}: les noms d’amis y apparaîtront.`;

/** Le lot pose ou crée-t-il une étiquette « Ami · prénom » ? */
export const contientAmi = (actions: readonly Action[]): boolean =>
  actions.some((a) => 'nomEtiquette' in a && /^Ami[\s\u00a0]·/.test(a.nomEtiquette));

export function texteLotVide(avecIndisponibles: boolean): string {
  return avecIndisponibles
    ? 'Aucune action n’est disponible pour le moment.'
    : 'Les favoris, les cartes à trier et les cartes non reliées au site ne produisent aucune action.';
}

export type ResultatLot = { lot: LotConstruit } | { erreur: string };

/** Configuration du lot à partir des préférences (amis et thèmes suivis pour les étiquettes d’échange). */
export function configDuLot(preferences: Preferences): Config {
  return {
    maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees,
    longueurMaxEtiquette: null,
    nomsExistants: [],
    amis: preferences.amis,
  };
}

/** Construit le lot. Un registre illisible (`null`) ou une exception donnent une cause fixe en français. */
export function preparerLot(
  collection: Collection,
  registre: Registre | null,
  dispo: TypesDisponibles,
  config: Config = configDuLot(preferencesParDefaut()),
): ResultatLot {
  if (registre === null) return { erreur: 'le registre des étiquettes est illisible' };
  try {
    return {
      lot: construireLot(collection, registre, config, dispo),
    };
  } catch {
    return { erreur: 'calcul impossible' };
  }
}

export function regrouperEcartees(ecartees: readonly LigneNonIncluse[], seuil: number = ECARTEES_MAX): Ecartees {
  if (ecartees.length <= seuil) return { type: 'liste', lignes: [...ecartees] };
  // Un groupe par raison (et par nom pour une étiquette obsolète), en cartes distinctes.
  const groupes = new Map<string, { raison: RaisonLigne; nomEtiquette?: string; cartes: Set<string> }>();
  for (const e of ecartees) {
    const nom = e.raison === 'etiquette-obsolete' ? e.nomEtiquette : undefined;
    const cle = `${e.raison}\u0000${nom ?? ''}`;
    const g = groupes.get(cle) ?? { raison: e.raison, nomEtiquette: nom, cartes: new Set<string>() };
    g.cartes.add(e.idCarte);
    groupes.set(cle, g);
  }
  return {
    type: 'groupes',
    groupes: [...groupes.values()].map((g) =>
      g.nomEtiquette === undefined
        ? { raison: g.raison, nombre: g.cartes.size }
        : { raison: g.raison, nombre: g.cartes.size, nomEtiquette: g.nomEtiquette },
    ),
  };
}

/** Détail de chaque action, dans l’ordre du lot (numérotation des défausses par carte). */
export function detailsDuLot(actions: readonly Action[], cartes: ReadonlyMap<string, Carte>): string[] {
  const totalDefausses = new Map<string, number>();
  for (const a of actions) if (a.type === 'defausse') totalDefausses.set(a.idCarte, (totalDefausses.get(a.idCarte) ?? 0) + 1);
  const rang = new Map<string, number>();
  return actions.map((a) => {
    switch (a.type) {
      case 'defausse': {
        const k = (rang.get(a.idCarte) ?? 0) + 1;
        rang.set(a.idCarte, k);
        return `exemplaire ${k} sur ${totalDefausses.get(a.idCarte) ?? k}`;
      }
      case 'enchere': {
        const valeur = cartes.get(a.idCarte)?.valeurMarchande;
        return valeur == null ? `départ ${a.prix}` : `départ ${a.prix} · valeur marchande ${valeur}`;
      }
      case 'retrait-etiquette':
        return `retrait${NB}: ${a.nomEtiquette}`;
      case 'creation-etiquette':
        return `création${NB}: ${a.nomEtiquette}`;
      case 'pose-etiquette':
        return a.nomEtiquette;
      default:
        return '';
    }
  });
}

// ───────────────────────── Exécution (câblage de la file, T-017) ─────────────────────────

const CAUSES_ARRET: Record<RaisonArret, string> = {
  manuel: 'arrêt demandé',
  echecs: '3 erreurs',
  'code-http': 'le site a refusé la requête',
  resultat: 'résultat hors contrat ou inconnu',
  ecriture: 'enregistrement local impossible',
  transport: 'erreur de transport',
  confirmation: 'arrêt demandé à la confirmation',
  verification: 'revérification impossible',
  'confirmation-indisponible': 'confirmation indisponible',
};

/** Libellé fixe de la cause d’un arrêt (D-41) : jamais le texte d’une réponse du site. */
export function libelleCause(raison: RaisonArret | null, codeHttp: number | null, deconnecte = false): string {
  if (deconnecte) return 'l’onglet WikiMasters s’est déconnecté';
  if (raison === null) return CAUSES_ARRET.manuel;
  if (raison === 'code-http' && codeHttp !== null && CODES_ARRET.includes(codeHttp)) return `réponse ${codeHttp}`;
  return CAUSES_ARRET[raison];
}

export interface Bilan {
  reussies: number;
  passees: number;
  erreurs: number;
  dernierCode: number | null;
  dernierInconnu: boolean;
}

const bilanVide = (): Bilan => ({ reussies: 0, passees: 0, erreurs: 0, dernierCode: null, dernierInconnu: false });

export const pluriel = (n: number, singulier: string, p: string): string => `${n} ${n > 1 ? p : singulier}`;

export const texteEnCours = (traitees: number, total: number, erreurs: number): string =>
  `En cours${NB}: ${traitees} / ${total} · ${pluriel(erreurs, 'erreur', 'erreurs')}`;

export const phraseProgression = (traitees: number, total: number, erreurs: number): string =>
  `${traitees} sur ${total} faites, ${pluriel(erreurs, 'erreur', 'erreurs')}`;

export const pourcentage = (traitees: number, total: number): number =>
  total <= 0 ? 0 : Math.min(100, Math.round((traitees / total) * 100));

/** Phrase du lot interrompu, constaté à la réouverture (D-22, SC-013). */
const TITRE_INTERROMPU = 'Lot interrompu';
const SUITE_INTERROMPU = `${NB}: la page ou l’onglet a été fermé ou rechargé. L’exécution ne reprend pas toute seule.`;
export const texteInterrompu = (): string => `${TITRE_INTERROMPU}${SUITE_INTERROMPU}`;

/** Message affiché au lancement : libellé fixe de l’extension, jamais un texte venu d’ailleurs (D-41). */
const ERREURS_LANCEMENT = new Set([
  'Une exécution est déjà en cours.',
  'Une exécution est déjà en cours dans un autre onglet.',
  'Un seul onglet WikiMasters est requis.',
  'Onglet WikiMasters déconnecté.',
]);

export function libelleErreurLancement(e: unknown): string {
  return e instanceof Error && ERREURS_LANCEMENT.has(e.message) ? e.message : 'le lot n’a pas pu être lancé.';
}

export function texteFin(etat: EtatFile, bilan: Bilan, deconnecte: boolean): { titre: string; detail: string | null } {
  if (etat.etat === 'terminee') {
    return {
      titre: 'Lot terminé',
      // Phrase unique avec le titre : « Lot terminé : N réussies, M passées, E échouées » (D-22).
      detail: `${pluriel(bilan.reussies, 'réussie', 'réussies')}, ${pluriel(bilan.passees, 'passée', 'passées')}, ${pluriel(bilan.erreurs, 'échouée', 'échouées')}`,
    };
  }
  const restantes = Math.max(0, etat.total - etat.traitees);
  return {
    titre: `Lot arrêté${NB}: ${libelleCause(etat.raison, bilan.dernierCode, deconnecte)}`,
    detail: `${pluriel(restantes, 'action n’a', 'actions n’ont')} pas été envoyée${restantes > 1 ? 's' : ''}.`,
  };
}

interface Pont {
  confirmer: ((action: Action) => Promise<Decision>) | null;
  idLot: string;
  bilan: Bilan;
  deconnecte: boolean;
  /** Répond « Arrêter le lot » à une confirmation ouverte (arrêt ou déconnexion). */
  annuler: (() => void) | null;
}

interface ContexteExecution {
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
function contexteExecution(): ContexteExecution {
  if (contexte) return contexte;
  const execution = creerExecutionReelle();
  const pont: Pont = { confirmer: null, idLot: '', bilan: bilanVide(), deconnecte: false, annuler: null };
  const titreDe = async (idCarte: string): Promise<string> =>
    (await chargerCollection()).cartes.find((c) => c.id === idCarte)?.titre ?? idCarte;
  const file = creerFile({
    horloge: horlogeReelle,
    // Délai variable entre les requêtes (décision d’Alexis du 2026-11-11), en plus des 6 s minimales.
    delaiSupplementaire: () => Math.floor(Math.random() * (SUPPLEMENT_MAX_MS + 1)),
    transport: async (ordre) => {
      if (ordre.type !== 'pose-etiquette' && ordre.type !== 'retrait-etiquette') return execution.transport(ordre);
      // L’identifiant d’étiquette du site vient du registre, au moment d’envoyer (la création précède la pose).
      const { etiquettes } = await chargerRegistre();
      const idEtiquette = Object.prototype.hasOwnProperty.call(etiquettes, ordre.nomEtiquette) ? etiquettes[ordre.nomEtiquette] : undefined;
      if (!idEtiquette) return { classe: 'echec', codeHttp: null, cause: 'action non disponible' };
      return execution.transport({ ...ordre, idEtiquette });
    },
    confirmer: (action) => {
      if (!pont.confirmer) throw new Error('Confirmation indisponible.');
      return pont.confirmer(action);
    },
    reverifier: async (action) => {
      const [collection, registre, preferences] = await Promise.all([chargerCollection(), chargerRegistre(), chargerPreferences()]);
      return reverifierAction(action, collection, registre, configDuLot(preferences));
    },
    appliquer: async (action, resultat) => {
      const [collection, registre] = await Promise.all([chargerCollection(), chargerRegistre()]);
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
async function lancerLot(actions: readonly Action[], idLot: string): Promise<void> {
  const ctx = contexteExecution();
  ctx.pont.idLot = idLot;
  ctx.pont.bilan = bilanVide();
  ctx.pont.deconnecte = false;
  await ctx.execution.demarrer(async (interruption) => {
    const arreter = (): void => {
      ctx.pont.deconnecte = true;
      ctx.file.arreter();
      ctx.pont.annuler?.();
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

const nouvelIdLot = (prefixe: string): string => `${prefixe}-${Date.now()}`;

/** Actions de retrait pour un couple (carte, étiquette) encore posé au registre ; aucune si le retrait n’est pas disponible. */
export function actionsRetrait(couple: CoupleRetrait, collection: Collection, registre: Registre, retraitDisponible: boolean): Action[] {
  if (!retraitDisponible) return [];
  const carte = collection.cartes.find((c) => c.id === couple.idCarte);
  const ids = new Set(carte?.idsSite ?? []);
  return registre.couples
    .filter((c) => c.nom === couple.nomEtiquette && ids.has(c.ex))
    .map((c) => ({ type: 'retrait-etiquette', idCarte: couple.idCarte, idExemplaire: c.ex, nomEtiquette: couple.nomEtiquette }));
}

const CLASSE_BOUTON = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border bg-ink px-4';
const CLASSE_ACTIF = 'cursor-pointer hover:bg-line active:bg-line text-paper';
const CLASSE_INACTIF = 'border-dashed border-muted text-muted cursor-not-allowed';
const GRILLE = 'grid grid-cols-1 gap-x-4 md:grid-cols-3 xl:grid-cols-[3fr_2fr_2fr]';

function carteTexte(idCarte: string, cartes: ReadonlyMap<string, Carte>): string {
  const c = cartes.get(idCarte);
  if (c) return `[${c.rarete}] ${c.titre}`;
  const i = idCarte.indexOf('|');
  return i < 0 ? idCarte : `[${idCarte.slice(0, i)}] ${idCarte.slice(i + 1)}`;
}

function BandeauRisque({ avertirAmis }: { avertirAmis: boolean }): React.ReactElement {
  return (
    <section
      aria-labelledby="titre-risque"
      className="mt-4 rounded border border-line border-l-4 border-l-defausser bg-ink-2 p-4"
      data-testid="bandeau-risque"
    >
      <h2 id="titre-risque" className="font-semibold text-defausser">
        <span aria-hidden="true">! </span>Action sur le site à votre place
      </h2>
      <p className="mt-2 break-words">
        Cette synchronisation envoie des requêtes à WikiMasters à votre place. Les règles de la communauté (§{NB}3) interdisent la
        rétro-ingénierie et l’interception du trafic, les conditions d’utilisation (§{NB}6) prévoient un bannissement pour
        automatisation, et le fichier <code>robots.txt</code> du site indique «{NB}Disallow:{NB}/api/{NB}».
      </p>
      <p className="mt-2 font-semibold">Risque de bannissement accepté le 07/11/2026.</p>
      <p className="mt-2">Une enchère et une défausse ne s’annulent pas depuis l’extension.</p>
      {avertirAmis && <p className="mt-2 font-semibold text-vendre">{AVERTISSEMENT_AMIS}</p>}
    </section>
  );
}

interface ConfirmationOuverte {
  carte: string;
  rang: number;
  total: number;
  resoudre: (d: Decision) => void;
}

interface PropsZone {
  exec: { etat: EtatFile; bilan: Bilan; deconnecte: boolean } | null;
  interrompu: boolean;
  attenteDecision: boolean;
  titreRef: React.RefObject<HTMLHeadingElement | null>;
  arreterRef: React.RefObject<HTMLButtonElement | null>;
  onArreter: () => void;
  onFermer: () => void;
}

/** Zone d’exécution (D-19 à D-23) : progression, arrêt, états de fin. Aucune animation (D-39). */
const ZoneExecution: React.FC<PropsZone> = ({ exec, interrompu, attenteDecision, titreRef, arreterRef, onArreter, onFermer }) => {
  const enCours = exec?.etat.etat === 'en-cours';
  const termine = exec?.etat.etat === 'terminee';
  const fin = exec && !enCours ? texteFin(exec.etat, exec.bilan, exec.deconnecte) : null;
  const bordure = enCours ? 'border-l-paper' : termine ? 'border-l-garder' : 'border-l-defausser';
  const traitees = exec?.etat.traitees ?? 0;
  const total = exec?.etat.total ?? 0;
  const erreurs = exec?.bilan.erreurs ?? 0;
  return (
    <section
      aria-labelledby="titre-execution"
      className={`mt-4 rounded border border-line border-l-4 ${bordure} bg-ink-2 p-4`}
      data-testid="zone-execution"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && enCours && !attenteDecision) {
          e.preventDefault();
          onArreter();
        }
      }}
    >
      <h2 id="titre-execution" ref={titreRef} tabIndex={-1} className="font-semibold">
        Exécution du lot
      </h2>

      {enCours && (
        <>
          <p className="mt-2 font-semibold">
            {attenteDecision ? 'En attente de votre décision' : texteEnCours(traitees, total, erreurs)}
          </p>
          <div className="mt-2 h-2 rounded bg-line">
            <div
              role="progressbar"
              aria-label="Progression du lot"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={traitees}
              className="h-2 rounded bg-paper"
              style={{ width: `${pourcentage(traitees, total)}%` }}
            />
          </div>
          <button
            ref={arreterRef}
            type="button"
            className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-muted font-semibold`}
            onClick={onArreter}
          >
            Arrêter
          </button>
          {!attenteDecision && <p className="mt-2 text-sm text-muted">Échap{NB}: arrêter le lot</p>}
        </>
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="mt-2">
        {enCours && exec && <p className="text-sm text-muted">{phraseProgression(traitees, total, erreurs)}</p>}
        {fin && (
          <>
            {termine ? (
              <p>
                <span className="font-semibold text-garder">{fin.titre}</span>
                {fin.detail && `${NB}: ${fin.detail}`}
              </p>
            ) : (
              <>
                <p className="font-semibold text-defausser">{fin.titre}</p>
                {fin.detail && <p className="mt-1">{fin.detail}</p>}
              </>
            )}
            {!termine && exec?.bilan.dernierInconnu && (
              <p className="mt-1 font-semibold text-vendre">Résultat inconnu, à vérifier sur le site.</p>
            )}
          </>
        )}
        {!exec && interrompu && (
          <p>
            <span className="font-semibold text-defausser">{TITRE_INTERROMPU}</span>
            {SUITE_INTERROMPU}
          </p>
        )}
      </div>

      {!enCours && (
        <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-muted`} onClick={onFermer}>
          Fermer
        </button>
      )}
    </section>
  );
};

interface Props {
  collection: Collection;
  registre: Registre;
  /** Préférences (amis et thèmes) : figées à l’ouverture de l’aperçu pour les étiquettes d’échange. */
  preferences?: Preferences;
  /** La page lit encore le registre et l’état d’exécution : l’aperçu n’est pas proposé (D-18, « Calcul du lot… »). */
  chargement?: boolean;
  /** Le registre n’a pas pu être lu : aucun lot ne peut être préparé. */
  registreIllisible?: boolean;
  /** L’état de l’exécution n’a pas pu être lu : « Lancer » reste désactivé. */
  executionIllisible?: boolean;
  /** Nombre d’onglets WikiMasters ouverts (comptés par la page d’exécution, T-017). */
  nbOnglets: number;
  executionEnCours: boolean;
  /** Types d’action dont l’entrée existe dans la table du contrat. */
  disponibles?: TypesDisponibles;
  /** Relit vraiment le stockage ; renvoie le registre, ou `null` s’il reste illisible. */
  onReessayer?: () => Promise<Registre | null>;
  /** Appelé par « Lancer » (câblé en T-017). */
  onLancer?: (actions: Action[]) => void;
}

const Synchronisation: React.FC<Props> = ({
  collection,
  registre,
  preferences = preferencesParDefaut(),
  chargement = false,
  registreIllisible = false,
  executionIllisible = false,
  nbOnglets,
  executionEnCours,
  disponibles,
  onReessayer,
  onLancer,
}) => {
  // Lot figé au clic sur « Voir l’aperçu du lot » ou « Réessayer » : aucun recalcul ensuite.
  const [etat, setEtat] = useState<ResultatLot | null>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const ouvrirRef = useRef<HTMLButtonElement>(null);
  const dejaOuvert = useRef(false);

  const [exec, setExec] = useState<{ etat: EtatFile; bilan: Bilan; deconnecte: boolean } | null>(null);
  const [interrompu, setInterrompu] = useState(false);
  const [fermee, setFermee] = useState(false);
  const [ongletsLive, setOngletsLive] = useState<number | null>(null);
  /** État d’exécution relu au montage : `null` tant que la page n’a pas vérifié. */
  const [enCoursStocke, setEnCoursStocke] = useState<boolean | null>(null);
  const [erreurLancement, setErreurLancement] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationOuverte | null>(null);
  const [entrees, setEntrees] = useState<EntreeJournal[]>([]);
  const [journalIllisible, setJournalIllisible] = useState(false);
  const [registreMaj, setRegistreMaj] = useState<Registre | null>(null);
  const confirmationRef = useRef<ConfirmationOuverte | null>(null);
  const rangsRef = useRef<Map<Action, { k: number; n: number }>>(new Map());
  const collectionRef = useRef(collection);
  useEffect(() => {
    collectionRef.current = collection;
  }, [collection]);
  const arreterRef = useRef<HTMLButtonElement>(null);
  const titreExecRef = useRef<HTMLHeadingElement>(null);

  const registreCourant = registreMaj ?? registre;

  const decider = useCallback((d: Decision): void => {
    const c = confirmationRef.current;
    if (!c) return;
    confirmationRef.current = null;
    setConfirmation(null);
    c.resoudre(d);
    // Le focus revient à « Arrêter », ou au titre de la zone après « Arrêter le lot ».
    setTimeout(() => (d === 'arreter' ? titreExecRef : arreterRef).current?.focus(), 0);
  }, []);

  useEffect(() => {
    let actif = true;
    const ctx = contexteExecution();
    const relire = async (): Promise<void> => {
      try {
        const j = await chargerJournal();
        if (actif) {
          setEntrees(j);
          setJournalIllisible(false);
        }
      } catch {
        if (actif) setJournalIllisible(true);
      }
      try {
        const r = await chargerRegistre();
        if (actif) setRegistreMaj(r);
      } catch {
        /* le registre reste celui de la page */
      }
    };
    ctx.pont.confirmer = (action) =>
      new Promise<Decision>((resoudre) => {
        const rang = rangsRef.current.get(action) ?? { k: 1, n: 1 };
        const cartesCourantes = new Map(collectionRef.current.cartes.map((x) => [x.id, x]));
        const c: ConfirmationOuverte = { carte: carteTexte(action.idCarte, cartesCourantes), rang: rang.k, total: rang.n, resoudre };
        confirmationRef.current = c;
        setConfirmation(c);
      });
    ctx.pont.annuler = () => decider('arreter');
    const majOnglets = (): void => setOngletsLive(ctx.execution.nbOngletsWikiMasters());
    majOnglets();
    const desabonnerOnglets = ctx.execution.abonner(majOnglets);
    const publier = (etat: EtatFile): void => {
      setExec({ etat, bilan: { ...ctx.pont.bilan }, deconnecte: ctx.pont.deconnecte });
      void relire();
    };
    const desabonnerFile = ctx.file.abonner(publier);
    const courant = ctx.file.etat();
    if (courant) publier(courant);
    void relire();
    void (async () => {
      const avant = await chargerExecution().catch(() => null);
      await ctx.execution.cloreInterrompues().catch(() => {});
      const apres = await chargerExecution().catch(() => null);
      if (!actif) return;
      if (avant?.etat === 'en-cours' && apres?.etat === 'arretee') setInterrompu(true);
      setEnCoursStocke(apres?.etat === 'en-cours');
    })();
    return () => {
      actif = false;
      desabonnerOnglets();
      desabonnerFile();
      ctx.pont.annuler?.();
      ctx.pont.confirmer = null;
      ctx.pont.annuler = null;
    };
  }, [decider]);

  const dispo = useMemo(() => disponibles ?? typesDisponibles(), [disponibles]);
  const cartes = useMemo(() => new Map(collection.cartes.map((c) => [c.id, c])), [collection.cartes]);

  const [focusTitre, setFocusTitre] = useState(0);
  // Après un « Réessayer », le bloc d’erreur disparaît : le focus revient sur le titre (D-35, D-37).
  useEffect(() => {
    if (focusTitre > 0) titreRef.current?.focus();
  }, [focusTitre]);

  const ouvert = etat !== null;
  useEffect(() => {
    if (ouvert) {
      titreRef.current?.focus();
      dejaOuvert.current = true;
    } else if (dejaOuvert.current) {
      ouvrirRef.current?.focus();
    }
  }, [ouvert]);

  // Aperçu des étiquettes, figé avec le lot : mêmes collection, registre et préférences (H24).
  const [apercuEtiquettes, setApercuEtiquettes] = useState<ApercuEtiquettes | null>(null);
  const figer = (r: Registre | null): void => {
    const config = configDuLot(preferences);
    setEtat(preparerLot(collection, r, dispo, config));
    let apercu: ApercuEtiquettes | null = null;
    if (r !== null) {
      try {
        apercu = regrouperEtiquettes(collection, r, config);
      } catch {
        apercu = null;
      }
    }
    setApercuEtiquettes(apercu);
  };
  const ouvrir = (): void => figer(registreIllisible ? null : registreCourant);
  const reessayer = async (): Promise<void> => {
    const r = onReessayer ? await onReessayer() : registreIllisible ? null : registreCourant;
    figer(r);
    setFocusTitre((k) => k + 1);
  };

  const lot = etat && 'lot' in etat ? etat.lot : null;
  const separes = useMemo(() => (lot ? separerDisponibles(lot.actions, dispo) : null), [lot, dispo]);
  const details = useMemo(() => (separes ? detailsDuLot(separes.disponibles, cartes) : []), [separes, cartes]);
  const page = useMemo(() => pageActions(separes?.disponibles ?? []), [separes]);
  const lignes = useMemo(() => {
    if (!lot || !separes) return [];
    // Les actions « non disponibles » sont listées avec les cartes non incluses (D-17).
    const indispo: CarteEcartee[] = separes.indisponibles.map((a) => ({
      idCarte: a.idCarte,
      titre: cartes.get(a.idCarte)?.titre ?? a.idCarte,
      raison: 'action-non-disponible',
    }));
    return lignesNonIncluses([...lot.ecartees, ...indispo], lot.obsoletes);
  }, [lot, separes, cartes]);
  const groupees = useMemo(() => regrouperEcartees(lignes), [lignes]);
  // Places d’enchère : exemplaires déjà en vente + enchères de ce lot, sur le maximum (D-17).
  const places = useMemo<Places>(
    () => ({
      occupees:
        collection.cartes.filter((c) => c.statut === 'en-vente').length + (lot?.actions.filter((a) => a.type === 'enchere').length ?? 0),
      max: CONFIG_PRIX.maxVentesSimultanees,
    }),
    [collection.cartes, lot],
  );

  const n = separes?.disponibles.length ?? 0;
  const avecIndisponibles = lignes.some((l) => l.raison === 'action-non-disponible');
  const afficherLancer = n > 0 || avecIndisponibles;
  const enCours = exec?.etat.etat === 'en-cours' || (enCoursStocke === null ? executionEnCours : enCoursStocke);
  const nbOngletsReel = ongletsLive ?? nbOnglets;
  const raison = raisonDesactivation({ nbOnglets: nbOngletsReel, executionEnCours: enCours, executionIllisible, nbDisponibles: n });

  const phase = exec?.etat.etat ?? null;
  useEffect(() => {
    if (phase === 'en-cours') arreterRef.current?.focus();
    else if (phase !== null) titreExecRef.current?.focus();
  }, [phase]);

  const lancer = (actions: Action[], idLot: string): void => {
    setErreurLancement(null);
    setInterrompu(false);
    setFermee(false);
    const total = new Map<string, number>();
    for (const a of actions) if (a.type === 'defausse') total.set(a.idCarte, (total.get(a.idCarte) ?? 0) + 1);
    const vus = new Map<string, number>();
    const rangs = new Map<Action, { k: number; n: number }>();
    for (const a of actions) {
      if (a.type !== 'defausse') continue;
      const k = (vus.get(a.idCarte) ?? 0) + 1;
      vus.set(a.idCarte, k);
      rangs.set(a, { k, n: total.get(a.idCarte) ?? k });
    }
    rangsRef.current = rangs;
    lancerLot(actions, idLot).catch((e: unknown) =>
      setErreurLancement(libelleErreurLancement(e)),
    );
  };
  const lancerDepuisApercu = (actions: Action[]): void => (onLancer ?? ((a: Action[]) => lancer(a, nouvelIdLot('lot'))))(actions);

  const arreter = (): void => {
    contexteExecution().file.arreter();
    decider('arreter');
  };

  const retirer = (couple: CoupleRetrait): void => {
    const actions = actionsRetrait(couple, collection, registreCourant, dispo.has('retrait-etiquette'));
    if (actions.length === 0) return;
    const ctx = contexteExecution();
    if (ctx.file.etat()?.etat === 'en-cours' && ctx.file.ajouter(actions)) return;
    lancer(actions, nouvelIdLot('retrait'));
  };

  const vider = (): void => {
    enregistrerJournal([])
      .then(() => setEntrees([]))
      .catch(() => setJournalIllisible(true));
  };

  const zoneVisible = (exec !== null || interrompu) && !fermee;
  const fermerZone = (): void => {
    setFermee(true);
    setExec(null);
    setInterrompu(false);
    setEtat(null);
  };
  const classeSecondaire = `${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`;

  return (
    <div data-testid="synchronisation">
      <BandeauRisque avertirAmis={lot !== null && contientAmi(lot.actions)} />

      {zoneVisible && (
        <ZoneExecution
          exec={exec}
          interrompu={interrompu}
          attenteDecision={confirmation !== null}
          titreRef={titreExecRef}
          arreterRef={arreterRef}
          onArreter={arreter}
          onFermer={fermerZone}
        />
      )}

      <section aria-labelledby="titre-synchro" hidden={zoneVisible} className="mt-4 rounded border border-line bg-ink-2 p-4">
        <h2 id="titre-synchro" ref={titreRef} tabIndex={-1} className="font-semibold" data-testid="titre-apercu">
          {lot ? titreApercu(n) : 'Synchronisation avec WikiMasters'}
        </h2>

        {!ouvert && chargement ? (
          <p className="mt-2 text-sm text-muted" aria-busy="true">
            Calcul du lot…
          </p>
        ) : !ouvert ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Voyez d’abord ce qui serait envoyé au site. Rien n’est envoyé tant que vous n’avez pas lancé le lot.
            </p>
            <button
              ref={ouvrirRef}
              type="button"
              className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-paper font-semibold`}
              onClick={ouvrir}
            >
              Voir l’aperçu du lot
            </button>
          </>
        ) : !lot || !separes ? (
          <>
            <p className="mt-2 break-words font-semibold text-defausser" role="alert">
              Le lot n’a pas pu être préparé{NB}: {etat && 'erreur' in etat ? etat.erreur : ''}.
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <button type="button" className={classeSecondaire} onClick={() => void reessayer()}>
                Réessayer
              </button>
              <button type="button" className={classeSecondaire} onClick={() => setEtat(null)}>
                Fermer
              </button>
            </div>
          </>
        ) : (
          <>
            {n === 0 ? (
              <p className="mt-2 text-sm text-muted">{texteLotVide(avecIndisponibles)}</p>
            ) : (
              <>
                <p className="mt-2 text-sm">{texteTotaux(totauxParType(separes.disponibles))}</p>
                <p className="mt-1 text-sm">{texteDuree(n)}</p>

                <div
                  aria-hidden="true"
                  className={`mt-3 hidden border-b border-line pb-1 text-sm font-semibold md:grid ${GRILLE}`}
                >
                  <span>Carte</span>
                  <span>Action sur le site</span>
                  <span>Détail</span>
                </div>
                <ul aria-label="Actions du lot">
                  {page.visibles.map((a, i) => (
                    <li key={i} className={`border-b border-line px-0 py-2 text-sm md:px-2 ${GRILLE}`}>
                      <span className="break-words">{carteTexte(a.idCarte, cartes)}</span>
                      <span className={`break-words font-semibold ${classeType(a.type)}`}>
                        <span className="font-normal text-muted md:sr-only">Action{NB}: </span>
                        {libelleType(a.type)}
                      </span>
                      <span className="break-words text-muted">
                        <span className="md:sr-only">Détail{NB}: </span>
                        {details[i]}
                      </span>
                    </li>
                  ))}
                </ul>
                {page.restantes > 0 && (
                  <p className="mt-2 text-sm text-muted" data-testid="actions-restantes">
                    … et {page.restantes} {page.restantes > 1 ? 'autres actions' : 'autre action'}
                  </p>
                )}
              </>
            )}

            {apercuEtiquettes && <EtiquettesPrevues apercu={apercuEtiquettes} cartes={cartes} />}

            {lignes.length > 0 && (
              <details className="mt-3 text-sm text-muted">
                <summary className="min-h-11 cursor-pointer py-2">Cartes non incluses ({nombreCartes(lignes)})</summary>
                {groupees.type === 'liste' ? (
                  <ul>
                    {groupees.lignes.map((e, i) => (
                      <li key={i} className="break-words py-1">
                        {carteTexte(e.idCarte, cartes)}
                        {NB}: {libelleLigne(e.raison, { nomEtiquette: e.nomEtiquette, places })}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul>
                    {groupees.groupes.map((g) => (
                      <li key={`${g.raison}-${g.nomEtiquette ?? ''}`} className="break-words py-1">
                        {g.nombre} {g.nombre > 1 ? 'cartes' : 'carte'}
                        {NB}: {libelleLigne(g.raison, { nomEtiquette: g.nomEtiquette, places })}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}

            <p className="mt-3 text-sm text-muted">{CADENCE_TEXTE}</p>

            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              {afficherLancer && (
                <button
                  type="button"
                  aria-disabled={raison !== null}
                  aria-describedby={raison !== null ? 'raison-lancer' : undefined}
                  className={`${CLASSE_BOUTON} font-semibold ${raison !== null ? CLASSE_INACTIF : `${CLASSE_ACTIF} border-paper`}`}
                  onClick={() => {
                    if (raison === null) lancerDepuisApercu(separes.disponibles);
                  }}
                >
                  {n === 0 ? 'Lancer' : n > 1 ? `Lancer les ${n} actions` : 'Lancer l’action'}
                </button>
              )}
              <button type="button" className={classeSecondaire} onClick={() => setEtat(null)}>
                {afficherLancer ? 'Annuler' : 'Fermer'}
              </button>
            </div>
            {afficherLancer && raison !== null && (
              <p id="raison-lancer" className="mt-2 text-sm text-muted">
                {raison}
              </p>
            )}
          </>
        )}
      </section>

      {erreurLancement !== null && (
        <p role="alert" className="mt-4 break-words font-semibold text-defausser">
          Lancement impossible{NB}: {erreurLancement}
        </p>
      )}

      <Journal
        entrees={entrees}
        registre={registreCourant}
        retraitDisponible={dispo.has('retrait-etiquette')}
        ongletPret={nbOngletsReel === 1}
        illisible={journalIllisible}
        onRetirer={retirer}
        onVider={vider}
      />

      {confirmation && (
        <DialogueDefausse
          carte={confirmation.carte}
          rang={confirmation.rang}
          total={confirmation.total}
          onDecision={decider}
        />
      )}
    </div>
  );
};

export default Synchronisation;
