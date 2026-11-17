// Synchronisation automatique, côté content script : lit la collection du joueur par l'API interne du site.
// Seul fichier de `src/content` qui appelle `fetch` (autorisé par eslint.config.mjs, contrôlé par
// tests/unit/synchro-auto-lint.test.ts). Lecture seule : requêtes GET vers l'origine du site, authentifiées
// par les cookies de même origine du navigateur ; aucun en-tête ajouté, aucun jeton ni cookie lu.
// Le plan de lecture, la cadence et les arrêts sont dans `src/lib/ordonnanceur.ts`.
import { VERSION_SCHEMA, aEditionLocale, type Carte, type Collection } from '../lib/collection';
import { INTERVALLE_MS, type Horloge } from '../lib/file';
import type { EtapeSynchro } from '../lib/statutSynchro';
import { DUREE_BAIL_MS, PAUSE_APRES_ARRET_MS, etatInitial, synchroniser, type AttentePrix, type Bail, type EtatOrdonnanceur, type ReponseApi, type ResultatSynchro } from '../lib/ordonnanceur';
import {
  chargerBailSynchro,
  chargerCollection,
  chargerDerniereSynchro,
  chargerDerniereRelance,
  enregistrerDerniereRelance,
  chargerStatutSynchro,
  chargerEtatSynchro,
  chargerSyncAuto,
  ecouterArretSynchro,
  ecouterPasserCarteSynchro,
  ecouterRelanceSynchro,
  enregistrerBailSynchro,
  enregistrerCollection,
  enregistrerDerniereSynchro,
  enregistrerEtatSynchro,
  enregistrerJournal,
  chargerJournal,
  enregistrerStatutSynchro,
  enregistrerEtiquettesSite,
  noterAffluenceSite,
  chargerReleveMarche,
  enregistrerReleveMarche,
  type StatutSynchro,
} from '../lib/stockage';
import { gigueAleatoire } from '../lib/gigue';
import { analyserStats } from '../lib/lectureApi';
import { completerEntree, ouvrirEntree } from '../lib/journal';
import { extraireHorodatages, routeMarcheValide } from '../lib/affluence';
import { CONFIG_AFFLUENCE } from '../config/affluence';

/** Délai minimal entre deux synchronisations, et période du minuteur tant que l'onglet est visible. */
export const DELAI_SYNCHRO_MS = 30 * 60_000;
/** Délai minimal entre deux relances demandées par le joueur. */
export const DELAI_RELANCE_MS = 60_000;

export interface DependancesSynchroAuto {
  /** Mémorise la liste des étiquettes du compte lue dans `stats` (optionnel). */
  noterEtiquettesSite?: (liste: Array<{ id: string; nom: string; nbCartes: number }>) => Promise<void>;
  horloge: Horloge;
  /** `GET` même origine : reçoit un chemin relatif, ne renvoie que le statut et le JSON. */
  transport: (chemin: string) => Promise<ReponseApi>;
  actif: () => Promise<boolean>;
  derniereSynchro: () => Promise<number | null>;
  noterDerniereSynchro: (horodatage: number) => Promise<void>;
  chargerCollection: () => Promise<Collection>;
  enregistrerCollection: (collection: Collection) => Promise<void>;
  chargerEtat: () => Promise<EtatOrdonnanceur | null>;
  enregistrerEtat: (etat: EtatOrdonnanceur) => Promise<void>;
  bail: Bail;
  /** Statut détaillé pour l'interface (page en cours, cause d'arrêt) ; une erreur d'écriture est sans effet. */
  noterStatut?: (statut: StatutSynchro) => Promise<void>;
  /** Dernière relance exécutée (commune aux onglets) : limite d'une relance par minute. Absent : limite par page seulement. */
  derniereRelance?: { lire: () => Promise<number | null>; ecrire: (horodatage: number) => Promise<void> };
  /** Dernier statut écrit : la relance ne contourne la pause que pour un arrêt manuel ou un 403. Absent : pas de contrôle. */
  chargerStatut?: () => Promise<StatutSynchro | null>;
  /** Événements fixes (début, fin, arrêt et cause) pour le journal existant ; une erreur d'écriture est sans effet. */
  journaliser?: (evenement: EvenementSynchro) => Promise<void>;
  journal?: (message: string) => void;
  /** Millisecondes ajoutées à l'intervalle minimal entre deux requêtes (délai variable). */
  gigue?: () => number;
  /** Relevé d’affluence : route du listing du marché (`null` : désactivé) et enregistrement des horodatages lus. */
  routeMarche?: string | null;
  champsHorodatage?: readonly string[];
  noterAffluence?: (horodatages: number[]) => Promise<void>;
  /** Même réponse du listing du marché, confiée au suivi des mises en vente (aucune requête de plus). */
  surReponseMarche?: (json: unknown) => Promise<void>;
  /** Dernier relevé et échecs consécutifs, partagés entre onglets. */
  releve?: { lire: () => Promise<{ le: number | null; echecs: number }>; ecrire: (r: { le: number | null; echecs: number }) => Promise<void> };
}

export interface SynchroAuto {
  /** Lance une synchronisation si l'option est active et la dernière a plus de 30 min ; sinon `null`, sans requête. */
  declencher: () => Promise<ResultatSynchro | null>;
  /**
   * Relance demandée par le joueur : comme `declencher`, mais sans attendre les 30 min depuis la dernière synchro
   * et en passant outre la pause qui suit un arrêt. Bail, arrêts automatiques (401, 403, 429, 3 échecs) et option
   * désactivée restent en vigueur. Sans effet si une synchro tourne déjà dans cette page.
   */
  relancer: () => Promise<ResultatSynchro | null>;
  /** Arrêt immédiat : plus aucune requête n'est émise après celle en vol. */
  arreter: () => void;
  /** Le joueur demande de passer la carte dont le prix est en attente (avertissement de l’étape Prix). */
  passerCarte: () => void;
}

/**
 * Applique le résultat sur la collection **actuellement stockée**, pour ne pas écraser ce que le joueur
 * a modifié pendant la synchro : seuls les faits du site sont repris, et la valeur marchande seulement si
 * la synchro l'a changée et que le joueur n'y a pas touché.
 */
export function fusionner(stockee: Collection, produite: Collection, depart: ReadonlyMap<string, Carte>): Collection {
  const parId = new Map(stockee.cartes.map((c) => [c.id, c]));
  // Cartes présentes au départ et retirées par la synchro (vendues ou cédées, absentes d’une lecture complète) :
  // retirées aussi du stockage. Une carte ajoutée par le joueur pendant la synchro n’était pas au départ : elle reste.
  const gardees = new Set(produite.cartes.map((c) => c.id));
  for (const [id, avant] of depart) {
    const actuelle = parId.get(id);
    // Jamais une carte éditée (même pendant la synchro) ni aux enchères.
    if (!gardees.has(id) && actuelle !== undefined && !aEditionLocale(actuelle) && !aEditionLocale(avant)) parId.delete(id);
  }
  for (const p of produite.cartes) {
    const s = parId.get(p.id);
    if (!s) {
      parId.set(p.id, p);
      continue;
    }
    let carte: Carte = { ...s, quantite: p.quantite, favori: p.favori, idsSite: p.idsSite, etiquettesSite: p.etiquettesSite };
    const avant = depart.get(p.id)?.valeurMarchande ?? null;
    if (p.valeurMarchande !== avant && s.valeurMarchande === avant) {
      carte = { ...carte, valeurMarchande: p.valeurMarchande };
    }
    parId.set(p.id, carte);
  }
  return { version: VERSION_SCHEMA, cartes: [...parId.values()] };
}

const CARTES_PAR_PAGE = 50;
/** Marge de pages de l'ordonnanceur avant l'arrêt « plafond de pages ». */
const PAGES_DE_MARGE = 2;

/** Événement de synchro pour le journal : libellés fixes uniquement, jamais de corps de réponse, d'identifiant ni de jeton. */
export interface EvenementSynchro {
  titre: string;
  parametre: string | null;
  resultat: 'reussie' | 'interrompue';
  codeHttp: number | null;
}

const ID_LOT_JOURNAL = 'synchro-auto';

/** Ajoute l'événement au journal existant (type « lecture », sans carte). */
export async function ecrireEvenementJournal(evenement: EvenementSynchro, maintenant: () => Date = () => new Date()): Promise<void> {
  const ouvert = ouvrirEntree(await chargerJournal(), { idCarte: '', titre: evenement.titre, type: 'lecture', parametre: evenement.parametre, idLot: ID_LOT_JOURNAL }, maintenant);
  const complet = completerEntree(ouvert.journal, ouvert.id, {
    classe: evenement.resultat === 'reussie' ? 'reussie' : 'arret',
    codeHttp: evenement.codeHttp,
    cause: evenement.parametre ?? '',
  });
  await enregistrerJournal(complet);
}

/** Étiquettes distinctes lues sur le site (noms seulement, comptés, jamais conservés). */
const compterEtiquettes = (collection: Collection): number => new Set(collection.cartes.flatMap((c) => c.etiquettesSite)).size;

/** Fin ou arrêt, avec sa cause en libellé fixe (401/403/429, arrêt manuel) ou la cause exacte d’une lecture non propre. */
function evenementFinal(resultat: ResultatSynchro, pages: number | null): EvenementSynchro {
  const arret = (parametre: string, codeHttp: number | null = null): EvenementSynchro => ({
    titre: 'Synchronisation automatique : arrêt',
    parametre,
    resultat: 'interrompue',
    codeHttp,
  });
  if (resultat.issue === 'arret') {
    if (resultat.raison === 'code-http') return arret('le site a refusé', resultat.codeHttp);
    if (resultat.raison === 'echecs') return arret('3 échecs consécutifs');
    return arret('arrêt demandé');
  }
  // Aucun arrêt automatique sur échec ou lecture non propre (2026-11-16, 2026-11-17) : la synchro est allée au bout, la cause exacte est au journal.
  if (!resultat.complete) {
    const details = [
      resultat.sautes > 0 ? `${resultat.sautes} élément(s) sauté(s) sur erreur` : null,
      resultat.causeIncomplete,
      resultat.causeIncomplete === null && pages !== null && resultat.pagesLues >= pages + PAGES_DE_MARGE ? 'plafond de pages atteint' : null,
    ].filter((d): d is string => d !== null);
    return { titre: 'Synchronisation automatique : fin', parametre: details.length > 0 ? details.join(' · ') : 'lecture incomplète (cause inconnue)', resultat: 'reussie', codeHttp: null };
  }
  return { titre: 'Synchronisation automatique : fin', parametre: null, resultat: 'reussie', codeHttp: null };
}

export function creerSynchroAuto(deps: DependancesSynchroAuto): SynchroAuto {
  const journal = deps.journal ?? (() => undefined);
  let enCours = false;
  let arretDemande = false;
  let passerDemande = false;
  let dernierEssai: number | null = null;
  let derniereRelance: number | null = null;

  /**
   * Une requête `GET` vers le listing du marché, seulement après une synchro terminée, hors pause, bail pris,
   * 0,2 s après la précédente et au plus toutes les 30 min (horodatage commun aux onglets). Seuls les horodatages
   * des annonces sont conservés. 401, 403 ou 429 : pause de 30 min ; un autre échec est ignoré.
   */
  async function releverMarche(): Promise<void> {
    const journaliser = (e: EvenementSynchro): Promise<void> => (deps.journaliser?.(e) ?? Promise.resolve()).catch(() => undefined);
    const route = deps.routeMarche ?? null;
    if (!routeMarcheValide(route) || !deps.noterAffluence || !deps.releve || arretDemande) return;
    let bailPris = false;
    try {
      const maintenant = deps.horloge.now();
      const precedent = await deps.releve.lire();
      if (precedent.le !== null && maintenant - precedent.le < DELAI_SYNCHRO_MS) return;
      const etatAvant = (await deps.chargerEtat()) ?? etatInitial();
      if (etatAvant.arretJusqua !== null && maintenant < etatAvant.arretJusqua) return;
      const tenu = await deps.bail.lire();
      if (tenu !== null && tenu > maintenant) return;
      await deps.bail.ecrire(maintenant + DUREE_BAIL_MS);
      bailPris = true;
      // Cadence commune : 0,2 s après la dernière requête de l’état, sans plafond par minute.
      const derniere = etatAvant.requetes.reduce((m, t) => Math.max(m, t), 0);
      await deps.horloge.attendreJusqua(Math.max(deps.horloge.now(), derniere + INTERVALLE_MS));
      if (arretDemande) return;
      const debut = deps.horloge.now();
      const reponse = await deps.transport(route);
      const refus = [401, 403, 429].includes(reponse.statut);
      // Plus d’arrêt sur les échecs ordinaires (Alexis, 2026-11-17) : seuls 401, 403 et 429 mettent en pause.
      const pause = refus;
      const etat = (await deps.chargerEtat()) ?? etatInitial();
      await deps.enregistrerEtat({
        ...etat,
        requetes: [...etat.requetes, debut].slice(-20),
        arretJusqua: pause ? deps.horloge.now() + PAUSE_APRES_ARRET_MS : etat.arretJusqua,
      });
      await deps.releve.ecrire({ le: debut, echecs: 0 });
      if (pause) {
        await journaliser({
          titre: 'Relevé d’affluence : arrêt',
          parametre: 'le site a refusé',
          resultat: 'interrompue',
          codeHttp: refus ? reponse.statut : null,
        });
      }
      if (reponse.statut === 200) {
        await deps.noterAffluence(extraireHorodatages(reponse.json, deps.champsHorodatage));
        await deps.surReponseMarche?.(reponse.json).catch(() => undefined);
      }
    } catch {
      deps.journal?.('Relevé d’affluence interrompu.');
    } finally {
      if (bailPris) await deps.bail.ecrire(null).catch(() => undefined);
    }
  }

  async function declencher(forcer = false): Promise<ResultatSynchro | null> {
    if (enCours) return null;
    enCours = true;
    arretDemande = false;
    try {
      if (!(await deps.actif())) return null;
      const maintenant = deps.horloge.now();
      if (!forcer && dernierEssai !== null && maintenant - dernierEssai < DELAI_SYNCHRO_MS) return null;
      const derniere = await deps.derniereSynchro();
      if (!forcer && derniere !== null && maintenant - derniere < DELAI_SYNCHRO_MS) return null;

      const etat = (await deps.chargerEtat()) ?? etatInitial();
      const collection = await deps.chargerCollection();
      const depart = new Map(collection.cartes.map((c) => [c.id, c]));
      dernierEssai = maintenant;

      // Statut pour l'interface : écrit à la première requête réelle (une pause ou un bail tenu n'écrasent rien).
      let pages: number | null = null;
      // Champs v2 : étape déduite du chemin demandé, prix comptés ici, début de synchro fixé une fois.
      const debut = deps.horloge.now();
      let etape: EtapeSynchro | null = null;
      let prixFaits = 0;
      let prixPrevus: number | null = null;
      let attente: AttentePrix | null = null;
      let derniereEcriture = Number.NEGATIVE_INFINITY;
      let dernierEtat: StatutSynchro['etat'] | null = null;
      let derniereEtape: EtapeSynchro | null = null;
      let dernierePage: number | null = null;
      const noter = async (partiel: Partial<StatutSynchro> & Pick<StatutSynchro, 'etat'>): Promise<void> => {
        const maintenant = deps.horloge.now();
        // Au plus une écriture par seconde, sauf changement de position : étape, état ou page (décision n°5 de tasks.md,
        // au plus une écriture de stockage local par page). Dans l'étape des prix, la limite d'une par seconde s'applique.
        const page = partiel.page ?? null;
        const memePosition = partiel.etat === dernierEtat && etape === derniereEtape && page === dernierePage;
        if (memePosition && partiel.attente === undefined && maintenant - derniereEcriture < 1000) return;
        derniereEcriture = maintenant;
        dernierEtat = partiel.etat;
        derniereEtape = etape;
        dernierePage = page;
        await (deps.noterStatut?.({
          version: 2,
          etape,
          prixFaits,
          prixPrevus,
          debut,
          ...(attente !== null ? { attente } : {}),
          page: null,
          pages,
          raison: null,
          codeHttp: null,
          le: deps.horloge.now(),
          ajoutees: 0,
          etiquettes: 0,
          prix: 0,
          ...partiel,
        }) ?? Promise.resolve()).catch(() => undefined);
      };
      let demarree = false;
      const journaliser = (e: EvenementSynchro): Promise<void> => (deps.journaliser?.(e) ?? Promise.resolve()).catch(() => undefined);
      const transport = async (chemin: string): Promise<ReponseApi> => {
        if (!demarree) {
          demarree = true;
          await journaliser({ titre: forcer ? 'Synchronisation automatique : relance demandée' : 'Synchronisation automatique : début', parametre: null, resultat: 'reussie', codeHttp: null });
        }
        const page = /[?&]page=(\d+)/.exec(chemin);
        if (chemin.startsWith('/api/my-collection/stats')) etape = 'stats';
        else if (page) etape = 'pages';
        else if (/scope=summary$/.test(chemin)) etape = 'prix';
        else if (chemin.startsWith('/api/marketplace/mine')) etape = 'ventes';
        if (page) await noter({ etat: 'en-cours', page: pages === null ? Number(page[1]) + 1 : Math.min(Number(page[1]) + 1, pages) });
        else await noter({ etat: 'en-cours' });
        const reponse = await deps.transport(chemin);
        if (!page && chemin.startsWith('/api/my-collection/stats')) {
          const stats = reponse.statut === 200 ? analyserStats(reponse.json) : null;
          const total = stats?.total;
          if (stats !== null) {
            // Liste rejetée par le stockage : on efface l’ancienne plutôt que de proposer une liste périmée.
            await (deps.noterEtiquettesSite?.(stats.etiquettes.map((e) => ({ id: e.id, nom: e.nom, nbCartes: e.nbCartes }))) ?? Promise.resolve()).catch(() => deps.noterEtiquettesSite?.([]).catch(() => undefined));
          }
          if (total !== undefined) {
            pages = Math.ceil(total / CARTES_PAR_PAGE);
            await noter({ etat: 'en-cours' });
          }
        }
        return reponse;
      };

      const resultat = await synchroniser({
        horloge: deps.horloge,
        transport,
        collection,
        etat,
        bail: deps.bail,
        journal,
        gigue: deps.gigue,
        arretDemande: () => arretDemande,
        passerCarteDemandee: () => {
          const d = passerDemande;
          passerDemande = false;
          return d;
        },
        forcer,
        annoncerPrix: (n) => {
          prixPrevus = n;
        },
        annoncerAttente: (a) => {
          if (a === null && attente === null) return;
          attente = a;
          void noter({ etat: 'en-cours', attente: a });
        },
        prixTermine: () => {
          prixFaits += 1;
        },
        enregistrer: async (produite, courant) => {
          const stockee = await deps.chargerCollection();
          const fusion = fusionner(stockee, produite, depart);
          if (JSON.stringify(fusion) !== JSON.stringify(stockee)) await deps.enregistrerCollection(fusion);
          await deps.enregistrerEtat(courant);
        },
      });
      if (resultat.issue === 'termine') await deps.noterDerniereSynchro(deps.horloge.now());
      if (resultat.requetes > 0) {
        const ajoutees = resultat.collection.cartes.filter((c) => !depart.has(c.id)).length;
        const comptes = { ajoutees, etiquettes: compterEtiquettes(resultat.collection), prix: resultat.prixReleves };
        if (resultat.issue === 'arret') await noter({ etat: 'arret', raison: resultat.raison, codeHttp: resultat.codeHttp, ...comptes });
        else await noter({ etat: 'termine', ...comptes });
        await journaliser(evenementFinal(resultat, pages));
      }
      if (resultat.issue === 'termine') await releverMarche();
      return resultat;
    } catch {
      // Stockage illisible ou indisponible (extension rechargée) : message générique, jamais le contenu
      // d'une réponse ni le détail de l'erreur.
      deps.journal?.('Synchronisation interrompue : stockage indisponible.');
      return null;
    } finally {
      enCours = false;
    }
  }

  return {
    declencher: () => declencher(),
    relancer: async () => {
      try {
        const maintenant = deps.horloge.now();
        const commune = (await deps.derniereRelance?.lire()) ?? null;
        const derniere = Math.max(derniereRelance ?? 0, commune ?? 0);
        if (derniere > 0 && maintenant - derniere < DELAI_RELANCE_MS) return null;
        // Forçage explicite (Alexis, 2026-11-17) : passe outre le délai de 30 min et la pause après 401, 403 ou 429, quel que soit
        // le statut précédent. Ni la vérification anti-bot ni le bail ne sont contournés (une synchro à la fois).
        derniereRelance = maintenant;
        await deps.derniereRelance?.ecrire(maintenant);
      } catch {
        return null;
      }
      return declencher(true);
    },
    arreter: () => {
      arretDemande = true;
    },
    passerCarte: () => {
      passerDemande = true;
    },
  };
}

export interface SourceVisibilite {
  visible: () => boolean;
  /** Renvoie la fonction qui retire l'écouteur. */
  ecouter: (rappel: () => void) => () => void;
}

export interface OptionsDemarrage {
  synchro: SynchroAuto;
  /** Réponse du listing du marché relevée par la synchro : confiée au suivi des mises en vente. */
  surReponseMarche: (json: unknown) => Promise<void>;
  /** Transport des lectures de la synchro (par défaut `transportSite`) : le content script y met le verrou de requête partagé avec le suivi. */
  transport: (chemin: string) => Promise<ReponseApi>;
  visibilite: SourceVisibilite;
  /** Demande d'arrêt venue de l'interface. */
  ecouterArret: (rappel: () => void) => () => void;
  /** Demande de relance venue de l'interface. */
  ecouterRelance: (rappel: () => void) => () => void;
  /** Demande de passer la carte de prix en attente, venue de l’interface. */
  ecouterPasserCarte: (rappel: () => void) => () => void;
}

export const horlogeReelle: Horloge = {
  now: () => Date.now(),
  attendreJusqua: (echeance) =>
    new Promise<void>((resolve) => {
      const attendre = (): void => {
        const reste = echeance - Date.now();
        if (reste <= 0) resolve();
        else setTimeout(attendre, reste);
      };
      attendre();
    }),
};

// Même origine que la page ; ni méthode, ni corps, ni en-tête : un simple GET.
export const transportSite = async (chemin: string): Promise<ReponseApi> => {
  const reponse = await fetch(chemin, { credentials: 'same-origin' });
  const texte = await reponse.text().catch(() => '');
  try {
    return { statut: reponse.status, json: JSON.parse(texte) as unknown };
  } catch {
    // Pas du JSON : on garde le début du corps (sans caractère de contrôle) pour le diagnostic.
    return { statut: reponse.status, json: null, extrait: texte.replace(/[^\x20-\x7E\u00A0-\uFFFF]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) };
  }
};

/** Messages de diagnostic des prix gardés dans le journal (titre, rang et délai seulement : ni identifiant, ni corps de réponse, ni jeton). */
export const estDiagnosticPrix = (message: string): boolean => /^(Prix indisponible|Prix reporté|Prix : |Aucune vente enregistrée|Diagnostic prix|Pause de|Contrôle de session|Ventes :|Échec |Synchro incomplète)/.test(message);

let fileJournal: Promise<void> = Promise.resolve();
/** Écrit les diagnostics de prix dans le journal, un à la fois ; une erreur d’écriture est sans effet. */
export function journaliserDiagnostic(message: string, ecrire: (e: EvenementSynchro) => Promise<void> = ecrireEvenementJournal): void {
  if (!estDiagnosticPrix(message)) return;
  const refus = /^(Prix indisponible|Prix reporté|Prix : le site répond|Diagnostic prix|Contrôle de session en échec|Échec |Synchro incomplète)/.test(message);
  fileJournal = fileJournal.then(() => ecrire({ titre: 'Synchronisation automatique : prix', parametre: message.slice(0, 300), resultat: refus ? 'interrompue' : 'reussie', codeHttp: null })).catch(() => undefined);
}

/** Écriture d’un événement fixe après les diagnostics en attente : une seule écriture du journal à la fois. */
function ecrireEnSerie(evenement: EvenementSynchro): Promise<void> {
  fileJournal = fileJournal.then(() => ecrireEvenementJournal(evenement)).catch(() => undefined);
  return fileJournal;
}

const synchroDuNavigateur = (surReponseMarche?: (json: unknown) => Promise<void>, transport: (chemin: string) => Promise<ReponseApi> = transportSite): SynchroAuto =>
  creerSynchroAuto({
    horloge: horlogeReelle,
    gigue: gigueAleatoire,
    transport,
    actif: chargerSyncAuto,
    derniereSynchro: chargerDerniereSynchro,
    noterDerniereSynchro: enregistrerDerniereSynchro,
    chargerCollection,
    enregistrerCollection,
    chargerEtat: chargerEtatSynchro,
    enregistrerEtat: enregistrerEtatSynchro,
    bail: { lire: chargerBailSynchro, ecrire: enregistrerBailSynchro },
    noterStatut: enregistrerStatutSynchro,
    noterEtiquettesSite: enregistrerEtiquettesSite,
    chargerStatut: chargerStatutSynchro,
    derniereRelance: { lire: chargerDerniereRelance, ecrire: enregistrerDerniereRelance },
    journaliser: (evenement) => ecrireEnSerie(evenement),
    journal: (message) => journaliserDiagnostic(message),
    surReponseMarche,
    routeMarche: CONFIG_AFFLUENCE.routeMarche,
    champsHorodatage: CONFIG_AFFLUENCE.champsHorodatage,
    releve: { lire: chargerReleveMarche, ecrire: enregistrerReleveMarche },
    noterAffluence: async (h) => {
      await noterAffluenceSite(h);
    },
  });

const visibiliteDuNavigateur = (): SourceVisibilite => ({
  visible: () => document.visibilityState === 'visible',
  ecouter: (rappel) => {
    document.addEventListener('visibilitychange', rappel);
    return () => document.removeEventListener('visibilitychange', rappel);
  },
});

/**
 * Branche les déclencheurs : chargement de la page, puis toutes les 30 min tant que l'onglet est visible
 * (et à son retour au premier plan). Rien ne part si l'option est désactivée : `declencher` le vérifie.
 * Renvoie la fonction qui retire minuteur et écouteurs.
 */
export function demarrerSynchroAuto(options: Partial<OptionsDemarrage> = {}): () => void {
  const synchro = options.synchro ?? synchroDuNavigateur(options.surReponseMarche, options.transport);
  const visibilite = options.visibilite ?? visibiliteDuNavigateur();
  const ecouterArret = options.ecouterArret ?? ecouterArretSynchro;
  const ecouterRelance = options.ecouterRelance ?? ecouterRelanceSynchro;
  const ecouterPasser = options.ecouterPasserCarte ?? ecouterPasserCarteSynchro;

  const lancer = (): void => void synchro.declencher().catch(() => undefined);
  let minuteur: ReturnType<typeof setInterval> | undefined;
  const armer = (): void => {
    if (minuteur === undefined && visibilite.visible()) minuteur = setInterval(lancer, DELAI_SYNCHRO_MS);
  };
  const desarmer = (): void => {
    clearInterval(minuteur);
    minuteur = undefined;
  };

  const retirerVisibilite = visibilite.ecouter(() => {
    if (visibilite.visible()) {
      armer();
      lancer();
    } else {
      desarmer();
    }
  });
  const retirerArret = ecouterArret(() => synchro.arreter());
  const retirerRelance = ecouterRelance(() => void synchro.relancer().catch(() => undefined));
  const retirerPasser = ecouterPasser(() => synchro.passerCarte());

  armer();
  lancer();

  return () => {
    desarmer();
    retirerVisibilite();
    retirerArret();
    retirerRelance();
    retirerPasser();
  };
}
