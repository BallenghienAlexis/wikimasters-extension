// Suivi des mises en vente et relance automatique, côté content script (Alexis, 2026-11-17).
// Lecture : un `GET` vers le listing du marché déjà autorisé (`CONFIG_AFFLUENCE.routeMarche`, même origine, cookies du
// navigateur, aucun en-tête, aucun jeton), toutes les 5 min puis toutes les 10 s dans la dernière minute d’une enchère,
// seulement tant qu’un onglet WikiMasters est visible. Aucun arrêt automatique de la lecture : après un échec elle attend
// 5 s, puis 5 s de plus à chaque échec de suite, jusqu’à ce que la requête réussisse (jamais de contournement anti-bot).
// Relance : quand une place se libère, une mise aux enchères (`POST /api/marketplace`, même contrat que les lots) pour la
// carte choisie par `choisirProchaineEnchere`, sans clic « Lancer », seulement si l’interrupteur est activé.
// N’appelle jamais `fetch` lui-même : le transport de lecture et l’émetteur d’écriture sont injectés.
import { CAUSE_VERIFICATION_HUMAINE, estLimiteEncheres, type Action, type ResultatAction } from '../lib/actions';
import type { Collection } from '../lib/collection';
import { INTERVALLE_MS, type Horloge } from '../lib/file';
import { routeMarcheValide } from '../lib/affluence';
import { DUREE_BAIL_MS, etatInitial, type Bail, type EtatOrdonnanceur, type ReponseApi } from '../lib/ordonnanceur';
import { choisirProchaineEnchere } from '../lib/relanceVentes';
import type { StatutRelanceVentes } from '../lib/stockage';
import type { Preferences } from '../lib/tri';
import {
  DELAI_NORMAL_MS,
  PAS_ATTENTE_MS,
  analyserListeVentes,
  attenteApresEchec,
  delaiSuivant,
  fusionnerSuivi,
  type LancementVente,
  type SuiviVentes,
} from '../lib/ventes';

/** Pause de la relance après un 401 ou un 429 (règle de sécurité des lots d’écriture). */
export const PAUSE_ECRITURE_MS = 30 * 60_000;
/** Un exemplaire refusé (403 ou 404 : vendu, défaussé) n’est pas retenté avant 1 jour ; une autre erreur, avant 10 min. */
export const ECART_REFUS_MS = 24 * 3600_000;
export const ECART_ERREUR_MS = 10 * 60_000;
/** Échecs de suite d’une même carte à partir desquels l’onglet affiche un avertissement avec choix (jamais d’arrêt automatique). */
export const SEUIL_AVERTISSEMENT_ECRITURE = 5;
/** Relecture après une mise en vente réussie : confirme la place prise et laisse lancer la suivante. */
export const DELAI_APRES_LANCEMENT_MS = 2_000;
/** Attente après un 409 (limite d’enchères) avant un nouvel essai. */
export const DELAI_APRES_409_MS = 60_000;

export interface DependancesSuiviVentes {
  horloge: Horloge;
  gigue: () => number;
  /** `GET` même origine : ne renvoie que le statut et le JSON. */
  transport: (chemin: string) => Promise<ReponseApi>;
  /** Émetteur d’écriture des lots (contrat `enchere`). */
  emettre: (ordre: Action) => Promise<ResultatAction>;
  visible: () => boolean;
  /** Synchronisation automatique activée : le suivi (lecture du marché) n’a lieu que si elle l’est (AGENTS.md). */
  actif: () => Promise<boolean>;
  route: string | null;
  relanceActive: () => Promise<boolean>;
  chargerSuivi: () => Promise<SuiviVentes>;
  enregistrerSuivi: (s: SuiviVentes) => Promise<void>;
  chargerStatut: () => Promise<StatutRelanceVentes | null>;
  enregistrerStatut: (s: StatutRelanceVentes) => Promise<void>;
  chargerCollection: () => Promise<Collection>;
  chargerPreferences: () => Promise<Preferences>;
  chargerLancements: () => Promise<LancementVente[]>;
  ajouterLancement: (l: LancementVente) => Promise<void>;
  chargerEcartes: () => Promise<Record<string, number>>;
  enregistrerEcartes: (e: Record<string, number>) => Promise<void>;
  chargerEtat: () => Promise<EtatOrdonnanceur | null>;
  enregistrerEtat: (e: EtatOrdonnanceur) => Promise<void>;
  bail: Bail;
}

export interface SuiviVentesAuto {
  /** Un cycle : lit si l’échéance est là, relance si une place est libre ; renvoie le délai avant le suivant (ms). */
  cycle: () => Promise<number>;
}

const libelleLecture = (r: ReponseApi): string => {
  if (r.statut === 401) return 'Session du site expirée (401) : reconnecte-toi sur wiki-masters.com';
  if (r.statut === 429) return 'Le site demande de ralentir (429)';
  if (r.statut === 403) {
    const j = r.json as { code?: unknown } | null;
    return j && typeof j === 'object' && j.code === 'human_verification_required'
      ? 'Vérification anti-bot du site requise : résous-la à la main sur wiki-masters.com'
      : 'Le site a refusé la lecture (403)';
  }
  if (r.statut === 200) return 'Réponse du site illisible';
  return `Le site répond ${r.statut}`;
};

/** Retire les écarts échus (les choix du joueur `carte:`, `vu:` et `attend:` restent). */
const purger = (e: Record<string, number>, maintenant: number): Record<string, number> =>
  Object.fromEntries(Object.entries(e).filter(([cle, t]) => /^(carte|vu|attend):/.test(cle) || t > maintenant));

export function creerSuiviVentes(deps: DependancesSuiviVentes): SuiviVentesAuto {
  let echecsLecture = 0;
  let echecsEcriture = 0;
  /** Attente en mémoire de la relance (échec d’envoi, 401, 429) : pas de requête d’écriture avant cette date. */
  let attenteEcritureJusqua = 0;
  let exemplaireEnEchec: string | null = null;
  let enCours = false;

  const statut = async (s: Omit<StatutRelanceVentes, 'maj' | 'echecs'> & { echecs?: number }): Promise<void> => {
    await deps.enregistrerStatut({ ...s, echecs: s.echecs ?? echecsLecture, maj: deps.horloge.now() }).catch(() => undefined);
  };

  /** Espace d’au moins 0,2 s avec la requête précédente de toute l’extension et la note dans l’état partagé. */
  async function cadencer(): Promise<void> {
    const etat = (await deps.chargerEtat()) ?? etatInitial();
    const derniere = etat.requetes.reduce((m, t) => Math.max(m, t), 0);
    await deps.horloge.attendreJusqua(Math.max(deps.horloge.now(), derniere + INTERVALLE_MS + deps.gigue()));
    const apres = (await deps.chargerEtat()) ?? etatInitial();
    await deps.enregistrerEtat({ ...apres, requetes: [...apres.requetes, deps.horloge.now()].slice(-20) }).catch(() => undefined);
  }

  /** Mise en vente d’une carte si une place est libre. Renvoie vrai quand une enchère est partie. */
  async function relancer(suivi: SuiviVentes): Promise<boolean> {
    if (!(await deps.relanceActive())) return false;
    // L’attente d’écriture survit à un rechargement de l’onglet : elle est aussi lue dans le statut enregistré.
    const stocke = await deps.chargerStatut();
    const jusquaStocke = stocke?.etat === 'pause' && stocke.jusqua !== null ? stocke.jusqua : 0;
    if (deps.horloge.now() < Math.max(attenteEcritureJusqua, jusquaStocke) || suivi.max === null) return false;
    const maintenant = deps.horloge.now();
    const tenu = await deps.bail.lire();
    if (tenu !== null && tenu > maintenant) return false;
    const [collection, preferences, ecartes] = await Promise.all([deps.chargerCollection(), deps.chargerPreferences(), deps.chargerEcartes()]);
    const ecartesActifs = Object.entries(ecartes).filter(([cle, t]) => !cle.startsWith('carte:') && !cle.startsWith('vu:') && !cle.startsWith('attend:') && t > maintenant).map(([cle]) => cle);
    const titresRetires = Object.keys(ecartes).filter((c) => c.startsWith('carte:')).map((c) => c.slice('carte:'.length));
    const choix = choisirProchaineEnchere({
      collection,
      preferences,
      enCours: suivi.actives.length,
      max: suivi.max,
      exemplairesEnVente: new Set(suivi.actives.map((v) => v.idExemplaire)),
      exemplairesEcartes: new Set(ecartesActifs),
      titresRetires: new Set(titresRetires),
    });
    if (choix === null) return false;

    await deps.bail.ecrire(maintenant + DUREE_BAIL_MS);
    let resultat: ResultatAction;
    try {
      await cadencer();
      resultat = await deps.emettre(choix.action);
    } catch {
      resultat = { classe: 'inconnu', codeHttp: null, cause: 'erreur d’émission' };
    } finally {
      await deps.bail.ecrire(null).catch(() => undefined);
    }
    const lancement = (resultat: 'reussie' | 'echec', cause: string | null): LancementVente => ({ le: deps.horloge.now(), source: 'auto', titre: choix.titre, prix: choix.action.prix, resultat, cause });

    if (resultat.classe === 'reussie') {
      echecsEcriture = 0;
      exemplaireEnEchec = null;
      await deps.ajouterLancement(lancement('reussie', null)).catch(() => undefined);
      await statut({ etat: 'attente', message: `Mise en vente lancée : ${choix.titre}`, jusqua: null, carte: null });
      return true;
    }
    const cause = resultat.cause;
    await deps.ajouterLancement(lancement('echec', cause)).catch(() => undefined);
    const diagnostic = resultat.diagnostic ?? '';
    const pause = async (ms: number, message: string, carte: StatutRelanceVentes['carte'] = null): Promise<void> => {
      attenteEcritureJusqua = deps.horloge.now() + ms;
      await statut({ etat: 'pause', message, jusqua: attenteEcritureJusqua, carte });
    };
    if (resultat.codeHttp === 401 || resultat.codeHttp === 429) {
      await pause(PAUSE_ECRITURE_MS, resultat.codeHttp === 401 ? 'Session du site expirée (401) : relance en pause 30 min' : 'Le site demande de ralentir (429) : relance en pause 30 min');
      return false;
    }
    if (resultat.codeHttp === 409 || estLimiteEncheres(diagnostic)) {
      // Le listing sous-compte peut-être : au plus un essai par minute tant qu’une lecture ne montre pas une place libre.
      await pause(DELAI_APRES_409_MS, 'Limite d’enchères actives atteinte : la relance attend une place', null);
      return false;
    }
    // Exemplaire vendu, défaussé ou introuvable : la carte est écartée un jour, la relance passe à la suivante (aucune attente).
    if (cause !== CAUSE_VERIFICATION_HUMAINE && (resultat.codeHttp === 403 || resultat.codeHttp === 404)) {
      await deps.enregistrerEcartes(purger({ ...ecartes, [choix.action.idExemplaire]: deps.horloge.now() + ECART_REFUS_MS }, deps.horloge.now())).catch(() => undefined);
      await statut({ etat: 'attente', message: `Carte refusée par le site : ${choix.titre} est écartée un jour`, jusqua: null, carte: null });
      return false;
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
    return false;
  }

  async function cycle(): Promise<number> {
    const route = deps.route;
    if (!routeMarcheValide(route) || !deps.visible() || enCours) return PAS_ATTENTE_MS * 6;
    if (!(await deps.actif().catch(() => false))) return DELAI_NORMAL_MS;
    enCours = true;
    try {
      const maintenant = deps.horloge.now();
      const stocke = await deps.chargerSuivi();
      const precedent = await deps.chargerStatut();
      // Un autre onglet a déjà lu, ou une attente est en cours : on n’ajoute pas de requête.
      if (precedent?.jusqua != null && precedent.etat === 'pause' && echecsLecture > 0 && maintenant < precedent.jusqua) return precedent.jusqua - maintenant;
      const echeance = stocke.releveLe === 0 ? 0 : stocke.releveLe + delaiSuivant(stocke.actives, stocke.releveLe);
      if (maintenant < echeance - 1_000) return echeance - maintenant;

      await cadencer();
      let reponse: ReponseApi;
      try {
        reponse = await deps.transport(route);
      } catch {
        reponse = { statut: 0, json: null };
      }
      const lecture = reponse.statut === 200 ? analyserListeVentes(reponse.json) : null;
      if (lecture === null) {
        echecsLecture += 1;
        const etat0 = await deps.chargerStatut();
        const attente = attenteApresEchec(echecsLecture);
        const message = reponse.statut === 0 ? 'Erreur réseau' : libelleLecture(reponse);
        // Une pause d’écriture plus longue (401, 429) reste affichée : la lecture ne l’écrase jamais.
        if (!(etat0?.etat === 'pause' && etat0.jusqua !== null && etat0.jusqua > deps.horloge.now() + attente)) {
          await statut({ etat: 'pause', message: `${message} : nouvel essai dans ${Math.round(attente / 1000)} s`, jusqua: deps.horloge.now() + attente, carte: etat0?.carte ?? null });
        }
        return attente;
      }
      echecsLecture = 0;
      const suivi = fusionnerSuivi(stocke, lecture, deps.horloge.now());
      await deps.enregistrerSuivi(suivi);
      const etat = await deps.chargerStatut();
      // Le statut de la relance (attente, avertissement) n’est écrasé que s’il n’est plus d’actualité.
      if (etat === null || etat.etat === 'lecture' || (etat.etat === 'pause' && deps.horloge.now() >= attenteEcritureJusqua && etat.carte === null)) {
        await statut({ etat: 'lecture', message: 'Suivi à jour', jusqua: null, echecs: 0, carte: null });
      }
      const lancee = await relancer(suivi);
      if (lancee) return DELAI_APRES_LANCEMENT_MS + deps.gigue();
      return Math.max(1_000, delaiSuivant(suivi.actives, deps.horloge.now())) + deps.gigue();
    } catch {
      echecsLecture += 1;
      return attenteApresEchec(echecsLecture);
    } finally {
      enCours = false;
    }
  }

  return { cycle };
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
