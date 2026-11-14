import { CONFIG_PRIX } from '../config/prix';
import type { Action, CarteEcartee, FamilleLot, RaisonEcart, Registre, TypeAction, TypesDisponibles } from '../lib/actions';
import type { Carte, Collection } from '../lib/collection';
import { familleDe } from '../lib/familles';
import { raisonPause } from '../lib/reprise';
import { CODES_ARRET, CODE_CONFLIT, type EtatFile, type RaisonArret } from '../lib/file';
import { construireLot, type Config, type LotConstruit } from '../lib/lot';
import { plafondDefausse, preferencesParDefaut, type Preferences } from '../lib/tri';

/** Secondes par action en moyenne : 0,2 s minimale plus un supplément de 0 à 0,1 s (moyenne 0,05 s). */
const SECONDES_PAR_ACTION = 0.25;
/** Nombre maximal de lignes d’actions affichées (SC-025). */
const LIGNES_MAX = 100;
/** Au-delà, les cartes écartées sont regroupées par raison. */
const ECARTEES_MAX = 50;

/** Espace insécable : typographie française avant « : » (D-40). */
export const NB = ' ';

export const CADENCE_TEXTE = `Cadence variable${NB}: 0,2 à 0,3 s entre deux actions, sans plafond par minute · arrêt après 3 erreurs`;

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
  'sans-etiquette-theme': 'aucune étiquette de thème ne peut être posée (nom trop long, homonyme ou limite du compte)',
  'en-vente-sur-site': 'en vente sur le site : l’exemplaire n’est plus dans la collection, aucune étiquette n’est envoyée',
  'valeur-defausse-elevee': `valeur marchande inconnue ou supérieure au plafond de défausse réglé`,
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
export function classeType(type: TypeAction): string {
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
  /** Fin de la pause de 30 min (heure murale), si elle est connue. */
  pauseJusqua?: number | null;
  /** Heure murale courante (par défaut : maintenant), pour juger la pause. */
  maintenant?: number;
  /** Nombre de lots cochés ; absent : la sélection n’entre pas en compte. */
  nbLotsCoches?: number;
}

export const RAISON_AUCUN_LOT = 'Aucun lot n’est coché.';

/** Raison pour laquelle « Lancer » est désactivé, ou `null` s’il peut l’être (D-18, D-09). */
export function raisonDesactivation(c: ConditionsLancement): string | null {
  if (c.executionIllisible) return `L’état de l’exécution est illisible${NB}: Lancer est impossible.`;
  if (c.executionEnCours) return 'Une exécution est déjà en cours.';
  const pause = raisonPause(c.pauseJusqua ?? null, c.maintenant ?? Date.now());
  if (pause !== null) return pause;
  if (c.nbLotsCoches === 0) return RAISON_AUCUN_LOT;
  if (c.nbOnglets === 0) return 'Aucun onglet WikiMasters ouvert.';
  if (c.nbOnglets > 1) return `Plusieurs onglets WikiMasters sont ouverts${NB}: gardez-en un seul.`;
  if (c.nbDisponibles === 0) return 'Aucune action n’est disponible pour le moment.';
  return null;
}

/** Actions des seules familles cochées, dans l’ordre du lot. */
export const actionsDesLotsCoches = (actions: readonly Action[], cochees: ReadonlySet<FamilleLot>): Action[] =>
  actions.filter((a) => cochees.has(familleDe(a)));

export const texteDureeLots = (nbRequetes: number): string => `Durée estimée${NB}: environ ${dureeMinutes(nbRequetes)} min`;

export const texteActionsEcartees = (n: number): string => `${n} ${n > 1 ? 'actions écartées' : 'action écartée'}`;

const LIBELLES_FAMILLE: Record<FamilleLot, string> = {
  etiquettes: 'Étiquettes',
  encheres: 'Enchères',
  defausses: 'Défausses',
  suppressions: 'Suppressions',
  lectures: 'Lectures',
};
export const libelleFamille = (f: FamilleLot): string => LIBELLES_FAMILLE[f];

export function pageActions<T>(actions: readonly T[], max: number = LIGNES_MAX): { visibles: T[]; restantes: number } {
  return { visibles: actions.slice(0, max), restantes: Math.max(0, actions.length - max) };
}

export type RaisonLigne = RaisonEcart | 'etiquette-obsolete';

/** Étiquette obsolète conservée (historique : plus produite par le lot depuis la suppression des statuts). */
export interface EtiquetteObsolete {
  idCarte: string;
  titre: string;
  nomEtiquette: string;
}

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
export function configDuLot(preferences: Preferences, ventesSite: { enCours: number; max: number } | null = null): Config {
  return {
    maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees,
    plafondDefausse: plafondDefausse(preferences),
    longueurMaxEtiquette: null,
    nomsExistants: [],
    amis: preferences.amis,
    lienCardId: true,
    ventesSite,
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
        const valeur = cartes.get(a.idCarte)?.valeurMarchande;
        const exemplaire = `exemplaire ${k} sur ${totalDefausses.get(a.idCarte) ?? k}`;
        return valeur == null ? exemplaire : `${exemplaire} · valeur marchande ${valeur}`;
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
      case 'suppression-etiquette':
        return `suppression${NB}: ${a.nomEtiquette}`;
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
  verification: 'revérification impossible',
};

/** Libellé fixe de la cause d’un arrêt (D-41) : jamais le texte d’une réponse du site. */
export function libelleCause(raison: RaisonArret | null, codeHttp: number | null, deconnecte = false): string {
  if (deconnecte) return 'l’onglet WikiMasters s’est déconnecté';
  if (raison === null) return CAUSES_ARRET.manuel;
  if (raison === 'code-http' && codeHttp === CODE_CONFLIT) return 'réponse 409 : le site signale un conflit (limite d’enchères, carte déjà en vente, identifiant d’exemplaire périmé après une annulation : relancer la synchronisation avant de réessayer)';
  if (raison === 'code-http' && codeHttp === 403) return 'réponse 403 : le site a refusé l’action (exemplaire périmé ou carte en vente, ou session refusée : relancer la synchronisation avant de réessayer, puis se reconnecter à WikiMasters si cela se répète)';
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

export const bilanVide = (): Bilan => ({ reussies: 0, passees: 0, erreurs: 0, dernierCode: null, dernierInconnu: false });

export const pluriel = (n: number, singulier: string, p: string): string => `${n} ${n > 1 ? p : singulier}`;

export const texteEnCours = (traitees: number, total: number, erreurs: number): string =>
  `En cours${NB}: ${traitees} / ${total} · ${pluriel(erreurs, 'erreur', 'erreurs')}`;

export const phraseProgression = (traitees: number, total: number, erreurs: number): string =>
  `${traitees} sur ${total} faites, ${pluriel(erreurs, 'erreur', 'erreurs')}`;

export const pourcentage = (traitees: number, total: number): number =>
  total <= 0 ? 0 : Math.min(100, Math.round((traitees / total) * 100));

/** Phrase du lot interrompu, constaté à la réouverture (D-22, SC-013). */
export const TITRE_INTERROMPU = 'Lot interrompu';
export const SUITE_INTERROMPU = `${NB}: la page ou l’onglet a été fermé ou rechargé. L’exécution ne reprend pas toute seule.`;
export const texteInterrompu = (): string => `${TITRE_INTERROMPU}${SUITE_INTERROMPU}`;

export const SYNCHRO_EN_COURS = 'Une synchronisation ou un autre lot est en cours : réessaie quand il est terminé.';

/** Message affiché au lancement : libellé fixe de l’extension, jamais un texte venu d’ailleurs (D-41). */
const ERREURS_LANCEMENT = new Set([
  'Une exécution est déjà en cours.',
  'Une exécution est déjà en cours dans un autre onglet.',
  'Un seul onglet WikiMasters est requis.',
  'Onglet WikiMasters déconnecté.',
  SYNCHRO_EN_COURS,
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

export const CLASSE_BOUTON = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border bg-ink px-4';
export const CLASSE_ACTIF = 'cursor-pointer hover:bg-line active:bg-line text-paper';
export const CLASSE_INACTIF = 'border-dashed border-muted text-muted cursor-not-allowed';
export const GRILLE = 'grid grid-cols-1 gap-x-4 md:grid-cols-3 xl:grid-cols-[3fr_2fr_2fr]';

export function carteTexte(idCarte: string, cartes: ReadonlyMap<string, Carte>): string {
  const c = cartes.get(idCarte);
  if (c) return `[${c.rarete}] ${c.titre}`;
  const i = idCarte.indexOf('|');
  return i < 0 ? idCarte : `[${idCarte.slice(0, i)}] ${idCarte.slice(i + 1)}`;
}
