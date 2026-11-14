/**
 * Ordonnanceur incrémental de la synchronisation automatique (lecture seule).
 *
 * Logique pure : horloge, transport, bail, enregistrement et journal sont **injectés**.
 * Aucun accès à `chrome.*`, aucun `fetch`, aucun jeton, aucun en-tête. Le transport reçoit un
 * chemin relatif (`GET` même origine) et ne renvoie que le statut et le JSON.
 *
 * Plan incrémental : `stats` → pages de `my-collection` (seulement si quelque chose a changé)
 * → prix du marché (`sales?scope=summary`, jamais la route sans `scope`). Intervalle minimal
 * (constantes de `file.ts`) allongé par un délai variable injecté, une requête en vol.
 *
 * Le module ne modifie jamais les champs d’édition d’une carte (statut, prix cible, note, ami,
 * `decidePar`) ; il met à jour les faits du site (quantité, favori, identifiants, étiquettes) et,
 * au prix, `valeurMarchande` — sans écraser une valeur saisie à la main.
 */
import { CODES_ARRET, INTERVALLE_MS, MAX_ECHECS, type Horloge } from './file';
import { VERSION_SCHEMA, aEditionLocale, type Carte, type Collection } from './collection';
import { analyserPage, analyserPrix, analyserStats, analyserVentes, type CarteLue, type StatsLues } from './lectureApi';

/** Aucune reprise automatique avant ce délai après un arrêt (401, 403, 429 ou échecs). */
export const PAUSE_APRES_ARRET_MS = 30 * 60_000;
/** Une valeur marchande relevée est périmée après 30 jours. */
export const ancienneteMaxPrixMs = 30 * 86_400_000;
/** Durée d’un bail ; renouvelé avant chaque requête. */
export const DUREE_BAIL_MS = 2 * 60_000;
/** Plafond de prix relevés par exécution (le reste attend la synchro suivante). */
export const MAX_PRIX_PAR_EXECUTION = 100;
/** Refus 403 d’affilée sur les prix qui arrêtent la synchro : en dessous, c’est une carte sans route de prix, pas la session. */
export const MAX_REFUS_PRIX_CONSECUTIFS = 3;
/** Plafond de refus de prix sur toute une exécution, qu’un succès intercalé ne remet jamais à zéro. */
export const MAX_REFUS_PRIX_PAR_EXECUTION = 10;
/** Échecs sautés au plus sur toute une exécution, même séparés par des lectures réussies. */
export const MAX_ECHECS_PAR_EXECUTION = 10;
const PREMIERE_PAGE = 0;
const CARTES_PAR_PAGE = 50;
/** Retrait automatique des cartes disparues : au plus ce nombre, ou 10 % de la collection si plus. */
const MAX_RETRAITS_MIN = 10;
/** Plafond de pages quand `total` est inconnu (stats illisibles) : 400 pages = 20 000 exemplaires. */
export const MAX_PAGES_SANS_TOTAL = 400;
/** Passes de lecture au plus quand la collection bouge pendant la lecture. */
export const MAX_PASSES = 3;

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
  /** Enchères du joueur lues sur le site (`marketplace/mine`), pour les places libres. */
  ventesSite?: { enCours: number; max: number; releveLe: number } | null;
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
  /** Relance explicite du joueur : ignore la pause de 30 min après un arrêt (le bail et les arrêts automatiques restent). */
  forcer?: boolean;
  /** Plafond de prix par exécution (défaut : MAX_PRIX_PAR_EXECUTION). */
  maxPrix?: number;
  /** Annonce, une fois avant la boucle de prix, le nombre de prix qui seront demandés (sans effet sur le plan). */
  annoncerPrix?: (n: number) => void;
  /** Millisecondes ajoutées à l’intervalle minimal entre deux requêtes (délai variable). Absent : 0. */
  gigue?: () => number;
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
// Tri « added » (date d’ajout, plus récent d’abord) : permet l’arrêt anticipé. Repli : tri « rarity », lecture complète.
type TriSite = 'added' | 'rarity';
const cheminStats = (): string => '/api/my-collection/stats?sort=added';
const cheminPage = (n: number, tri: TriSite): string => `/api/my-collection?sort=${tri}&page=${n}&stats=0`;
const cheminVentes = (): string => '/api/marketplace/mine';
const cheminPrix = (cardId: string): string => `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`;

const signatureTete = (cartes: readonly CarteLue[]): string =>
  cartes.map((c) => `${c.idsSite.join('+')}:${c.quantite}:${c.favori ? 1 : 0}:${[...c.etiquettesSite].sort().join('|')}`).join(';');

const memesStats = (a: StatsLues, b: StatsLues): boolean =>
  a.total === b.total && a.totalUnique === b.totalUnique && signature(a) === signature(b);

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
    prixCible: null,
    note: '',
    ami: null,
    valeurMarchande: null,
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

  /** Échecs d’affilée (remis à zéro par une lecture réussie) : 3 de suite arrêtent la synchro. */
  let echecs = 0;
  /** Échecs sautés sur toute l’exécution : la synchro n’est pas déclarée complète s’il y en a. */
  let echecsTotal = 0;
  /** Refus 403 consécutifs sur la route des prix (par carte, tolérés un à un). */
  let refusPrix = 0;
  let refusPrixTotal = 0;

  if (!deps.forcer && etat.arretJusqua !== null && horloge.now() < etat.arretJusqua) {
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

  function gigue(): number {
    const g = deps.gigue?.() ?? 0;
    return Number.isFinite(g) ? Math.max(0, g) : 0;
  }

  async function requete(chemin: string, tolerant = false, prix = false): Promise<ReponseApi | null> {
    if (deps.arretDemande?.()) throw new Interruption('manuel', null);
    // Cadence : 0,2 s depuis la dernière requête (budget commun), sans plafond par minute.
    const t = horloge.now();
    const derniere = etat.requetes.length === 0 ? undefined : Math.max(...etat.requetes);
    const echeance = derniere === undefined ? t : Math.max(t, derniere + INTERVALLE_MS + gigue());
    await horloge.attendreJusqua(echeance);
    if (deps.arretDemande?.()) throw new Interruption('manuel', null);

    const debut = horloge.now();
    etat.requetes = [...etat.requetes, debut].slice(-20);
    await deps.bail.ecrire(debut + DUREE_BAIL_MS);
    resultat.requetes += 1;
    let reponse: ReponseApi;
    try {
      reponse = await deps.transport(chemin);
    } catch {
      return tolerant ? null : echec('Requête impossible (réseau).');
    }
    if (prix && (reponse.statut === 403 || reponse.statut === 404)) {
      // Prix d’une seule carte refusé : carte vendue, défaussée ou sans marché. On l’ignore ; la session n’est en
      // cause que si les refus s’enchaînent (401 et 429 arrêtent toujours tout de suite).
      refusPrix += 1;
      refusPrixTotal += 1;
      journal(`Prix indisponible (réponse ${reponse.statut}) : carte ignorée (${refusPrix}/${MAX_REFUS_PRIX_CONSECUTIFS} refus d’affilée).`);
      if (refusPrix >= MAX_REFUS_PRIX_CONSECUTIFS || refusPrixTotal >= MAX_REFUS_PRIX_PAR_EXECUTION) throw new Interruption('code-http', reponse.statut);
      return null;
    }
    if (CODES_ARRET.includes(reponse.statut)) {
      journal(`Arrêt : le site a répondu ${reponse.statut}.`);
      throw new Interruption('code-http', reponse.statut);
    }
    if (reponse.statut !== 200) return tolerant ? null : echec(`Réponse ${reponse.statut} inattendue.`);
    return reponse;
  }

  function echec(message: string): null {
    echecs += 1;
    echecsTotal += 1;
    journal(`Échec ${echecs}/${MAX_ECHECS} d’affilée : ${message} Élément sauté, la synchronisation continue.`);
    if (echecs >= MAX_ECHECS || echecsTotal >= MAX_ECHECS_PAR_EXECUTION) throw new Interruption('echecs', null);
    return null;
  }

  async function executer(): Promise<void> {
    try {
      let complet = true;
      let stats = await lireStats();
      if (stats === null) complet = false;
      // Toutes les cartes sont relues à chaque synchro (Alexis, 2026-11-14) : ni saut « rien n’a changé », ni arrêt anticipé.
      // Lecture robuste aux changements pendant la lecture : les stats sont relues après chaque passe ; si le total, le
      // nombre de cartes distinctes ou les comptes par étiquette ont bougé, ou si les exemplaires lus ne correspondent pas
      // au total, la passe est refaite (3 au plus). Aucun retrait local tant qu’une passe n’est pas propre.
      let propre = false;
      let lecture: { ok: boolean; vus: Set<string> | null; tete?: string | null } = { ok: true, vus: null };
      for (let passe = 1; passe <= MAX_PASSES; passe++) {
        lecture = await lirePages(stats?.total ?? null, null);
        if (!lecture.ok || stats === null) break;
        const fin = await lireStats();
        if (fin === null) break;
        // Contrôle de la tête (plus récents d’abord) : une carte ajoutée ou un favori basculé sur la première page pendant la
        // lecture, à total égal (remplacement), passe sinon inaperçu.
        const teteFin = lecture.tete == null ? null : await lireTete();
        // Contrôle impossible (requête en échec) : abandon sans nouvelle passe ni retrait local.
        if (lecture.tete != null && teteFin === null) {
          stats = fin;
          break;
        }
        const teteStable = lecture.tete == null || teteFin === lecture.tete;
        if (lecture.vus !== null && teteStable && memesStats(stats, fin)) {
          propre = true;
          stats = fin;
          break;
        }
        // Rien n’a bougé côté site mais les exemplaires lus ne correspondent pas au total : la tête de liste est stable : une nouvelle passe n’y changerait rien.
        if (lecture.vus === null && teteStable && memesStats(stats, fin)) {
          stats = fin;
          break;
        }
        journal(`La collection a changé pendant la lecture (passe ${passe}/${MAX_PASSES}) : ${passe < MAX_PASSES ? 'nouvelle lecture.' : 'abandon, aucun retrait local.'}`);
        stats = fin;
      }
      complet = lecture.ok && complet && (stats === null || propre);
      if (propre && lecture.vus !== null && echecsTotal === 0 && resultat.ignorees === 0) retirerDisparues(lecture.vus);
      if (complet && stats !== null) {
        etat.total = stats.total;
        etat.totalUnique = stats.totalUnique;
        etat.signatureEtiquettes = signature(stats);
        etat.derniereComplete = horloge.now();
      } else if (!complet) {
        etat.derniereComplete = null;
      }
      resultat.complete = complet && echecsTotal === 0;
      await deps.enregistrer(instantane(), etat);
      await relevePrix();
      await releveVentes();
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

  /** Signature de la première page (ordre « plus récent d’abord ») : identifiants d’exemplaires, favoris et étiquettes. */
  async function lireTete(): Promise<string | null> {
    const r = await requete(cheminPage(PREMIERE_PAGE, 'added'));
    if (r === null) return null;
    const lue = analyserPage(r.json);
    return lue === null ? null : signatureTete(lue.cartes);
  }

  async function lireStats(): Promise<StatsLues | null> {
    const r = await requete(cheminStats());
    if (r === null) return null;
    const stats = analyserStats(r.json);
    if (stats === null) return echec('Réponse « stats » de forme inattendue.');
    return stats;
  }

  /**
   * Cartes locales absentes d’une lecture complète et cohérente avec `total` : vendues, défaussées ou échangées
   * depuis la dernière synchro. On les retire pour ne plus leur poser d’étiquettes (le site répond 403).
   */
  function retirerDisparues(vus: ReadonlySet<string>): void {
    const absentes = [...parId.values()].filter((c) => !vus.has(c.id));
    // Garde-fou : un écart énorme vient plutôt d’un changement de forme des données que de ventes.
    if (absentes.length > Math.max(MAX_RETRAITS_MIN, Math.floor(parId.size * 0.1))) {
      journal(`${absentes.length} carte(s) absente(s) du site : trop pour un retrait automatique, collection locale inchangée.`);
      return;
    }
    let retirees = 0;
    let marquees = 0;
    for (const c of absentes) {
      delete etat.cardIds[c.id];
      delete etat.prix[c.id];
      if (aEditionLocale(c)) {
        // Décision ou note du joueur : la carte reste, mais n’est plus reliée au site (plus aucune écriture).
        if (c.idsSite !== null || c.etiquettesSite.length > 0) marquees += 1;
        parId.set(c.id, { ...c, idsSite: null, etiquettesSite: [] });
      } else {
        parId.delete(c.id);
        retirees += 1;
      }
    }
    if (retirees + marquees > 0) journal(`Cartes absentes du site (vendues ou cédées) : ${retirees} retirée(s), ${marquees} gardée(s) sans lien avec le site.`);
  }

  /**
   * `ok` : toutes les pages lues sans échec. `vus` : identifiants lus, seulement si la lecture est allée
   * jusqu’au bout (aucun arrêt anticipé) et que le nombre d’exemplaires lus égale `total` ; sinon null.
   */
  async function lirePages(
    total: number | null,
    gain: { exemplaires: number; cartes: number } | null,
  ): Promise<{ ok: boolean; vus: Set<string> | null; tete: string | null }> {
    let ok = true;
    let tete: string | null = null;
    const vus = new Set<string>();
    let exemplairesLus = 0;
    // Identifiants d’exemplaires déjà comptés : un décalage de pagination peut répéter une ligne.
    const idsComptes = new Set<string>();
    const fini = (): { ok: boolean; vus: Set<string> | null; tete: string | null } => ({ ok, vus: ok && total !== null && exemplairesLus === total ? vus : null, tete });
    let tri: TriSite = 'added';
    // Tant que l’ordre « plus récent d’abord » n’est pas confirmé par la page 0, aucun arrêt anticipé.
    let ordreConfirme = false;
    // Exemplaires et cartes gagnés par rapport au local, cumulés page après page.
    let exemplairesGagnes = 0;
    let cartesGagnees = 0;
    // Plafond : pages attendues + marge ; au-delà, arrêt propre (lecture jugée incomplète).
    const maxPages = total === null ? MAX_PAGES_SANS_TOTAL : Math.max(1, Math.ceil(total / CARTES_PAR_PAGE));
    for (let page = PREMIERE_PAGE; ; page++) {
      if (page - PREMIERE_PAGE >= maxPages) {
        journal(total === null ? `Arrêt de la lecture : plus de ${maxPages} pages (total inconnu).` : `Arrêt de la lecture : plus de ${maxPages} pages pour ${total} exemplaires.`);
        return { ok: false, vus: null, tete: null };
      }
      const r = await requete(cheminPage(page, tri));
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
      if (lue.fin) return fini();
      if (page === PREMIERE_PAGE && tri === 'added') {
        if (lue.recentDabord) ordreConfirme = true;
        else {
          // Tri par date non confirmé : repli sur la relecture complète par rareté, depuis la page 0.
          journal('Tri par date d’ajout non confirmé : relecture complète par rareté.');
          tri = 'rarity';
          page = PREMIERE_PAGE - 1;
          continue;
        }
      }
      if (page === PREMIERE_PAGE && tri === 'added') tete = signatureTete(lue.cartes);
      resultat.pagesLues += 1;
      echecs = 0;
      exemplairesLus += lue.ignorees;
      if (lue.ignorees > 0) {
        resultat.ignorees += lue.ignorees;
        journal(`${lue.ignorees} carte(s) de forme inattendue ignorée(s) (page ${page}).`);
      }
      const toutIdentique = lue.cartes.length > 0 && lue.cartes.every((c) => identique(parId.get(c.id), c));
      for (const c of lue.cartes) {
        vus.add(c.id);
        const nouveaux = c.idsSite.filter((id) => !idsComptes.has(id));
        for (const id of nouveaux) idsComptes.add(id);
        exemplairesLus += nouveaux.length === c.idsSite.length ? c.quantite : Math.round((c.quantite * nouveaux.length) / c.idsSite.length);
        etat.cardIds[c.id] = c.cardId;
        const locale = parId.get(c.id);
        exemplairesGagnes += c.quantite - (locale?.quantite ?? 0);
        if (!locale) cartesGagnees += 1;
        if (!locale) {
          parId.set(c.id, nouvelleCarte(c));
          continue;
        }
        // Faits du site seulement : l’édition locale (dont `decidePar`) n’est jamais touchée.
        parId.set(c.id, { ...locale, quantite: c.quantite, favori: c.favori, idsSite: c.idsSite, etiquettesSite: c.etiquettesSite });
      }
      await deps.enregistrer(instantane(), etat);
      // Une page identique au local ne suffit pas : tout l’écart de total doit être expliqué par ce qui a été lu.
      if (gain !== null && ordreConfirme && toutIdentique && exemplairesGagnes === gain.exemplaires && cartesGagnees === gain.cartes) return { ok, vus: null, tete };
      // Fin atteinte sans demander la page suivante (le site la refuse parfois en 403) : page incomplète,
      // ou tous les exemplaires annoncés par `stats` sont lus.
      if (lue.lignes < CARTES_PAR_PAGE) {
        if (total !== null && exemplairesLus < total && resultat.ignorees === 0) {
          journal(`Lecture incomplète : ${exemplairesLus} exemplaire(s) lu(s) pour ${total} annoncé(s).`);
        }
        return fini();
      }
      if (total !== null && exemplairesLus > total) {
        journal(`Lecture incohérente : ${exemplairesLus} exemplaire(s) lu(s) pour ${total} annoncé(s).`);
        return fini();
      }
      if (total !== null && exemplairesLus === total) return fini();
    }
  }

  function candidatsPrix(): Carte[] {
    const maintenant = horloge.now();
    const fraiche = (r: PrixReleve | undefined): r is PrixReleve => r !== undefined && maintenant - r.releveLe <= ancienneteMaxPrixMs;
    const absentes: Carte[] = [];
    const perimees: Carte[] = [];
    const anciennete = (c: Carte): number => etat.prix[c.id]?.releveLe ?? 0;
    for (const c of parId.values()) {
      if (!c.rarete || !etat.cardIds[c.id]) continue;
      const rec = etat.prix[c.id];
      const saisieMain = c.valeurMarchande !== null && rec?.valeur !== c.valeurMarchande;
      const aJour = c.valeurMarchande === null ? fraiche(rec) && rec.valeur === null : fraiche(rec) && !saisieMain;
      if (!saisieMain && !aJour) {
        (c.valeurMarchande === null ? absentes : perimees).push(c);
      }
    }
    perimees.sort((a, b) => anciennete(a) - anciennete(b));
    return [...absentes, ...perimees];
  }

  /** Enchères en cours sur le site : une requête, sans effet sur le compteur d'échecs. */
  async function releveVentes(): Promise<void> {
    const r = await requete(cheminVentes(), true);
    if (r === null) return;
    const lues = analyserVentes(r.json);
    if (lues === null) return;
    etat.ventesSite = { ...lues, releveLe: horloge.now() };
    await deps.enregistrer(instantane(), etat);
  }

  async function relevePrix(): Promise<void> {
    const plafond = deps.maxPrix ?? MAX_PRIX_PAR_EXECUTION;
    const retenues = candidatsPrix().slice(0, Math.max(0, plafond));
    deps.annoncerPrix?.(retenues.length);
    for (const carte of retenues) {
      const cardId = etat.cardIds[carte.id];
      if (cardId === undefined) continue;
      const refusAvant = refusPrix;
      const r = await requete(cheminPrix(cardId), false, true);
      if (r === null) {
        // Refus par carte : on ne la redemande pas avant la fin de l’ancienneté (30 jours), sans valeur inventée.
        if (refusPrix > refusAvant) etat.prix[carte.id] = { valeur: etat.prix[carte.id]?.valeur ?? null, releveLe: horloge.now() };
        continue;
      }
      refusPrix = 0;
      echecs = 0;
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
