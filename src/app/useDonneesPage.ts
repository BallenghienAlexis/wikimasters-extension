import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appliquerEdition, collectionVide, partagerCartes, type Collection, type EditionCarte } from '../lib/collection';
import type { Registre } from '../lib/actions';
import type { EvenementVente } from '../lib/affluence';
import type { EtiquetteSite } from '../lib/etiquettesPreexistantes';
import { purger } from '../lib/ignorees';
import { registreVide } from '../lib/registre';
import {
  chargerAffluenceSite,
  chargerCacheIA,
  chargerCacheWikipedia,
  chargerThemesAppris,
  enregistrerThemesAppris,
  chargerCollection,
  chargerEtiquettesSite,
  chargerExecution,
  chargerIgnorees,
  chargerPreferences,
  chargerRegistre,
  chargerStatutSynchro,
  chargerVentes,
  ecouterCollection,
  ecouterEtiquettesSite,
  ecouterIgnorees,
  ecouterSynchroAuto,
  enregistrerCollection,
  enregistrerIgnorees,
  enregistrerPreferences,
  noterEvenementVente,
} from '../lib/stockage';
import { definirCategoriesWikipedia, definirSignauxWikipedia, definirThemesAppris, definirThemesIA, definirThemesWikipedia } from '../lib/themes';
import { etatApprisVide, proposerThemes, type EtatAppris } from '../lib/themesAppris';
import { cacheIAVide, themesIAParTitre, type CacheIA } from '../lib/classificationIA';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import { cacheVide, categoriesParTitre, signauxParTitre, themesParTitre, type CacheWikipedia } from '../lib/wikipedia';

const PERIODE_CACHE_MS = 1500;

interface EtatStockageSynchro {
  registre: Registre | null;
  executionEnCours: boolean;
  executionIllisible: boolean;
}

/**
 * Lectures et abonnements du stockage de la page de gestion, montés une fois au-dessus des onglets
 * (le démontage d’un panneau ne perd rien). Purge aussi les actions ignorées devenues sans objet (SC-006).
 */
export function useDonneesPage() {
  const [collection, setCollection] = useState<Collection>(collectionVide);
  const [chargee, setChargee] = useState(false);
  const [blocage, setBlocage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cacheWiki, setCacheWiki] = useState<CacheWikipedia>(cacheVide);
  const [cacheIA, setCacheIA] = useState<CacheIA>(cacheIAVide);
  // Thèmes appris des catégories Wikipédia : posés avant l’état, comme les autres surcouches.
  const [apprisEtat, setApprisEtat] = useState<EtatAppris>(etatApprisVide);
  const [apprisLu, setApprisLu] = useState(false);
  const appliquerApprisEtat = useCallback((etat: EtatAppris, enregistrer = true): void => {
    definirThemesAppris(etat.themes);
    setApprisEtat(etat);
    setCacheWiki((c) => ({ ...c }));
    if (enregistrer) void enregistrerThemesAppris(etat).catch(() => setMessage('Les thèmes appris n’ont pas pu être enregistrés (stockage indisponible).'));
  }, []);
  // L’aperçu des lots attend la lecture du cache IA : sans lui, des cartes classées par l’IA sembleraient sans thème (retraits à tort).
  const [cacheIALu, setCacheIALu] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(preferencesParDefaut);
  const [ventesJoueur, setVentes] = useState<EvenementVente[]>([]);
  const [releveSite, setReleveSite] = useState<EvenementVente[]>([]);
  const ventes = useMemo(() => [...ventesJoueur, ...releveSite], [ventesJoueur, releveSite]);
  const [etiquettesSite, setEtiquettesSite] = useState<EtiquetteSite[] | null>(null);
  const [registre, setRegistre] = useState<Registre>(registreVide);
  const [executionEnCours, setExecutionEnCours] = useState(false);
  const [registreIllisible, setRegistreIllisible] = useState(false);
  const [executionIllisible, setExecutionIllisible] = useState(false);
  // Tant que la lecture initiale du stockage n’est pas finie, l’aperçu du lot n’est pas proposé (D-18).
  const [stockageSynchroLu, setStockageSynchroLu] = useState(false);
  // Les amis fixent les étiquettes d’échange de l’aperçu : il attend aussi la lecture des préférences.
  const [preferencesLues, setPreferencesLues] = useState(false);

  // Note l’heure d’une mise en vente ou d’une fin d’enchère ; un échec est signalé, jamais avalé.
  const noterVente = (type: EvenementVente['type']): void => {
    noterEvenementVente({ type, at: Date.now() })
      .then(setVentes)
      .catch(() => setMessage('L’heure de cette vente n’a pas pu être notée (stockage indisponible).'));
  };

  // Lit le registre et l’état d’exécution ; un échec est signalé à l’aperçu, jamais avalé.
  const lireStockageSynchro = async (): Promise<EtatStockageSynchro> => {
    const etat: EtatStockageSynchro = { registre: null, executionEnCours: false, executionIllisible: false };
    try {
      etat.registre = await chargerRegistre();
    } catch {
      etat.registre = null;
    }
    try {
      etat.executionEnCours = (await chargerExecution())?.etat === 'en-cours';
    } catch {
      etat.executionIllisible = true;
    }
    return etat;
  };
  const appliquerStockageSynchro = (etat: EtatStockageSynchro): void => {
    if (etat.registre) setRegistre(etat.registre);
    setRegistreIllisible(etat.registre === null);
    setExecutionEnCours(etat.executionEnCours);
    setExecutionIllisible(etat.executionIllisible);
    setStockageSynchroLu(true);
  };
  const relireStockageSynchro = async (): Promise<Registre | null> => {
    const etat = await lireStockageSynchro();
    appliquerStockageSynchro(etat);
    return etat.registre;
  };

  useEffect(() => {
    void chargerPreferences()
      .then(setPreferences)
      .finally(() => setPreferencesLues(true));
    void chargerVentes()
      .then(setVentes)
      .catch(() => setMessage('Le journal des ventes n’a pas pu être lu (stockage indisponible).'));
    void chargerAffluenceSite().then(setReleveSite).catch(() => undefined);
    void lireStockageSynchro().then(appliquerStockageSynchro);
    const relireEtiquettes = (): void => void chargerEtiquettesSite().then(setEtiquettesSite).catch(() => setEtiquettesSite(null));
    relireEtiquettes();
    const arreterEtiquettes = ecouterEtiquettesSite(relireEtiquettes);
    return () => {
      arreterEtiquettes();
    };
  }, []);

  // La surcouche des thèmes est posée avant l’état : les rendus qui suivent lisent déjà le nouveau cache.
  const dernierCache = useRef<CacheWikipedia>(cacheVide());
  const dernierApplication = useRef(0);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (minuterie.current !== null) clearTimeout(minuterie.current);
  }, []);
  const appliquerCacheWiki = useCallback((cache: CacheWikipedia): void => {
    definirThemesWikipedia(themesParTitre(cache));
    definirSignauxWikipedia(signauxParTitre(cache));
    definirCategoriesWikipedia(categoriesParTitre(cache));
    // Rendus groupés : la lecture de fond envoie un cache par titre ; l’état (donc le tableau) suit au plus tous les 1,5 s.
    dernierCache.current = cache;
    const ecoule = Date.now() - dernierApplication.current;
    if (ecoule >= PERIODE_CACHE_MS) {
      dernierApplication.current = Date.now();
      setCacheWiki(cache);
    } else if (minuterie.current === null) {
      minuterie.current = setTimeout(() => {
        minuterie.current = null;
        dernierApplication.current = Date.now();
        setCacheWiki(dernierCache.current);
      }, PERIODE_CACHE_MS - ecoule);
    }
  }, []);

  // Même principe pour les thèmes attribués par l’API Claude : posés avant l’état.
  const appliquerCacheIA = useCallback((cache: CacheIA): void => {
    definirThemesIA(themesIAParTitre(cache));
    setCacheIA(cache);
    // Les rendus qui dépendent de `cacheWiki` pour relire les thèmes (collection, synchro) doivent aussi se refaire.
    setCacheWiki((c) => ({ ...c }));
  }, []);

  useEffect(() => {
    void chargerThemesAppris().then((e) => appliquerApprisEtat(e, false)).finally(() => setApprisLu(true));
  }, [appliquerApprisEtat]);

  // Un thème naît quand une catégorie atteint le seuil de cartes (pose automatique). Le calcul attend la fin d’une rafale de lectures,
  // mais jamais plus de 60 s : la lecture de fond change le cache toutes les secondes pendant des heures.
  const dernierCalculApprentis = useRef(0);
  useEffect(() => {
    if (!apprisLu) return;
    const calculer = (): void => {
      dernierCalculApprentis.current = Date.now();
      const suivant = proposerThemes(cacheWiki.entrees, apprisEtat, Date.now());
      const change = suivant.themes.length !== apprisEtat.themes.length || suivant.themes.some((t, i) => t.cartes !== apprisEtat.themes[i]?.cartes);
      if (change) appliquerApprisEtat(suivant);
    };
    const attente = Math.max(0, Math.min(5000, dernierCalculApprentis.current + 60_000 - Date.now()));
    const minuteur = setTimeout(calculer, attente);
    return () => clearTimeout(minuteur);
  }, [apprisLu, cacheWiki, apprisEtat, appliquerApprisEtat]);

  useEffect(() => {
    void chargerCacheIA().then(appliquerCacheIA).finally(() => setCacheIALu(true));
  }, [appliquerCacheIA]);

  useEffect(() => {
    void chargerCacheWikipedia().then((c) => {
      definirThemesWikipedia(themesParTitre(c));
      definirSignauxWikipedia(signauxParTitre(c));
      definirCategoriesWikipedia(categoriesParTitre(c));
      setCacheWiki(c);
    });
  }, []);

  useEffect(() => {
    chargerCollection()
      .then((c) => {
        setCollection(c);
        setChargee(true);
      })
      .catch((e: unknown) => setBlocage(e instanceof Error ? e.message : 'Chargement impossible.'));
    // La lecture du site, dans un autre onglet, met à jour cette page.
    return ecouterCollection((c) => setCollection((avant) => partagerCartes(avant, c)));
  }, []);

  // Purge des ignorées (SC-006) : à l’ouverture, à chaque changement du statut de synchro, de la liste ou de la collection.
  // Jamais avant la lecture de la collection (toutes les cartes sembleraient disparues). Relecture juste avant l’écriture.
  const [versionPurge, setVersionPurge] = useState(0);
  useEffect(() => {
    const arreter = [ecouterSynchroAuto(() => setVersionPurge((v) => v + 1)), ecouterIgnorees(() => setVersionPurge((v) => v + 1))];
    return () => arreter.forEach((a) => a());
  }, []);
  useEffect(() => {
    if (!chargee || blocage) return;
    let actif = true;
    void (async () => {
      const [liste, statutSynchro] = await Promise.all([chargerIgnorees(), chargerStatutSynchro()]);
      const gardees = purger(liste, { maintenant: Date.now(), statutSynchro, cartes: new Set(collection.cartes.map((c) => c.id)) });
      if (!actif || gardees.length === liste.length) return;
      // Relecture juste avant l’écriture : on ne retire que les entrées purgées, une ignorée ajoutée entre-temps est conservée.
      const retirees = liste.filter((i) => !gardees.includes(i));
      const courante = await chargerIgnorees();
      const suite = courante.filter((i) => !retirees.some((r) => r.type === i.type && r.idCarte === i.idCarte && r.parametre === i.parametre && r.date === i.date));
      if (suite.length !== courante.length) await enregistrerIgnorees(suite);
    })().catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [chargee, blocage, collection.cartes, versionPurge]);

  const appliquer = (suivante: Collection): void => {
    setCollection(suivante);
    enregistrerCollection(suivante).catch(() => setMessage('Enregistrement impossible : la dernière modification risque d’être perdue.'));
  };
  const editer = (id: string, edition: EditionCarte): void => appliquer(appliquerEdition(collection, id, edition));

  const enregistrerLesPreferences = (suivantes: Preferences, echec: string): void => {
    setPreferences(suivantes);
    enregistrerPreferences(suivantes).catch(() => setMessage(echec));
  };

  return {
    collection, setCollection, chargee, setChargee, blocage, setBlocage, message, setMessage,
    apprisEtat, appliquerApprisEtat, cacheWiki, appliquerCacheWiki, cacheIA, cacheIALu, appliquerCacheIA, preferences, setPreferences, preferencesLues, enregistrerLesPreferences,
    ventes, setVentes, etiquettesSite, registre, executionEnCours, registreIllisible, executionIllisible,
    stockageSynchroLu, relireStockageSynchro, noterVente, appliquer, editer,
  };
}

export type DonneesPage = ReturnType<typeof useDonneesPage>;
