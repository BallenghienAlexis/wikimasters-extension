// Exécuteur de la vérification Wikipédia : seul fichier de l'application qui appelle `fetch` vers Wikipédia.
// GET en lecture seule vers fr.wikipedia.org (et www.wikidata.org si Wikipédia ne donne aucun thème), un titre de carte par requête, sans cookie ni en-tête ajouté.
import { avecParents } from '../lib/themes';
import { ajouterEntree, lireEntiteWikidata, lireHomonymie, themesDepuisHomonymie, urlRequeteHomonymie, lireLibellesWikidata, lireReponse, lireReponseWikidata, themesDepuisCategories, themesDepuisWikidata, signauxWikipedia, titresAVerifier, urlEntiteWikidata, urlLibellesWikidata, urlRequete, urlRequeteWikidata, type CacheWikipedia } from '../lib/wikipedia';
import { lireEntitesWikidata, PROPRIETES_CARTE, type EntiteGraphe, type GrapheWikidata } from '../lib/classesWikidata';
import { attendreReel } from './attente';
import { themesWikidataDe } from './grapheWikidata';

export type Transport = (url: string, signal: AbortSignal) => Promise<{ status: number; json: () => Promise<unknown> }>;

const transportReel: Transport = (url, signal) => fetch(url, { method: 'GET', credentials: 'omit', redirect: 'error', signal });

export type RaisonArret = 'manuel' | 'code-http' | 'echecs';

export interface ResultatVerification {
  verifiees: number;
  arret: RaisonArret | null;
  codeHttp: number | null;
}

export interface OptionsVerification {
  titres: string[];
  cache: CacheWikipedia;
  signal: AbortSignal;
  /** Appelé après chaque page lue, avec le cache à jour (à enregistrer). */
  surProgres: (cache: CacheWikipedia, faites: number) => void | Promise<void>;
  maintenant?: () => number;
  attendre?: (ms: number, signal: AbortSignal) => Promise<void>;
  transport?: Transport;
  /** Graphe des classes Wikidata déjà lues (ancêtres), complété sur place ; absent = les thèmes par classes ne sont pas calculés. */
  graphe?: GrapheWikidata;
  /** Appelé quand le graphe a grandi, pour l'enregistrer. */
  surGraphe?: (graphe: GrapheWikidata) => void | Promise<void>;
}

/** Cadence fixe : une requête à la fois, une par seconde. */
export const PAUSE_MS = 1000;
const MAX_ECHECS = 3;

export async function verifierTitres(options: OptionsVerification): Promise<ResultatVerification> {
  const { titres, signal, surProgres, maintenant = Date.now, attendre = attendreReel, transport = transportReel, graphe, surGraphe } = options;
  let cache = options.cache;
  let verifiees = 0;
  let echecs = 0;
  let echecsWikidata = 0;
  let codeArret = 0;
  // GET annexe (même cadence : une seconde de pause avant). null = rien d'exploitable ; 403/429 ou arrêt manuel lèvent une AbortError.
  const appeler = async (url: string): Promise<unknown> => {
    await attendre(PAUSE_MS, signal);
    if (signal.aborted) throw new DOMException('arret', 'AbortError');
    let r;
    try {
      r = await transport(url, signal);
    } catch {
      if (signal.aborted) throw new DOMException('arret', 'AbortError');
      return null;
    }
    if (r.status === 403 || r.status === 429) {
      codeArret = r.status;
      throw new DOMException('arret', 'AbortError');
    }
    try {
      return r.status === 200 ? await r.json() : null;
    } catch {
      return null;
    }
  };
  // Lit les classes de l'entité Wikidata (2 GET, plus les ancêtres des classes par lots de 50 : une même classe n'est jamais redemandée).
  // null = rien d'exploitable (on continue sans) ; 'arret' = 403/429 ou arrêt manuel.
  const lireEnrichissement = async (qid: string): Promise<{ classes: string[]; humain: boolean; themesClasses: string[] } | 'arret' | null> => {
    try {
      const brut = await appeler(urlEntiteWikidata(qid));
      const entite = lireEntiteWikidata(brut, qid);
      if (entite === null) return null;
      // Thèmes par la table classe → thème (2026-11-19) : lecture du graphe de la carte, sans effet si l'appelant n'en fournit pas.
      let themesClasses: string[] = [];
      if (graphe !== undefined) {
        const racine: EntiteGraphe | undefined = lireEntitesWikidata(brut, [...PROPRIETES_CARTE, 'P171'])?.[qid];
        const lus = racine === undefined ? null : await themesWikidataDe(qid, racine, graphe, appeler);
        if (lus !== null) {
          themesClasses = lus.themes;
          // Un enregistrement impossible (quota) n'est pas un refus du site : les thèmes de la carte sont gardés, le graphe se relira.
          if (lus.ajoutees > 0) await Promise.resolve(surGraphe?.(graphe)).catch(() => undefined);
        }
      }
      if (entite.classes.length === 0) return { classes: [], humain: entite.humain, themesClasses };
      const libelles = lireLibellesWikidata(await appeler(urlLibellesWikidata(entite.classes)));
      return libelles === null ? null : { classes: libelles, humain: entite.humain, themesClasses };
    } catch {
      return 'arret';
    }
  };
  for (const titre of titres) {
    if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
    // MediaWiki découpe `titles` sur « | » : un tel titre interrogerait plusieurs pages, on le saute.
    if (titre.includes('|')) {
      cache = ajouterEntree(cache, titre, [], maintenant(), true, { fortes: [], faibles: [], genre: 'autre' });
      await surProgres(cache, ++verifiees);
      continue;
    }
    let reponse;
    try {
      reponse = await transport(urlRequete(titre), signal);
    } catch {
      if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
      if (++echecs >= MAX_ECHECS) return { verifiees, arret: 'echecs', codeHttp: null };
      await attendre(PAUSE_MS, signal);
      continue;
    }
    // 403 et 429 : Wikipédia demande de ralentir ou refuse ; on s'arrête sans insister.
    if (reponse.status === 403 || reponse.status === 429) return { verifiees, arret: 'code-http', codeHttp: reponse.status };
    let lecture;
    try {
      lecture = reponse.status === 200 ? lireReponse(await reponse.json()) : ({ type: 'invalide' } as const);
    } catch {
      lecture = { type: 'invalide' } as const;
    }
    if (lecture.type === 'invalide') {
      if (++echecs >= MAX_ECHECS) return { verifiees, arret: 'echecs', codeHttp: null };
    } else {
      echecs = 0;
      // Page absente ou ambiguë : on mémorise « aucun thème » pour ne pas la redemander avant 30 jours.
      let signaux = lecture.type === 'ok' ? signauxWikipedia(lecture.categories, lecture.resume) : undefined;
      // Type et métier d'après Wikidata (instance de, occupation, genre, sport) : deux GET de plus, seulement si la page a un identifiant.
      // Un échec de cette étape n'en est pas un : la carte garde ce que Wikipédia a donné (403 et 429 arrêtent toujours).
      let classes: string[] = [];
      let themesClasses: string[] = [];
      let humain = false;
      let enrichi = false;
      if (lecture.type === 'ok' && lecture.qid !== undefined) {
        const lu = await lireEnrichissement(lecture.qid);
        if (lu === 'arret') return { verifiees, arret: signal.aborted ? 'manuel' : 'code-http', codeHttp: signal.aborted ? null : codeArret };
        if (lu !== null) {
          classes = lu.classes;
          themesClasses = lu.themesClasses;
          humain = lu.humain;
          enrichi = true;
        }
      }
      if (enrichi && signaux !== undefined && lecture.type === 'ok') signaux = signauxWikipedia(lecture.categories, lecture.resume, [], classes, humain, themesClasses);
      let themes = lecture.type === 'ok' ? themesDepuisCategories(lecture.categories, lecture.resume) : [];
      // Page d'homonymie (Zidane, Renault, B612…) : les entrées listées donnent les thèmes dominants (un GET de plus, même route).
      let homonymie = false;
      if (lecture.type === 'ambigue') {
        let texte: string | null;
        try {
          texte = lireHomonymie(await appeler(urlRequeteHomonymie(titre)));
        } catch {
          return signal.aborted ? { verifiees, arret: 'manuel', codeHttp: null } : { verifiees, arret: 'code-http', codeHttp: codeArret };
        }
        // Une réponse illisible n'est pas un échec : la carte reste sans thème local et l'entrée sera relue dans 30 jours.
        const dominants = texte === null ? [] : themesDepuisHomonymie(texte);
        if (dominants.length > 0) {
          themes = avecParents(dominants);
          signaux = { fortes: dominants, faibles: [], genre: 'autre' };
          homonymie = true;
        }
      }
      if (enrichi) themes = [...new Set([...themes, ...themesDepuisWikidata(classes)])];
      // Les thèmes des classes ne sont qu'un repli : ils n'entrent dans la liste des thèmes de la carte (amis, favoris, pré-coche) que si rien d'autre n'en donne.
      if (enrichi && themes.length === 0) themes = avecParents(themesClasses);
      // Wikipédia n'a rien donné : courte description Wikidata (même cadence, titre seul), sinon l'entrée sera relue une fois.
      let wikidata = false;
      if (themes.length === 0) {
        await attendre(PAUSE_MS, signal);
        if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
        let r2;
        try {
          r2 = await transport(urlRequeteWikidata(titre), signal);
        } catch {
          if (signal.aborted) return { verifiees, arret: 'manuel', codeHttp: null };
          r2 = null;
        }
        if (r2 && (r2.status === 403 || r2.status === 429)) return { verifiees, arret: 'code-http', codeHttp: r2.status };
        let lu2 = false;
        if (r2 && r2.status === 200) {
          try {
            const l2 = lireReponseWikidata(await r2.json(), titre);
            if (l2.type === 'ok') {
              themes = themesDepuisWikidata(l2.descriptions);
              signaux = signauxWikipedia(lecture.type === 'ok' ? lecture.categories : [], lecture.type === 'ok' ? lecture.resume : '', l2.descriptions);
              wikidata = true;
              lu2 = true;
            }
          } catch {
            // Réponse illisible : comptée comme un échec ci-dessous.
          }
        }
        // Même règle que Wikipédia : un échec de Wikidata compte, rien n'est mémorisé, 3 échecs arrêtent.
        if (!lu2) {
          if (++echecsWikidata >= MAX_ECHECS) return { verifiees, arret: 'echecs', codeHttp: null };
          await attendre(PAUSE_MS, signal);
          continue;
        }
        echecsWikidata = 0;
      }
      cache = ajouterEntree(cache, titre, themes, maintenant(), wikidata || enrichi || homonymie, signaux, lecture.type === 'ok' ? lecture.categories : []);
      verifiees += 1;
      await surProgres(cache, verifiees);
    }
    await attendre(PAUSE_MS, signal);
  }
  return { verifiees, arret: null, codeHttp: null };
}

export interface EtatPlanificateur {
  enCours: boolean;
  /** Message d'arrêt tant que la vérification est suspendue (jusqu'au rechargement de la page). */
  suspendue: string | null;
  faites: number;
  total: number;
  /** Titres en attente de la lecture de fond (cartes sans thème hors de la liste affichée). */
  fond: number;
}

export interface OptionsPlanificateur {
  chargerCache: () => Promise<CacheWikipedia>;
  /** Appelé avec le cache à jour après chaque page lue (à enregistrer et à afficher). */
  surCache: (cache: CacheWikipedia) => void | Promise<void>;
  maintenant?: () => number;
  attendre?: (ms: number, signal: AbortSignal) => Promise<void>;
  transport?: Transport;
  /** Charge le graphe des classes Wikidata mémorisé (une fois) ; absent = pas de thèmes par classes. */
  chargerGraphe?: () => Promise<GrapheWikidata>;
  /** Enregistre le graphe quand il a grandi. */
  surGraphe?: (graphe: GrapheWikidata) => void | Promise<void>;
}

export interface Planificateur {
  /** Met en file les titres jamais tentés depuis le chargement de la page ; sans effet si c'est suspendu. */
  demander: (titres: string[], fond?: boolean) => void;
  /**
   * Vue liste quittée : vide la file et coupe la requête en vol ainsi que la suite (Wikidata) du titre en cours ;
   * ces titres seront redemandés au retour. La cadence d'une requête par seconde reste garantie après une annulation.
   * La file de fond (`demander(titres, true)`) n'est jamais vidée ni coupée par une annulation.
   */
  annuler: () => void;
  etat: () => EtatPlanificateur;
  abonner: (rappel: () => void) => () => void;
}

const MESSAGE_CODE = (code: number | null): string => `Wikipédia ou Wikidata a refusé (${code ?? '?'}) : vérification suspendue jusqu’au rechargement de la page.`;
const MESSAGE_ECHECS = 'Vérification suspendue : trop d’échecs de lecture. Elle reprendra au rechargement de la page.';

/**
 * File unique des vérifications : une seule exécution à la fois, un titre jamais redemandé dans la session,
 * suspension définitive (jusqu'au rechargement) sur 403/429 ou 3 échecs de suite. À créer une seule fois par page.
 */
export function creerPlanificateur(options: OptionsPlanificateur): Planificateur {
  const { chargerCache, surCache, maintenant = Date.now, attendre = attendreReel, transport = transportReel, chargerGraphe, surGraphe } = options;
  // Début de la dernière requête réellement partie : la cadence d'une par seconde tient même après une annulation.
  let dernierDepart = Number.NEGATIVE_INFINITY;
  const transportHorodate: Transport = (url, signal) => {
    if (!signal.aborted) dernierDepart = maintenant();
    return transport(url, signal);
  };
  const respecterCadence = async (): Promise<void> => {
    const reste = PAUSE_MS - (maintenant() - dernierDepart);
    // Signal neuf : cette attente ne doit jamais être raccourcie par une annulation.
    if (reste > 0) await attendre(reste, new AbortController().signal);
  };
  const file: string[] = [];
  // Lecture de fond (toutes les cartes sans thème) : passe après la file de la liste affichée, survit à `annuler`.
  const fileFond: string[] = [];
  let courantFond = false;
  const tentes = new Set<string>();
  const ecouteurs = new Set<() => void>();
  let etat: EtatPlanificateur = { enCours: false, suspendue: null, faites: 0, total: 0, fond: 0 };
  let cache: CacheWikipedia | null = null;
  let graphe: GrapheWikidata | undefined;
  // Annulé quand la vue liste est quittée : coupe la requête en vol et la suite (Wikidata) du titre en cours.
  let controleur = new AbortController();

  const changer = (suite: Partial<EtatPlanificateur>): void => {
    etat = { ...etat, ...suite };
    ecouteurs.forEach((rappel) => rappel());
  };

  async function boucle(): Promise<void> {
    changer({ enCours: true, faites: 0, total: file.length, fond: fileFond.length });
    let echecs = 0;
    try {
      cache ??= await chargerCache();
      if (chargerGraphe !== undefined) graphe ??= await chargerGraphe();
      while (file.length > 0 || fileFond.length > 0) {
        courantFond = file.length === 0;
        const titre = (courantFond ? fileFond.shift() : file.shift()) as string;
        changer({ fond: fileFond.length });
        if (titresAVerifier([titre], cache, maintenant()).length === 0) continue;
        await respecterCadence();
        const signal = controleur.signal;
        const r = await verifierTitres({
          titres: [titre],
          cache,
          signal,
          maintenant,
          attendre,
          transport: transportHorodate,
          graphe,
          surGraphe,
          surProgres: async (nouveau) => {
            cache = nouveau;
            await surCache(nouveau);
          },
        });
        if (signal.aborted && r.arret === 'manuel') {
          // Vue quittée : ce titre sera redemandé au retour, rien n'est compté.
          tentes.delete(titre);
          continue;
        }
        if (r.arret === 'code-http') return void changer({ suspendue: MESSAGE_CODE(r.codeHttp) });
        // Aucune page lue et aucun arrêt : réponse illisible ou erreur réseau.
        echecs = r.verifiees === 0 ? echecs + 1 : 0;
        if (echecs >= 3) return void changer({ suspendue: MESSAGE_ECHECS });
        changer(courantFond ? { fond: fileFond.length } : { faites: etat.faites + 1, total: etat.faites + 1 + file.length });
      }
    } catch {
      changer({ suspendue: 'Enregistrement du cache Wikipédia impossible : vérification suspendue.' });
    } finally {
      file.length = 0;
      fileFond.length = 0;
      changer({ enCours: false, fond: 0 });
    }
  }

  return {
    demander(titres, fond = false) {
      if (etat.suspendue !== null) return;
      const cible = fond ? fileFond : file;
      for (const titre of titres) {
        if (!fond && tentes.has(titre)) {
          // Déjà en attente dans la file de fond : la liste affichée le fait passer devant.
          const rang = fileFond.indexOf(titre);
          if (rang !== -1) {
            fileFond.splice(rang, 1);
            file.push(titre);
          }
          continue;
        }
        if (tentes.has(titre)) continue;
        tentes.add(titre);
        cible.push(titre);
      }
      if (!etat.enCours && cible.length > 0) void boucle();
      else if (etat.enCours) changer({ total: etat.faites + file.length, fond: fileFond.length });
    },
    annuler() {
      // Un titre de fond en cours n'est pas coupé : seule la file de la liste affichée est vidée.
      if (!courantFond) {
        controleur.abort();
        controleur = new AbortController();
      }
      for (const titre of file) tentes.delete(titre);
      file.length = 0;
      if (etat.enCours) changer({ total: etat.faites, fond: fileFond.length });
    },
    etat: () => etat,
    abonner(rappel) {
      ecouteurs.add(rappel);
      return () => ecouteurs.delete(rappel);
    },
  };
}
