import { useCallback, useEffect, useMemo, useState } from 'react';
import { appliquerEdition, collectionVide, type Collection, type EditionCarte } from '../lib/collection';
import type { Registre } from '../lib/actions';
import type { EvenementVente } from '../lib/affluence';
import type { EtiquetteSite } from '../lib/etiquettesPreexistantes';
import { purger } from '../lib/ignorees';
import { registreVide } from '../lib/registre';
import {
  chargerAffluenceSite,
  chargerCacheWikipedia,
  chargerCollection,
  chargerEtiquettesSite,
  chargerExecution,
  chargerIgnorees,
  chargerPreferences,
  chargerRegistre,
  chargerStatutSynchro,
  chargerSynchro,
  chargerVentes,
  ecouterCollection,
  ecouterEtiquettesSite,
  ecouterIgnorees,
  ecouterSynchro,
  ecouterSynchroAuto,
  enregistrerCollection,
  enregistrerIgnorees,
  enregistrerPreferences,
  noterEvenementVente,
} from '../lib/stockage';
import type { Synchro } from '../lib/synchro';
import { definirThemesWikipedia } from '../lib/themes';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import { cacheVide, themesParTitre, type CacheWikipedia } from '../lib/wikipedia';

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
  const [preferences, setPreferences] = useState<Preferences>(preferencesParDefaut);
  const [ventesJoueur, setVentes] = useState<EvenementVente[]>([]);
  const [releveSite, setReleveSite] = useState<EvenementVente[]>([]);
  const ventes = useMemo(() => [...ventesJoueur, ...releveSite], [ventesJoueur, releveSite]);
  const [synchro, setSynchro] = useState<Synchro | null>(null);
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
    void chargerSynchro().then(setSynchro);
    void lireStockageSynchro().then(appliquerStockageSynchro);
    const relireEtiquettes = (): void => void chargerEtiquettesSite().then(setEtiquettesSite).catch(() => setEtiquettesSite(null));
    relireEtiquettes();
    const arreterEtiquettes = ecouterEtiquettesSite(relireEtiquettes);
    const arreterSynchro = ecouterSynchro(setSynchro);
    return () => {
      arreterEtiquettes();
      arreterSynchro();
    };
  }, []);

  // La surcouche des thèmes est posée avant l’état : les rendus qui suivent lisent déjà le nouveau cache.
  const appliquerCacheWiki = useCallback((cache: CacheWikipedia): void => {
    definirThemesWikipedia(themesParTitre(cache));
    setCacheWiki(cache);
  }, []);

  useEffect(() => {
    void chargerCacheWikipedia().then((c) => {
      definirThemesWikipedia(themesParTitre(c));
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
    return ecouterCollection(setCollection);
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
    cacheWiki, appliquerCacheWiki, preferences, setPreferences, preferencesLues, enregistrerLesPreferences,
    ventes, setVentes, synchro, etiquettesSite, registre, executionEnCours, registreIllisible, executionIllisible,
    stockageSynchroLu, relireStockageSynchro, noterVente, appliquer, editer,
  };
}

export type DonneesPage = ReturnType<typeof useDonneesPage>;
