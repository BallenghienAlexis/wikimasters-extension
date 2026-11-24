// Suivi des mises en vente et relance automatique, côté content script (Alexis, 2026-11-17).
// SYNCHRO AUTONOME (Alexis, 2026-11-17) : le suivi a son propre minuteur, son propre état (`etatSuiviVentes`), son propre
// bail (`bailSuiviVentes`), son interrupteur et son bouton « Forcer ». Il n’attend jamais la synchro globale (ni son bail,
// ni ses 30 min, ni ses pauses) et ne la bloque pas. Seul point commun : le verrou de requête (une seule requête en vol
// vers le site, 0,2 s plus gigue entre deux débuts), tenu le temps d’une requête.
// Lecture : un `GET` vers le listing du marché déjà autorisé (`CONFIG_AFFLUENCE.routeMarche`, même origine, cookies du
// navigateur, aucun en-tête, aucun jeton), toutes les 5 min puis toutes les 10 s dans la dernière minute d’une enchère,
// seulement tant qu’un onglet WikiMasters est visible. Aucun arrêt automatique de la lecture : après un échec elle attend
// 5 s, puis 5 s de plus à chaque échec de suite, jusqu’à ce que la requête réussisse (jamais de contournement anti-bot).
// Relance : quand une place se libère, une mise aux enchères (`POST /api/marketplace`, même contrat que les lots) pour la
// carte choisie par `choisirProchaineEnchere`, sans clic « Lancer », seulement si l’interrupteur est activé.
// N’appelle jamais `fetch` lui-même : le transport de lecture et l’émetteur d’écriture sont injectés.
import { CAUSE_VERIFICATION_HUMAINE, CODE_VERIFICATION_HUMAINE, estLimiteEncheres, type Action, type ResultatAction } from '../lib/actions';
import type { Collection } from '../lib/collection';
import type { Horloge } from '../lib/file';
import { CONFIG_PRIX } from '../config/prix';
import { dureeEnchereMinutes, routeMarcheValide, type EvenementVente } from '../lib/affluence';
import { PAUSE_LOTS_MS } from '../lib/reprise';
import { DUREE_BAIL_MS, PAUSE_APRES_ARRET_MS, etatInitial, type Bail, type EtatOrdonnanceur, type ReponseApi } from '../lib/ordonnanceur';
import type { AvecVerrouRequete } from '../lib/verrouRequete';
import type { TendancePrix } from '../lib/lectureApi';
import { choisirProchaineEnchere } from '../lib/relanceVentes';
import { ETAT_SUIVI_INITIAL, type EtatSuiviVentes, type StatutRelanceVentes } from '../lib/stockage';
import type { Preferences } from '../lib/tri';
import {
  DELAI_NORMAL_MS,
  PAS_ATTENTE_MS,
  analyserListeVentes,
  attenteApresEchec,
  delaiSuivant,
  encheresEnCours,
  fusionnerSuivi,
  cleNonVente,
  nonVentesDe,
  issueDe,
  verdictEnAttente,
  prixDepartAjuste,
  purgerEcartes,
  type LancementVente,
  type SuiviVentes,
  type VenteActive,
} from '../lib/ventes';

/** Pause de la relance après un 401 ou un 429 (règle de sécurité des lots d’écriture). */
export const PAUSE_ECRITURE_MS = PAUSE_LOTS_MS;
/** Un exemplaire refusé (403 ou 404 : vendu, défaussé) n’est pas retenté avant 1 jour. */
export const ECART_REFUS_MS = 24 * 3600_000;
/** Échecs de suite d’une même carte à partir desquels l’onglet affiche un avertissement avec choix (jamais d’arrêt automatique). */
export const SEUIL_AVERTISSEMENT_ECRITURE = 5;
/** Relecture après une mise en vente réussie : confirme la place prise et laisse lancer la suivante. */
export const DELAI_APRES_LANCEMENT_MS = 2_000;
/** Attente après un 409 (limite d’enchères) avant un nouvel essai. */
export const DELAI_APRES_409_MS = 60_000;
/** Place libre mais envoi impossible pour l’instant (pause, lot, échec) : nouvelle tentative au plus tôt après ce délai, sans attendre 5 min. */
export const DELAI_REESSAI_PLACE_MS = 10_000;

export interface DependancesSuiviVentes {
  horloge: Horloge;
  gigue: () => number;
  /** `GET` même origine : ne renvoie que le statut et le JSON. */
  transport: (chemin: string) => Promise<ReponseApi>;
  /** Émetteur d’écriture des lots (contrat `enchere`). */
  emettre: (ordre: Action) => Promise<ResultatAction>;
  visible: () => boolean;
  /** Interrupteur propre du suivi (activé par défaut) : indépendant de la synchronisation automatique. */
  actif: () => Promise<boolean>;
  /** Verrou de requête partagé avec la synchro globale : une seule requête en vol, 0,2 s plus gigue entre deux. */
  verrou: AvecVerrouRequete;
  /** État propre du suivi (santé : dernier passage, attente) affiché dans l’onglet. */
  chargerEtatSuivi: () => Promise<EtatSuiviVentes | null>;
  enregistrerEtatSuivi: (e: EtatSuiviVentes) => Promise<void>;
  /** Un lot d’écriture est en cours : la relance (écriture) lui laisse la place ; la lecture n’en dépend pas. */
  lotEnCours: () => Promise<boolean>;
  /** Synchro entre PC : faux si elle est configurée mais que les autres PC n'ont pas été lus récemment (page de gestion fermée) ; la relance attend alors. */
  synchroPcAJour?: () => Promise<boolean>;
  route: string | null;
  relanceActive: () => Promise<boolean>;
  chargerSuivi: () => Promise<SuiviVentes>;
  enregistrerSuivi: (s: SuiviVentes) => Promise<void>;
  chargerStatut: () => Promise<StatutRelanceVentes | null>;
  enregistrerStatut: (s: StatutRelanceVentes) => Promise<void>;
  chargerCollection: () => Promise<Collection>;
  chargerPreferences: () => Promise<Preferences>;
  /**
   * Pose les surcouches de thèmes (cache Wikipédia, classement IA, thèmes appris) en mémoire du content script, comme la page
   * de gestion : sans elles, les thèmes d’une carte (donc « thème gardé » et « thème suivi par un ami ») sont incomplets et une
   * carte voulue par un ami pouvait être mise en vente. Échec : aucune mise en vente (jamais à l’aveugle).
   */
  chargerSurcouchesThemes?: () => Promise<void>;
  chargerLancements: () => Promise<LancementVente[]>;
  ajouterLancement: (l: LancementVente) => Promise<void>;
  chargerEcartes: () => Promise<Record<string, number>>;
  /** Évènements d’affluence (heures fortes) pour choisir la durée de l’enchère ; absent : créneaux par défaut. */
  chargerEvenementsAffluence?: () => Promise<EvenementVente[]>;
  enregistrerEcartes: (e: Record<string, number>) => Promise<void>;
  /** Fin de la pause de l’exécution des lots (401, 429), `null` sans pause : ne concerne que la relance (écriture). */
  pauseLots: () => Promise<number | null>;
  /** État partagé de la synchro : le suivi n’y écrit que la pause de 30 min demandée par le site (401, 429). */
  chargerEtat: () => Promise<EtatOrdonnanceur | null>;
  enregistrerEtat: (e: EtatOrdonnanceur) => Promise<void>;
  /** Bail propre du suivi (un seul passage à la fois entre onglets), distinct de celui de la synchro globale. */
  bail: Bail;
}

/** Mises en vente lancées au plus par passage (5 = maximum du site) ; les suivantes attendent la lecture suivante. */
export const MAX_PAR_PASSE = 5;

type ResultatRelance = { etat: 'lancee'; active: VenteActive } | { etat: 'rien' } | { etat: 'bloque' } | { etat: 'stop' };

export interface SuiviVentesAuto {
  /** Un cycle : lit si l’échéance est là, relance si une place est libre ; renvoie le délai avant le suivant (ms). `forcer` : action explicite du joueur. */
  cycle: (forcer?: boolean) => Promise<number>;
  /** Bouton « Forcer » : un passage tout de suite, sans attendre l’échéance ni l’attente en cours (une fois par minute au plus). */
  forcer: () => Promise<void>;
  /** Réponse du listing lue par la synchro (même requête) : met le suivi à jour sans requête de plus. */
  integrer: (json: unknown) => Promise<void>;
}

const libelleLecture = (r: ReponseApi): string => {
  if (r.statut === 401) return 'Session du site expirée (401) : reconnecte-toi sur wiki-masters.com';
  if (r.statut === 429) return 'Le site demande de ralentir (429)';
  if (r.statut === 403) {
    const j = r.json as { code?: unknown } | null;
    return j && typeof j === 'object' && j.code === CODE_VERIFICATION_HUMAINE
      ? 'Vérification anti-bot du site requise : résous-la à la main sur wiki-masters.com'
      : 'Le site a refusé la lecture (403)';
  }
  if (r.statut === 200) return 'Réponse du site illisible';
  return `Le site répond ${r.statut}`;
};

export function creerSuiviVentes(deps: DependancesSuiviVentes): SuiviVentesAuto {
  let echecsEcriture = 0;
  /** Attente en mémoire de la relance (échec d’envoi, 401, 429) : pas de requête d’écriture avant cette date. */
  let attenteEcritureJusqua = 0;
  let exemplaireEnEchec: string | null = null;
  /** Refus 403 de suite, toutes cartes confondues : au-delà de 2, attente progressive (jamais de rafale). */
  let refusSuite = 0;
  let enCours = false;
  /** Date à partir de laquelle une place libre doit être retentée sans attendre l’échéance de lecture (en mémoire). */
  let reessaiLe: number | null = null;

  const statut = async (s: Omit<StatutRelanceVentes, 'maj' | 'echecs'> & { echecs?: number }): Promise<void> => {
    await deps.enregistrerStatut({ ...s, echecs: s.echecs ?? 0, maj: deps.horloge.now() }).catch(() => undefined);
  };

  const ecrireEtat = async (base: EtatSuiviVentes, partie: Partial<EtatSuiviVentes>): Promise<EtatSuiviVentes> => {
    const suivant = { ...base, ...partie };
    await deps.enregistrerEtatSuivi(suivant).catch(() => undefined);
    return suivant;
  };

  /**
   * Une mise en vente si une place est libre. `prefere` : retente cet exemplaire seulement (enchère terminée sans vente) ;
   * `issue` : issue de la fin traitée, gardée dans le journal. `bloque` : rien ne peut partir maintenant (interrupteur, pause,
   * lot en cours, aucune place) ; `rien` : aucune carte éligible ; `stop` : un envoi a échoué (attente ou pause enregistrée).
   */
  async function relancerUne(suivi: SuiviVentes, prefere: string | undefined, issue: LancementVente['issue']): Promise<ResultatRelance> {
    if (!(await deps.relanceActive())) {
      reessaiLe = null;
      return { etat: 'bloque' };
    }
    // L’attente d’écriture survit à un rechargement de l’onglet : elle est aussi lue dans le statut enregistré.
    const stocke = await deps.chargerStatut();
    const jusquaStocke = stocke?.etat === 'pause' && stocke.jusqua !== null ? stocke.jusqua : 0;
    const pauseLots = (await deps.pauseLots().catch(() => null)) ?? 0;
    // Les écritures respectent aussi la pause demandée par le site (401, 403, 429 de la synchro ou du suivi) : un « Forcer » ou
    // une lecture réussie n’autorise jamais un envoi pendant cette pause.
    const pauseSite = (await deps.chargerEtat().catch(() => null))?.arretJusqua ?? 0;
    const maintenant = deps.horloge.now();
    // Maximum absent de la réponse : celui de la configuration (5). Une enchère dont la fin est dépassée ne compte plus comme place prise.
    const maxSite = Math.min(suivi.max ?? CONFIG_PRIX.maxVentesSimultanees, CONFIG_PRIX.maxVentesSimultanees);
    const enCoursReel = encheresEnCours(suivi.actives, maintenant).length;
    if (maintenant < Math.max(attenteEcritureJusqua, jusquaStocke, pauseLots, pauseSite)) {
      reessaiLe = Math.max(attenteEcritureJusqua, jusquaStocke, pauseLots, pauseSite);
      return { etat: 'bloque' };
    }
    if (enCoursReel >= maxSite) return { etat: 'bloque' };
    // Un lot d’écriture en cours garde la main sur les enchères (le 409 reste le garde-fou) ; la synchro globale, elle, ne gêne pas.
    if (await deps.lotEnCours().catch(() => false)) {
      reessaiLe = maintenant + DELAI_REESSAI_PLACE_MS;
      return { etat: 'bloque' };
    }
    // Les PC d'abord, le site ensuite (Alexis, 2026-11-24) : sans fusion récente entre PC, rien n'est mis en vente.
    if (deps.synchroPcAJour && !(await deps.synchroPcAJour().catch(() => false))) {
      reessaiLe = maintenant + DELAI_REESSAI_PLACE_MS;
      return { etat: 'bloque' };
    }
    if (deps.chargerSurcouchesThemes) {
      try {
        await deps.chargerSurcouchesThemes();
      } catch {
        reessaiLe = maintenant + DELAI_REESSAI_PLACE_MS;
        return { etat: 'bloque' };
      }
    }
    const [collection, preferences, ecartes] = await Promise.all([deps.chargerCollection(), deps.chargerPreferences(), deps.chargerEcartes()]);
    const ecartesActifs = Object.entries(ecartes).filter(([cle, t]) => !cle.startsWith('carte:') && !cle.startsWith('vu:') && !cle.startsWith('attend:') && t > maintenant).map(([cle]) => cle);
    const titresRetires = Object.keys(ecartes).filter((c) => c.startsWith('carte:')).map((c) => c.slice('carte:'.length));
    const etatSynchro = await deps.chargerEtat().catch(() => null);
    const tendances: Record<string, TendancePrix> = {};
    for (const [id, p] of Object.entries(etatSynchro?.prix ?? {})) if (p.tendance) tendances[id] = p.tendance;
    const choix = choisirProchaineEnchere({
      idsCartesSite: etatSynchro?.cardIds ?? {},
      tendances,
      collection,
      preferences,
      enCours: enCoursReel,
      max: maxSite,
      exemplairesEnVente: new Set(suivi.actives.map((v) => v.idExemplaire)),
      exemplairesEcartes: new Set(ecartesActifs),
      titresRetires: new Set(titresRetires),
      ...(prefere !== undefined ? { seulementExemplaire: prefere } : {}),
    });
    if (choix === null) return { etat: 'rien' };
    // Non vendue : prix de départ divisé par deux autant de fois que la carte est restée sans vente (Alexis, 2026-11-17).
    const rarete = collection.cartes.find((c) => c.id === choix.action.idCarte)?.rarete ?? '';
    const nonVentes = nonVentesDe(suivi, cleNonVente(rarete, choix.titre));
    // Durée selon l’affluence à l’instant de l’envoi (Alexis, 2026-11-24) : 1 h en heure forte, plus longue en zone creuse.
    const dureeMinutes = dureeEnchereMinutes(maintenant, (await deps.chargerEvenementsAffluence?.().catch(() => [])) ?? []);
    choix.action = { ...choix.action, dureeMinutes };
    // La division est aussi portée par l'ordre (`reductions`) : le prix de base est relu juste avant l'envoi (tendance du marché).
    if (nonVentes > 0) choix.action = { ...choix.action, prix: prixDepartAjuste(choix.action.prix, nonVentes), reductions: nonVentes };

    // Les essais déjà faits sur cette carte survivent à un rechargement de l’onglet (lus dans le statut enregistré).
    if (stocke?.carte?.idExemplaire === choix.action.idExemplaire && stocke.carte.essais > echecsEcriture) {
      echecsEcriture = stocke.carte.essais;
      exemplaireEnEchec = choix.action.idExemplaire;
    }
    // Le bail propre du suivi est déjà tenu par le cycle ; le verrou de requête garantit une seule requête en vol.
    let resultat: ResultatAction;
    try {
      resultat = await deps.verrou(() => deps.emettre(choix.action));
    } catch {
      resultat = { classe: 'inconnu', codeHttp: null, cause: 'erreur d’émission' };
    }
    const prixEnvoye = resultat.prix ?? choix.action.prix;
    const lancement = (resultat: 'reussie' | 'echec', cause: string | null): LancementVente => ({ le: deps.horloge.now(), source: 'auto', titre: choix.titre, prix: prixEnvoye, resultat, cause, ...(issue !== undefined ? { issue } : {}) });

    if (resultat.classe === 'reussie') {
      echecsEcriture = 0;
      refusSuite = 0;
      exemplaireEnEchec = null;
      await deps.ajouterLancement(lancement('reussie', null)).catch(() => undefined);
      await statut({ etat: 'attente', message: `Mise en vente lancée : ${choix.titre}`, jusqua: null, carte: null });
      const maintenantLancee = deps.horloge.now();
      // Compte local de la place prise : le listing du site ne la montrera qu’à la lecture suivante.
      const prise: VenteActive = { id: `local:${choix.action.idExemplaire}`, idExemplaire: choix.action.idExemplaire, titre: choix.titre, rarete, prixDepart: prixEnvoye, prixActuel: prixEnvoye, avecMise: false, creeLe: maintenantLancee, finLe: maintenantLancee + dureeMinutes * 60_000, finInitiale: maintenantLancee };
      return { etat: 'lancee', active: prise };
    }
    const cause = resultat.cause;
    await deps.ajouterLancement(lancement('echec', cause)).catch(() => undefined);
    // Prix du marché introuvable à la relecture de la tendance : la carte n'est pas mise en vente à l'aveugle, elle est écartée
    // un jour et la relance passe à la suivante (ni échec, ni attente progressive).
    if (resultat.classe === 'passee') {
      await deps.enregistrerEcartes(purgerEcartes({ ...ecartes, [choix.action.idExemplaire]: deps.horloge.now() + ECART_REFUS_MS }, deps.horloge.now())).catch(() => undefined);
      await statut({ etat: 'attente', message: `Prix du marché introuvable pour ${choix.titre} : carte écartée un jour`, jusqua: null, carte: null });
      reessaiLe = deps.horloge.now() + DELAI_REESSAI_PLACE_MS;
      return { etat: 'stop' };
    }
    const diagnostic = resultat.diagnostic ?? '';
    const pause = async (ms: number, message: string, carte: StatutRelanceVentes['carte'] = null): Promise<void> => {
      attenteEcritureJusqua = deps.horloge.now() + ms;
      reessaiLe = attenteEcritureJusqua;
      await statut({ etat: 'pause', message, jusqua: attenteEcritureJusqua, carte });
    };
    if (resultat.codeHttp === 401 || resultat.codeHttp === 429) {
      await pause(PAUSE_ECRITURE_MS, resultat.codeHttp === 401 ? 'Session du site expirée (401) : relance en pause 30 min' : 'Le site demande de ralentir (429) : relance en pause 30 min');
      // 401 et 429 sont un signal du site entier : la lecture du suivi respecte la même pause de 30 min.
      const courant = (await deps.chargerEtatSuivi().catch(() => null)) ?? ETAT_SUIVI_INITIAL;
      await ecrireEtat(courant, { etat: 'pause', message: resultat.codeHttp === 401 ? 'Session du site expirée (401) : pause de 30 min' : 'Le site demande de ralentir (429) : pause de 30 min', jusqua: deps.horloge.now() + PAUSE_ECRITURE_MS });
      return { etat: 'stop' };
    }
    // Un 409 qui n'est pas la limite d'enchères (exemplaire déjà en vente ou plus possédé, par exemple mis en vente depuis un autre PC)
    // n'attend aucune place : la carte est écartée un jour et la relance passe à la suivante.
    if (resultat.codeHttp === 409 && !estLimiteEncheres(diagnostic) && cause !== 'limite d’enchères atteinte') {
      await deps.enregistrerEcartes(purgerEcartes({ ...ecartes, [choix.action.idExemplaire]: deps.horloge.now() + ECART_REFUS_MS }, deps.horloge.now())).catch(() => undefined);
      await statut({ etat: 'attente', message: `Conflit du site pour ${choix.titre} (déjà en vente ou plus possédée) : carte écartée un jour`, jusqua: null, carte: null });
      reessaiLe = deps.horloge.now() + DELAI_REESSAI_PLACE_MS;
      return { etat: 'stop' };
    }
    if (resultat.codeHttp === 409 || estLimiteEncheres(diagnostic)) {
      // Le listing sous-compte peut-être : au plus un essai par minute tant qu’une lecture ne montre pas une place libre.
      await pause(DELAI_APRES_409_MS, 'Limite d’enchères actives atteinte : la relance attend une place', null);
      return { etat: 'stop' };
    }
    // Exemplaire vendu, défaussé ou introuvable : la carte est écartée un jour et la relance passe à la suivante ; à partir
    // de 3 refus de suite (le site peut s’en servir comme avertissement), attente progressive comme pour toute erreur.
    if (cause !== CAUSE_VERIFICATION_HUMAINE && (resultat.codeHttp === 403 || resultat.codeHttp === 404)) {
      await deps.enregistrerEcartes(purgerEcartes({ ...ecartes, [choix.action.idExemplaire]: deps.horloge.now() + ECART_REFUS_MS }, deps.horloge.now())).catch(() => undefined);
      refusSuite += 1;
      if (refusSuite < 3) {
        await statut({ etat: 'attente', message: `Carte refusée par le site : ${choix.titre} est écartée un jour`, jusqua: null, carte: null });
        reessaiLe = deps.horloge.now() + DELAI_REESSAI_PLACE_MS;
        return { etat: 'stop' };
      }
      const attenteRefus = attenteApresEchec(refusSuite - 2);
      await pause(attenteRefus, `${refusSuite} refus de suite par le site : nouvel essai dans ${Math.round(attenteRefus / 1000)} s`, refusSuite - 2 >= SEUIL_AVERTISSEMENT_ECRITURE ? { titre: choix.titre, idExemplaire: choix.action.idExemplaire, essais: refusSuite } : null);
      return { etat: 'stop' };
    }
    // Toute autre erreur (anti-bot compris, jamais contourné) : attente progressive de 5 s, +5 s à chaque échec de suite de la
    // même carte, sans plafond ni arrêt automatique ; à partir de 5 échecs, avertissement avec choix pour le joueur.
    echecsEcriture = exemplaireEnEchec === choix.action.idExemplaire ? echecsEcriture + 1 : 1;
    exemplaireEnEchec = choix.action.idExemplaire;
    const attente = attenteApresEchec(echecsEcriture);
    const raison = cause === CAUSE_VERIFICATION_HUMAINE ? 'Vérification anti-bot du site requise : résous-la à la main sur wiki-masters.com' : `Mise en vente refusée (${cause})`;
    await pause(
      attente,
      `${raison} pour ${choix.titre} : essai ${echecsEcriture}, nouvel essai dans ${Math.round(attente / 1000)} s`,
      echecsEcriture >= SEUIL_AVERTISSEMENT_ECRITURE ? { titre: choix.titre, idExemplaire: choix.action.idExemplaire, essais: echecsEcriture } : null,
    );
    return { etat: 'stop' };
  }

  /**
   * File de traitement des fins d’enchère (Alexis, 2026-11-17 : « quand le décompte est terminé, vérifier si elle a été vendue »).
   * Chaque fin lue dans l’historique du site (statut explicite : vendue, non vendue, annulée) est traitée une fois, la plus ancienne
   * d’abord, chacune sous le verrou de requête : vendue ou annulée, la place libérée va à la prochaine carte de la règle ; non
   * vendue, le même exemplaire est retenté (prix de départ ÷2 de plus, `nonVentes`), sinon la prochaine carte. Plusieurs fins
   * simultanées donnent plusieurs mises en vente dans la même passe, dans la limite des places libres. Un identifiant ne sort de la
   * file qu’une fois traité : une attente, un 401/429, un 409 ou un échec le laissent en place pour le passage suivant.
   */
  async function relancer(suivi0: SuiviVentes, bailToujoursNotre: () => Promise<boolean>): Promise<boolean> {
    reessaiLe = null;
    let suivi = suivi0;
    // Une enchère disparue sans verdict : on attend son statut (10 s entre deux lectures, 2 min au plus), jamais d’arrêt.
    if (verdictEnAttente(suivi, deps.horloge.now())) return false;
    const parId = new Map(suivi.terminees.map((t) => [t.id, t]));
    const file = new Set(suivi.aTraiter ?? []);
    const fins = [...file].map((id) => parId.get(id)).filter((t): t is NonNullable<typeof t> => t !== undefined).sort((a, b) => Number(issueDe(b) === 'non-vendue' && b.idExemplaire !== undefined) - Number(issueDe(a) === 'non-vendue' && a.idExemplaire !== undefined) || a.finLe - b.finLe);
    let lancees = 0;
    const clore = async (id: string): Promise<void> => {
      file.delete(id);
      // Seule la file est écrite : les places prises localement ne sont pas dans la liste du site et ne doivent pas être enregistrées.
      await deps.enregistrerSuivi({ ...suivi0, aTraiter: [...file] }).catch(() => undefined);
    };
    const poser = (active: VenteActive): void => {
      lancees += 1;
      suivi = { ...suivi, actives: [...suivi.actives, active] };
    };
    // Annulée (Alexis, 2026-11-17) : une carte est remise en vente, mais jamais la carte annulée (écartée un jour), même par une autre fin du passage.
    const annulees = fins.filter((f) => issueDe(f) === 'annulee' && f.idExemplaire !== undefined);
    if (annulees.length > 0) {
      const ecartes = await deps.chargerEcartes().catch(() => ({}) as Record<string, number>);
      const ajoutes = Object.fromEntries(annulees.map((f) => [f.idExemplaire!, deps.horloge.now() + ECART_REFUS_MS]));
      await deps.enregistrerEcartes(purgerEcartes({ ...ecartes, ...ajoutes }, deps.horloge.now())).catch(() => undefined);
    }
    let arret = false;
    for (const fin of fins) {
      if (lancees >= MAX_PAR_PASSE || !(await bailToujoursNotre())) break;
      const issue = issueDe(fin);
      let r: ResultatRelance = issue === 'non-vendue' && fin.idExemplaire !== undefined ? await relancerUne(suivi, fin.idExemplaire, issue) : { etat: 'rien' };
      if (r.etat === 'rien') r = await relancerUne(suivi, undefined, issue);
      if (r.etat === 'lancee') {
        poser(r.active);
        await clore(fin.id);
      } else if (r.etat === 'rien') {
        // Aucune carte éligible : la fin est traitée (la place reste libre), journalisée une seule fois.
        await deps.ajouterLancement({ le: deps.horloge.now(), source: 'auto', titre: fin.titre, prix: 0, resultat: 'echec', cause: 'Aucune carte éligible pour remplacer cette enchère', issue }).catch(() => undefined);
        await clore(fin.id);
      } else {
        arret = true;
        break;
      }
    }
    // Places encore libres sans fin à traiter (relance qu’on vient d’activer, place libérée à la main) : comme avant, par la règle.
    while (!arret && lancees < MAX_PAR_PASSE && (await bailToujoursNotre())) {
      const r = await relancerUne(suivi, undefined, undefined);
      if (r.etat !== 'lancee') break;
      poser(r.active);
    }
    return lancees > 0;
  }

  async function cycle(forcer = false): Promise<number> {
    const route = deps.route;
    if (!routeMarcheValide(route) || (!forcer && !deps.visible()) || enCours) return PAS_ATTENTE_MS * 6;
    const base0 = (await deps.chargerEtatSuivi().catch(() => null)) ?? ETAT_SUIVI_INITIAL;
    if (!(await deps.actif().catch(() => false))) {
      if (base0.etat !== 'inactif') await ecrireEtat(base0, { etat: 'inactif', message: 'Suivi coupé par le joueur', jusqua: null });
      return DELAI_NORMAL_MS;
    }
    enCours = true;
    // Bail propre du suivi, relu après écriture : un autre onglet qui suit déjà fait renoncer celui-ci.
    let echeanceBail: number | null = null;
    try {
      const maintenant = deps.horloge.now();
      const tenu = await deps.bail.lire();
      if (tenu !== null && tenu > maintenant) {
        if (forcer) await ecrireEtat(base0, { message: 'Forcer : un passage du suivi est déjà en cours' });
        return PAS_ATTENTE_MS;
      }
      echeanceBail = maintenant + DUREE_BAIL_MS;
      await deps.bail.ecrire(echeanceBail);
      if ((await deps.bail.lire()) !== echeanceBail) {
        echeanceBail = null;
        return PAS_ATTENTE_MS;
      }
      let base = (await deps.chargerEtatSuivi().catch(() => null)) ?? ETAT_SUIVI_INITIAL;
      // Un lot d’écriture (jusqu’à 3 requêtes en vol, hors verrou) garde la main : la lecture attend sa fin, pas celle de la synchro globale.
      if (await deps.lotEnCours().catch(() => false)) {
        if (forcer) await ecrireEtat(base, { message: 'Forcer : un lot d’écriture est en cours, nouvel essai à sa fin' });
        return PAS_ATTENTE_MS;
      }
      if (base.etat === 'inactif') base = await ecrireEtat(base, { etat: 'ok', message: 'Suivi réactivé', jusqua: null });
      if (forcer) {
        // Une demande par minute au plus, commune aux onglets ; le bail et le verrou de requête restent respectés.
        if (base.forceLe !== null && maintenant - base.forceLe < 60_000) {
          await ecrireEtat(base, { message: 'Forcer : déjà demandé il y a moins d’une minute' });
          return PAS_ATTENTE_MS;
        }
        base = await ecrireEtat(base, { forceLe: maintenant });
      } else if ((base.etat === 'attente' || base.etat === 'pause') && base.jusqua !== null && maintenant < base.jusqua) {
        // Attente enregistrée (échec de lecture, pause 401/429 de 30 min) : valable aussi après un rechargement ou dans un autre onglet.
        return base.jusqua - maintenant;
      }
      const stocke = await deps.chargerSuivi();
      const echeance = stocke.releveLe === 0 ? 0 : stocke.releveLe + delaiSuivant(stocke.actives, stocke.releveLe, verdictEnAttente(stocke, stocke.releveLe));
      // Place libre dont l’envoi a échoué ou attendu : retentée dès la fin de l’attente, sans attendre l’échéance de 5 min.
      const reessaiDu = reessaiLe !== null && maintenant >= reessaiLe;
      if (!forcer && !reessaiDu && maintenant < echeance - 1_000) return reessaiLe !== null ? Math.max(1_000, Math.min(echeance, reessaiLe) - maintenant) : echeance - maintenant;

      let reponse: ReponseApi;
      try {
        reponse = await deps.verrou(() => deps.transport(route));
      } catch {
        reponse = { statut: 0, json: null };
      }
      const passage = deps.horloge.now();
      const lecture = reponse.statut === 200 ? analyserListeVentes(reponse.json) : null;
      if (lecture === null) {
        const echecs = base.echecs + 1;
        // 401 et 429 : règle de sécurité existante, pause de 30 min ; toute autre erreur : attente progressive sans arrêt.
        const longue = reponse.statut === 401 || reponse.statut === 429;
        const attente = longue ? PAUSE_ECRITURE_MS : attenteApresEchec(echecs);
        if (longue) {
          // Le site demande de ralentir : la synchro et les lots le voient aussi (même pause de 30 min que le relevé d’affluence).
          const etat = (await deps.chargerEtat()) ?? etatInitial();
          await deps.enregistrerEtat({ ...etat, arretJusqua: passage + PAUSE_APRES_ARRET_MS }).catch(() => undefined);
        }
        const message = reponse.statut === 0 ? 'Erreur réseau' : libelleLecture(reponse);
        await ecrireEtat(base, {
          etat: longue ? 'pause' : 'attente',
          message: `${message} : ${longue ? 'pause de 30 min' : `nouvel essai dans ${Math.round(attente / 1000)} s`}`,
          jusqua: passage + attente,
          echecs,
          dernierPassage: passage,
        });
        return attente;
      }
      const suivi = fusionnerSuivi(stocke, lecture, passage);
      await deps.enregistrerSuivi(suivi);
      await ecrireEtat(base, { etat: 'ok', message: 'Suivi à jour', jusqua: null, echecs: 0, dernierPassage: passage, dernierSucces: passage });
      // Avant chaque envoi : le bail est prolongé s'il est toujours le nôtre, sinon le passage s'arrête (un autre onglet a pris la main).
      const bailToujoursNotre = async (): Promise<boolean> => {
        if (echeanceBail === null || (await deps.bail.lire().catch(() => null)) !== echeanceBail) return false;
        echeanceBail = deps.horloge.now() + DUREE_BAIL_MS;
        await deps.bail.ecrire(echeanceBail).catch(() => undefined);
        return true;
      };
      const lancee = await relancer(suivi, bailToujoursNotre);
      if (lancee) return DELAI_APRES_LANCEMENT_MS + deps.gigue();
      if (reessaiLe !== null) return Math.max(DELAI_REESSAI_PLACE_MS, reessaiLe - deps.horloge.now()) + deps.gigue();
      return Math.max(1_000, delaiSuivant(suivi.actives, deps.horloge.now(), verdictEnAttente(suivi, deps.horloge.now()))) + deps.gigue();
    } catch {
      const e = (await deps.chargerEtatSuivi().catch(() => null)) ?? ETAT_SUIVI_INITIAL;
      const echecs = e.echecs + 1;
      await ecrireEtat(e, { etat: 'attente', message: 'Erreur interne du suivi : nouvel essai bientôt', echecs, jusqua: deps.horloge.now() + attenteApresEchec(echecs), dernierPassage: deps.horloge.now() });
      return attenteApresEchec(echecs);
    } finally {
      // Le bail n’est libéré que s’il est encore le nôtre.
      if (echeanceBail !== null && (await deps.bail.lire().catch(() => null)) === echeanceBail) await deps.bail.ecrire(null).catch(() => undefined);
      enCours = false;
    }
  }

  async function forcer(): Promise<void> {
    await cycle(true);
  }

  async function integrer(json: unknown): Promise<void> {
    const lecture = analyserListeVentes(json);
    if (lecture === null) return;
    await deps.enregistrerSuivi(fusionnerSuivi(await deps.chargerSuivi(), lecture, deps.horloge.now()));
  }

  return { cycle, forcer, integrer };
}

export interface OptionsDemarrageSuivi {
  suivi: SuiviVentesAuto;
  visible: () => boolean;
  ecouterVisibilite: (rappel: () => void) => () => void;
}

/** Boucle : un cycle, puis le suivant après le délai rendu ; en pause (aucune requête) tant que l’onglet est caché. */
export function demarrerSuiviVentes(options: OptionsDemarrageSuivi): () => void {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let arrete = false;
  const planifier = (delai: number): void => {
    clearTimeout(minuteur);
    if (arrete) return;
    minuteur = setTimeout(() => void boucle(), Math.max(500, delai));
  };
  const boucle = async (): Promise<void> => {
    if (arrete) return;
    if (!options.visible()) return; // repris au retour au premier plan
    let delai: number;
    try {
      delai = await options.suivi.cycle();
    } catch {
      delai = PAS_ATTENTE_MS;
    }
    planifier(delai);
  };
  const retirer = options.ecouterVisibilite(() => {
    if (options.visible()) void boucle();
    else clearTimeout(minuteur);
  });
  void boucle();
  return () => {
    arrete = true;
    clearTimeout(minuteur);
    retirer();
  };
}
