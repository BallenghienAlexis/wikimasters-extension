/**
 * Ordonnanceur incrémental de la synchronisation automatique (lecture seule).
 *
 * Logique pure : horloge, transport, bail, enregistrement et journal sont **injectés**.
 * Aucun accès à `chrome.*`, aucun `fetch`, aucun jeton, aucun en-tête. Le transport reçoit un
 * chemin relatif (`GET` même origine) et ne renvoie que le statut et le JSON.
 *
 * Plan incrémental : `stats` → pages de `my-collection` (seulement si quelque chose a changé)
 * → prix du marché (`sales?scope=summary`, jamais la route sans `scope`). Cadence fixe
 * (constantes de `file.ts`), une requête en vol, aucune valeur aléatoire.
 *
 * Le module ne modifie jamais les champs d’édition d’une carte (statut, prix cible, note, ami,
 * `decidePar`) ; il met à jour les faits du site (quantité, favori, identifiants, étiquettes) et,
 * au prix, `valeurMarchande` — sans écraser une valeur saisie à la main.
 */
import { CODES_ARRET, FENETRE_MS, INTERVALLE_MS, MAX_ECHECS, MAX_PAR_FENETRE, type Horloge } from './file';
import { VERSION_SCHEMA, type Carte, type Collection } from './collection';
import { analyserPage, analyserPrix, analyserStats, type CarteLue, type StatsLues } from './lectureApi';

/** Aucune reprise automatique avant ce délai après un arrêt (401, 403, 429 ou échecs). */
export const PAUSE_APRES_ARRET_MS = 30 * 60_000;
/** Une valeur marchande relevée est périmée après 30 jours. */
export const ancienneteMaxPrixMs = 30 * 86_400_000;
/** Durée d’un bail ; renouvelé avant chaque requête. */
export const DUREE_BAIL_MS = 2 * 60_000;
/** Plafond de prix relevés par exécution (le reste attend la synchro suivante). */
export const MAX_PRIX_PAR_EXECUTION = 100;
const PREMIERE_PAGE = 0;
const CARTES_PAR_PAGE = 50;
const PAGES_DE_MARGE = 2;

export interface ReponseApi {
  statut: number;
  json: unknown;
}

export interface PrixReleve {
  /** null : le site n’a pas de valeur pour cette rareté. */
  valeur: number | null;
  releveLe: number;
}

/** État conservé entre deux exécutions (à persister par l’appelant ; ne contient aucun secret). */
export interface EtatOrdonnanceur {
  version: 1;
  total: number | null;
  totalUnique: number | null;
  signatureEtiquettes: string | null;
  /** Horodatage de la dernière lecture complète réussie. */
  derniereComplete: number | null;
  /** Aucune reprise automatique avant cet horodatage. */
  arretJusqua: number | null;
  /** Débuts des dernières requêtes (budget commun aux trois synchros). */
  requetes: number[];
  /** Identifiant local → `card_id` du site, nécessaire à la route des prix. */
  cardIds: Record<string, string>;
  /** Dernier relevé de prix par identifiant local. */
  prix: Record<string, PrixReleve>;
}

export const etatInitial = (): EtatOrdonnanceur => ({
  version: 1,
  total: null,
  totalUnique: null,
  signatureEtiquettes: null,
  derniereComplete: null,
  arretJusqua: null,
  requetes: [],
  cardIds: {},
  prix: {},
});

export interface Bail {
  lire: () => Promise<number | null>;
  ecrire: (expiration: number | null) => Promise<void>;
}

export interface DependancesSynchro {
  horloge: Horloge;
  transport: (chemin: string) => Promise<ReponseApi>;
  collection: Collection;
  etat: EtatOrdonnanceur;
  bail: Bail;
  /** Appelé après chaque page et chaque prix. Références vivantes : à sérialiser tout de suite. */
  enregistrer: (collection: Collection, etat: EtatOrdonnanceur) => Promise<void>;
  journal: (message: string) => void;
  /** Arrêt demandé par le joueur, vérifié avant chaque requête. */
  arretDemande?: () => boolean;
  /** Vrai seulement si un test a prouvé que le tri du site est stable (arrêt à la première page identique). */
  triStable?: boolean;
  /** Plafond de prix par exécution (défaut : MAX_PRIX_PAR_EXECUTION). */
  maxPrix?: number;
}

export type RaisonArretSynchro = 'manuel' | 'code-http' | 'echecs';

export interface SignalementPrix {
  idCarte: string;
  saisie: number;
  site: number;
}

export interface ResultatSynchro {
  issue: 'termine' | 'arret' | 'bail-occupe' | 'repos';
  raison: RaisonArretSynchro | null;
  codeHttp: number | null;
  /** Vrai si la collection a été lue en entier (ou jugée inchangée) sans échec. */
  complete: boolean;
  collection: Collection;
  etat: EtatOrdonnanceur;
  requetes: number;
  pagesLues: number;
  prixReleves: number;
  ignorees: number;
  signalements: SignalementPrix[];
}

// Seuls chemins émis. Aucun autre n’est constructible depuis ce module.
const cheminStats = (): string => '/api/my-collection/stats?sort=rarity';
const cheminPage = (n: number): string => `/api/my-collection?sort=rarity&page=${n}&stats=0`;
const cheminPrix = (cardId: string): string => `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;

const signature = (stats: StatsLues): string =>
  stats.etiquettes
    .map((e) => `${e.id}:${e.nbCartes}`)
    .sort()
    .join(',');

const memeEnsemble = (a: readonly string[] | null, b: readonly string[] | null): boolean =>
  a !== null && b !== null && a.length === b.length && a.every((x) => b.includes(x));

const identique = (locale: Carte | undefined, lue: CarteLue): boolean =>
  locale !== undefined &&
  locale.quantite === lue.quantite &&
  locale.favori === lue.favori &&
  memeEnsemble(locale.idsSite, lue.idsSite) &&
  memeEnsemble(locale.etiquettesSite, lue.etiquettesSite);

function nouvelleCarte(lue: CarteLue): Carte {
  return {
    id: lue.id,
    titre: lue.titre,
    rarete: lue.rarete,
    description: '',
    quantite: lue.quantite,
    url: null,
    favori: lue.favori,
    idsSite: lue.idsSite,
    etiquettesSite: lue.etiquettesSite,
    statut: 'a-trier',
    prixCible: null,
    note: '',
    ami: null,
    valeurMarchande: null,
    decidePar: null,
  };
}

// Un synchro à la fois dans ce contexte JS ; le bail couvre les autres onglets.
let enCours = false;

/** Fin de l’exécution demandée par une cause connue. */
class Interruption extends Error {
  constructor(
    readonly raison: RaisonArretSynchro,
    readonly codeHttp: number | null,
  ) {
    super(raison);
  }
}

export async function synchroniser(deps: DependancesSynchro): Promise<ResultatSynchro> {
  const { horloge, journal } = deps;
  const etat: EtatOrdonnanceur = { ...deps.etat, requetes: [...deps.etat.requetes], cardIds: { ...deps.etat.cardIds }, prix: { ...deps.etat.prix } };
  const parId = new Map<string, Carte>(deps.collection.cartes.map((c) => [c.id, c]));
  const instantane = (): Collection => ({ version: VERSION_SCHEMA, cartes: [...parId.values()] });

  const resultat: ResultatSynchro = {
    issue: 'termine',
    raison: null,
    codeHttp: null,
    complete: false,
    collection: deps.collection,
    etat,
    requetes: 0,
    pagesLues: 0,
    prixReleves: 0,
    ignorees: 0,
    signalements: [],
  };

  let echecs = 0;

  if (etat.arretJusqua !== null && horloge.now() < etat.arretJusqua) {
    journal('Synchronisation en pause après un arrêt : pas de reprise avant la fin du délai.');
    resultat.issue = 'repos';
    return resultat;
  }
  if (enCours) {
    resultat.issue = 'bail-occupe';
    return resultat;
  }
  enCours = true;
  try {
    const tenu = await deps.bail.lire();
    if (tenu !== null && tenu > horloge.now()) {
      journal('Une autre synchronisation est en cours (bail tenu).');
      resultat.issue = 'bail-occupe';
      return resultat;
    }
    etat.arretJusqua = null;
    await deps.bail.ecrire(horloge.now() + DUREE_BAIL_MS);
    try {
      await executer();
    } finally {
      await deps.bail.ecrire(null);
    }
  } finally {
    enCours = false;
  }
  resultat.collection = instantane();
  return resultat;

  // ---------------------------------------------------------------------------------------------

  async function requete(chemin: string): Promise<ReponseApi | null> {
    if (deps.arretDemande?.()) throw new Interruption('manuel', null);
    // Cadence : 6 s depuis la dernière requête, 10 au plus par fenêtre de 60 s (budget commun).
    const t = horloge.now();
    const recentes = etat.requetes.filter((x) => x > t - FENETRE_MS);
    const derniere = recentes.at(-1);
    let echeance = derniere === undefined ? t : derniere + INTERVALLE_MS;
    const dixieme = recentes.at(-MAX_PAR_FENETRE);
    if (recentes.length >= MAX_PAR_FENETRE && dixieme !== undefined) echeance = Math.max(echeance, dixieme + FENETRE_MS);
    await horloge.attendreJusqua(echeance);
    if (deps.arretDemande?.()) throw new Interruption('manuel', null);

    const debut = horloge.now();
    etat.requetes = [...recentes, debut];
    await deps.bail.ecrire(debut + DUREE_BAIL_MS);
    resultat.requetes += 1;
    let reponse: ReponseApi;
    try {
      reponse = await deps.transport(chemin);
    } catch {
      return echec('Requête impossible (réseau).');
    }
    if (CODES_ARRET.includes(reponse.statut)) {
      journal(`Arrêt : le site a répondu ${reponse.statut}.`);
      throw new Interruption('code-http', reponse.statut);
    }
    if (reponse.statut !== 200) return echec(`Réponse ${reponse.statut} inattendue.`);
    return reponse;
  }

  function echec(message: string): null {
    echecs += 1;
    journal(`Échec ${echecs}/${MAX_ECHECS} : ${message}`);
    if (echecs >= MAX_ECHECS) throw new Interruption('echecs', null);
    return null;
  }

  async function executer(): Promise<void> {
    try {
      let complet = true;
      const stats = await lireStats();
      if (stats === null) complet = false;
      const inchange =
        stats !== null &&
        etat.derniereComplete !== null &&
        stats.total === etat.total &&
        stats.totalUnique === etat.totalUnique &&
        signature(stats) === etat.signatureEtiquettes;

      if (!inchange) complet = (await lirePages(stats?.total ?? null)) && complet;
      if (complet && stats !== null) {
        etat.total = stats.total;
        etat.totalUnique = stats.totalUnique;
        etat.signatureEtiquettes = signature(stats);
        etat.derniereComplete = horloge.now();
      } else if (!complet) {
        etat.derniereComplete = null;
      }
      resultat.complete = complet && echecs === 0;
      await deps.enregistrer(instantane(), etat);
      await relevePrix();
    } catch (e) {
      if (!(e instanceof Interruption)) throw e;
      resultat.issue = 'arret';
      resultat.raison = e.raison;
      resultat.codeHttp = e.codeHttp;
      resultat.complete = false;
      if (e.raison !== 'manuel') etat.arretJusqua = horloge.now() + PAUSE_APRES_ARRET_MS;
      await deps.enregistrer(instantane(), etat);
    }
  }

  async function lireStats(): Promise<StatsLues | null> {
    const r = await requete(cheminStats());
    if (r === null) return null;
    const stats = analyserStats(r.json);
    if (stats === null) return echec('Réponse « stats » de forme inattendue.');
    return stats;
  }

  /** Vrai si toutes les pages ont été lues sans échec. */
  async function lirePages(total: number | null): Promise<boolean> {
    let ok = true;
    // Plafond : pages attendues + marge ; au-delà, arrêt propre (lecture jugée incomplète).
    const maxPages = Math.ceil((total ?? 0) / CARTES_PAR_PAGE) + PAGES_DE_MARGE;
    for (let page = PREMIERE_PAGE; ; page++) {
      if (total !== null && page - PREMIERE_PAGE >= maxPages) {
        journal(`Arrêt de la lecture : plus de ${maxPages} pages pour ${total} exemplaires.`);
        return false;
      }
      const r = await requete(cheminPage(page));
      if (r === null) {
        ok = false;
        continue;
      }
      const lue = analyserPage(r.json);
      if (lue === null) {
        echec(`Page ${page} de forme inattendue.`);
        ok = false;
        continue;
      }
      if (lue.fin) return ok;
      resultat.pagesLues += 1;
      if (lue.ignorees > 0) {
        resultat.ignorees += lue.ignorees;
        journal(`${lue.ignorees} carte(s) de forme inattendue ignorée(s) (page ${page}).`);
      }
      const toutIdentique = lue.cartes.length > 0 && lue.cartes.every((c) => identique(parId.get(c.id), c));
      for (const c of lue.cartes) {
        etat.cardIds[c.id] = c.cardId;
        const locale = parId.get(c.id);
        if (!locale) {
          parId.set(c.id, nouvelleCarte(c));
          continue;
        }
        // Faits du site seulement : l’édition locale (dont `decidePar`) n’est jamais touchée.
        parId.set(c.id, { ...locale, quantite: c.quantite, favori: c.favori, idsSite: c.idsSite, etiquettesSite: c.etiquettesSite });
      }
      await deps.enregistrer(instantane(), etat);
      if (deps.triStable && toutIdentique) return ok;
    }
  }

  function candidatsPrix(): Carte[] {
    const maintenant = horloge.now();
    const fraiche = (r: PrixReleve | undefined): r is PrixReleve => r !== undefined && maintenant - r.releveLe <= ancienneteMaxPrixMs;
    const aDecider: Carte[] = [];
    const absentes: Carte[] = [];
    const perimees: Carte[] = [];
    const anciennete = (c: Carte): number => etat.prix[c.id]?.releveLe ?? 0;
    for (const c of parId.values()) {
      if (!c.rarete || !etat.cardIds[c.id]) continue;
      const rec = etat.prix[c.id];
      const saisieMain = c.valeurMarchande !== null && rec?.valeur !== c.valeurMarchande;
      const aJour = c.valeurMarchande === null ? fraiche(rec) && rec.valeur === null : fraiche(rec) && !saisieMain;
      const aJourSaisie = saisieMain && fraiche(rec);
      if (c.statut === 'a-trier') {
        if (!(aJour || aJourSaisie)) aDecider.push(c);
      } else if (!saisieMain && !aJour) {
        (c.valeurMarchande === null ? absentes : perimees).push(c);
      }
    }
    perimees.sort((a, b) => anciennete(a) - anciennete(b));
    return [...aDecider, ...absentes, ...perimees];
  }

  async function relevePrix(): Promise<void> {
    const plafond = deps.maxPrix ?? MAX_PRIX_PAR_EXECUTION;
    for (const carte of candidatsPrix().slice(0, Math.max(0, plafond))) {
      const cardId = etat.cardIds[carte.id];
      if (cardId === undefined) continue;
      const r = await requete(cheminPrix(cardId));
      if (r === null) continue;
      const valeur = analyserPrix(r.json, carte.rarete as string);
      const courante = parId.get(carte.id) as Carte;
      const saisieMain = courante.valeurMarchande !== null && etat.prix[carte.id]?.valeur !== courante.valeurMarchande;
      etat.prix[carte.id] = { valeur, releveLe: horloge.now() };
      if (valeur === null) {
        journal(`Pas de valeur marchande pour « ${carte.titre} ».`);
      } else if (saisieMain) {
        if (valeur !== courante.valeurMarchande) {
          resultat.signalements.push({ idCarte: carte.id, saisie: courante.valeurMarchande as number, site: valeur });
          journal(`Valeur saisie à la main conservée pour « ${carte.titre} » (site : ${valeur}).`);
        }
      } else {
        parId.set(carte.id, { ...courante, valeurMarchande: valeur });
      }
      resultat.prixReleves += 1;
      await deps.enregistrer(instantane(), etat);
    }
  }
}
