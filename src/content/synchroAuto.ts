// Synchronisation automatique, côté content script : lit la collection du joueur par l'API interne du site.
// Seul fichier de `src/content` qui appelle `fetch` (autorisé par eslint.config.mjs, contrôlé par
// tests/unit/synchro-auto-lint.test.ts). Lecture seule : requêtes GET vers l'origine du site, authentifiées
// par les cookies de même origine du navigateur ; aucun en-tête ajouté, aucun jeton ni cookie lu.
// Le plan de lecture, la cadence et les arrêts sont dans `src/lib/ordonnanceur.ts`.
import { VERSION_SCHEMA, type Carte, type Collection } from '../lib/collection';
import type { Horloge } from '../lib/file';
import { etatInitial, synchroniser, type Bail, type EtatOrdonnanceur, type ReponseApi, type ResultatSynchro } from '../lib/ordonnanceur';
import {
  chargerBailSynchro,
  chargerCollection,
  chargerDerniereSynchro,
  chargerEtatSynchro,
  chargerPreferences,
  chargerSyncAuto,
  ecouterArretSynchro,
  enregistrerBailSynchro,
  enregistrerCollection,
  enregistrerDerniereSynchro,
  enregistrerEtatSynchro,
  enregistrerJournal,
  chargerJournal,
  enregistrerStatutSynchro,
  type StatutSynchro,
} from '../lib/stockage';
import { analyserStats } from '../lib/lectureApi';
import { completerEntree, ouvrirEntree } from '../lib/journal';
import { proposerTri, type Preferences } from '../lib/tri';

/** Délai minimal entre deux synchronisations, et période du minuteur tant que l'onglet est visible. */
export const DELAI_SYNCHRO_MS = 30 * 60_000;

export interface DependancesSynchroAuto {
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
  chargerPreferences: () => Promise<Preferences>;
  /** Statut détaillé pour l'interface (page en cours, cause d'arrêt) ; une erreur d'écriture est sans effet. */
  noterStatut?: (statut: StatutSynchro) => Promise<void>;
  /** Événements fixes (début, fin, arrêt et cause) pour le journal existant ; une erreur d'écriture est sans effet. */
  journaliser?: (evenement: EvenementSynchro) => Promise<void>;
  journal?: (message: string) => void;
}

export interface SynchroAuto {
  /** Lance une synchronisation si l'option est active et la dernière a plus de 30 min ; sinon `null`, sans requête. */
  declencher: () => Promise<ResultatSynchro | null>;
  /** Arrêt immédiat : plus aucune requête n'est émise après celle en vol. */
  arreter: () => void;
}

/**
 * Applique le résultat sur la collection **actuellement stockée**, pour ne pas écraser ce que le joueur
 * a modifié pendant la synchro : seuls les faits du site sont repris, et la valeur marchande seulement si
 * la synchro l'a changée et que le joueur n'y a pas touché. Une carte classée par l'assistant est reclassée
 * comme le fait `enregistrerValeur`.
 */
function fusionner(stockee: Collection, produite: Collection, depart: ReadonlyMap<string, Carte>, preferences: Preferences | null): Collection {
  const parId = new Map(stockee.cartes.map((c) => [c.id, c]));
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
      if (carte.decidePar === 'assistant' && preferences !== null) carte = { ...carte, ...proposerTri(carte, preferences) };
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

/** Fin ou arrêt, avec sa cause en libellé fixe (401/403/429, 3 échecs, arrêt manuel, plafond de pages). */
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
  if (!resultat.complete) return arret(pages !== null && resultat.pagesLues >= pages + PAGES_DE_MARGE ? 'plafond de pages' : 'lecture incomplète');
  return { titre: 'Synchronisation automatique : fin', parametre: null, resultat: 'reussie', codeHttp: null };
}

export function creerSynchroAuto(deps: DependancesSynchroAuto): SynchroAuto {
  const journal = deps.journal ?? (() => undefined);
  let enCours = false;
  let arretDemande = false;
  let dernierEssai: number | null = null;

  async function declencher(): Promise<ResultatSynchro | null> {
    if (enCours) return null;
    enCours = true;
    arretDemande = false;
    try {
      if (!(await deps.actif())) return null;
      const maintenant = deps.horloge.now();
      if (dernierEssai !== null && maintenant - dernierEssai < DELAI_SYNCHRO_MS) return null;
      const derniere = await deps.derniereSynchro();
      if (derniere !== null && maintenant - derniere < DELAI_SYNCHRO_MS) return null;

      const etat = (await deps.chargerEtat()) ?? etatInitial();
      const collection = await deps.chargerCollection();
      const depart = new Map(collection.cartes.map((c) => [c.id, c]));
      dernierEssai = maintenant;

      // Statut pour l'interface : écrit à la première requête réelle (une pause ou un bail tenu n'écrasent rien).
      let pages: number | null = null;
      const noter = (partiel: Partial<StatutSynchro> & Pick<StatutSynchro, 'etat'>): Promise<void> =>
        (deps.noterStatut?.({
          version: 1,
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
      let demarree = false;
      const journaliser = (e: EvenementSynchro): Promise<void> => (deps.journaliser?.(e) ?? Promise.resolve()).catch(() => undefined);
      const transport = async (chemin: string): Promise<ReponseApi> => {
        if (!demarree) {
          demarree = true;
          await journaliser({ titre: 'Synchronisation automatique : début', parametre: null, resultat: 'reussie', codeHttp: null });
        }
        const page = /[?&]page=(\d+)/.exec(chemin);
        if (page) await noter({ etat: 'en-cours', page: pages === null ? Number(page[1]) + 1 : Math.min(Number(page[1]) + 1, pages) });
        else await noter({ etat: 'en-cours' });
        const reponse = await deps.transport(chemin);
        if (!page && chemin.startsWith('/api/my-collection/stats')) {
          const total = reponse.statut === 200 ? analyserStats(reponse.json)?.total : undefined;
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
        arretDemande: () => arretDemande,
        enregistrer: async (produite, courant) => {
          const stockee = await deps.chargerCollection();
          const valeurChangee = produite.cartes.some((c) => c.valeurMarchande !== (depart.get(c.id)?.valeurMarchande ?? null));
          const preferences = valeurChangee ? await deps.chargerPreferences() : null;
          const fusion = fusionner(stockee, produite, depart, preferences);
          if (JSON.stringify(fusion) !== JSON.stringify(stockee)) await deps.enregistrerCollection(fusion);
          await deps.enregistrerEtat(courant);
        },
      });
      if (resultat.complete) await deps.noterDerniereSynchro(deps.horloge.now());
      if (resultat.requetes > 0) {
        const ajoutees = resultat.collection.cartes.filter((c) => !depart.has(c.id)).length;
        const comptes = { ajoutees, etiquettes: compterEtiquettes(resultat.collection), prix: resultat.prixReleves };
        if (resultat.issue === 'arret') await noter({ etat: 'arret', raison: resultat.raison, codeHttp: resultat.codeHttp, ...comptes });
        else if (resultat.complete) await noter({ etat: 'termine', ...comptes });
        else await noter({ etat: 'arret', raison: 'echecs', ...comptes });
        await journaliser(evenementFinal(resultat, pages));
      }
      return resultat;
    } catch {
      // Stockage illisible ou indisponible (extension rechargée) : aucune requête, aucun détail ne sort.
      return null;
    } finally {
      enCours = false;
    }
  }

  return {
    declencher,
    arreter: () => {
      arretDemande = true;
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
  visibilite: SourceVisibilite;
  /** Demande d'arrêt venue de l'interface. */
  ecouterArret: (rappel: () => void) => () => void;
}

const horlogeReelle: Horloge = {
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
const transportSite = async (chemin: string): Promise<ReponseApi> => {
  const reponse = await fetch(chemin, { credentials: 'same-origin' });
  const json: unknown = await reponse.json().catch(() => null);
  return { statut: reponse.status, json };
};

const synchroDuNavigateur = (): SynchroAuto =>
  creerSynchroAuto({
    horloge: horlogeReelle,
    transport: transportSite,
    actif: chargerSyncAuto,
    derniereSynchro: chargerDerniereSynchro,
    noterDerniereSynchro: enregistrerDerniereSynchro,
    chargerCollection,
    enregistrerCollection,
    chargerEtat: chargerEtatSynchro,
    enregistrerEtat: enregistrerEtatSynchro,
    bail: { lire: chargerBailSynchro, ecrire: enregistrerBailSynchro },
    chargerPreferences,
    noterStatut: enregistrerStatutSynchro,
    journaliser: (evenement) => ecrireEvenementJournal(evenement),
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
  const synchro = options.synchro ?? synchroDuNavigateur();
  const visibilite = options.visibilite ?? visibiliteDuNavigateur();
  const ecouterArret = options.ecouterArret ?? ecouterArretSynchro;

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

  armer();
  lancer();

  return () => {
    desarmer();
    retirerVisibilite();
    retirerArret();
  };
}
