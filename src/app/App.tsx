import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LIBELLES_STATUT,
  STATUTS,
  appliquerEdition,
  collectionVide,
  filtrerCartes,
  resumer,
  terminerEnchere,
  type Collection,
  type EditionCarte,
  type Filtres,
} from '../lib/collection';
import { chargerCacheWikipedia, chargerCollection, chargerExecution, chargerPreferences, chargerRegistre, chargerSynchro, ecouterCollection, ecouterSynchro, enregistrerCollection, enregistrerPreferences, chargerAffluenceSite, chargerVentes, noterEvenementVente, lireCollectionBrute, reinitialiserCollection } from '../lib/stockage';
import { progression, texteProgression, type Synchro } from '../lib/synchro';
import { LIBELLES_THEMES, IDS_THEMES, definirThemesWikipedia, themesDeCarte } from '../lib/themes';
import { cacheVide, themesParTitre, type CacheWikipedia } from '../lib/wikipedia';
import VerificationWikipedia from './VerificationWikipedia';
import { appliquerTri, preferencesParDefaut, type Preferences } from '../lib/tri';
import type { Registre } from '../lib/actions';
import type { EvenementVente } from '../lib/affluence';
import { registreVide } from '../lib/registre';
import AssistantTri from './AssistantTri';
import Synchronisation from './Synchronisation';
import SynchroAuto from './SynchroAuto';
import FileVente from './FileVente';
import CarteLigne from './CarteLigne';

interface EtatStockageSynchro {
  registre: Registre | null;
  executionEnCours: boolean;
  executionIllisible: boolean;
}

const TAILLE_PAGE = 200;
const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';
const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3';

function telecharger(contenu: string, nom: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

const App: React.FC = () => {
  const [collection, setCollection] = useState<Collection>(collectionVide);
  const [chargee, setChargee] = useState(false);
  const [blocage, setBlocage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [limite, setLimite] = useState(TAILLE_PAGE);
  const [filtres, setFiltres] = useState<Filtres>({ recherche: '', statut: 'tous', doublonsSeulement: false });
  const [theme, setTheme] = useState('tous');
  const [cacheWiki, setCacheWiki] = useState<CacheWikipedia>(cacheVide);
  const [preferences, setPreferences] = useState<Preferences>(preferencesParDefaut);
  const [assistantOuvert, setAssistantOuvert] = useState(false);
  const [ventesJoueur, setVentes] = useState<EvenementVente[]>([]);
  const [releveSite, setReleveSite] = useState<EvenementVente[]>([]);
  const ventes = useMemo(() => [...ventesJoueur, ...releveSite], [ventesJoueur, releveSite]);
  const [synchro, setSynchro] = useState<Synchro | null>(null);
  const [registre, setRegistre] = useState<Registre>(registreVide);
  const [executionEnCours, setExecutionEnCours] = useState(false);
  const [registreIllisible, setRegistreIllisible] = useState(false);
  const [executionIllisible, setExecutionIllisible] = useState(false);
  const [confirmerReinit, setConfirmerReinit] = useState(false);
  const [echecRecuperation, setEchecRecuperation] = useState<string | null>(null);
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
    return ecouterSynchro(setSynchro);
  }, []);

  // La surcouche des thèmes est posée avant l'état : les rendus qui suivent lisent déjà le nouveau cache.
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

  const visibles = useMemo(
    () => filtrerCartes(collection.cartes, filtres).filter((c) => theme === 'tous' || themesDeCarte(c).includes(theme)),
    // `cacheWiki` change les thèmes lus par `themesDeCarte` (surcouche Wikipédia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection.cartes, filtres, theme, cacheWiki],
  );
  // Cartes consultées = cartes affichées dans la liste (les pages suivantes comptent quand on les ouvre).
  const titresConsultes = useMemo(() => visibles.slice(0, limite).map((c) => c.titre), [visibles, limite]);
  const resume = useMemo(() => resumer(collection.cartes), [collection.cartes]);

  const appliquer = (suivante: Collection): void => {
    setCollection(suivante);
    enregistrerCollection(suivante).catch(() => setMessage('Enregistrement impossible : la dernière modification risque d’être perdue.'));
  };

  const editer = (id: string, edition: EditionCarte): void => appliquer(appliquerEdition(collection, id, edition));

  const appliquerAssistant = (choix: Preferences): void => {
    setPreferences(choix);
    enregistrerPreferences(choix).catch(() => setMessage('Enregistrement de vos réponses impossible.'));
    appliquer(appliquerTri(collection, choix));
    setRevision((r) => r + 1);
    setAssistantOuvert(false);
    setMessage('Tri appliqué. À vous d’agir sur WikiMasters : les repères vous guident sur chaque carte.');
  };

  if (blocage) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <h1 className="text-2xl font-semibold">WM Collection</h1>
        <p role="alert" className="mt-4">{blocage}</p>
        <p className="mt-2 text-muted">
          Vos données ne sont pas effacées. Si vous venez de mettre à jour l’extension, rechargez-la depuis le dossier <code>dist/</code> reconstruit. Sinon, sauvegardez d’abord le contenu, puis réinitialisez.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={CLASSE_BOUTON}
            onClick={() => {
              lireCollectionBrute()
                .then((brut) => telecharger(JSON.stringify(brut ?? null, null, 2), 'wm-collection-brute.json', 'application/json'))
                .catch(() => setEchecRecuperation('Téléchargement impossible.'));
            }}
          >
            Télécharger les données brutes
          </button>
          {confirmerReinit ? (
            <>
              <button
                type="button"
                className={CLASSE_BOUTON}
                autoFocus
                onClick={() => {
                  reinitialiserCollection()
                    .then(() => {
                      setBlocage(null);
                      setCollection(collectionVide());
                      setChargee(true);
                    })
                    .catch(() => setEchecRecuperation('Réinitialisation impossible : rien n’a été effacé.'));
                }}
              >
                Oui, effacer la collection
              </button>
              <button type="button" className={CLASSE_BOUTON} onClick={() => setConfirmerReinit(false)}>
                Annuler
              </button>
            </>
          ) : (
            <button type="button" className={CLASSE_BOUTON} onClick={() => setConfirmerReinit(true)}>
              Réinitialiser la collection
            </button>
          )}
        </div>
        {echecRecuperation && <p role="status" className="mt-3">{echecRecuperation}</p>}
      </main>
    );
  }
  if (!chargee) return <p className="p-4">Chargement…</p>;

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">WM Collection</h1>
        <div className="flex flex-wrap gap-2">
          {collection.cartes.length > 0 && (
            <button type="button" className={CLASSE_BOUTON} onClick={() => setAssistantOuvert(true)}>
              Gérer mes thèmes et mes amis
            </button>
          )}
        </div>
      </header>

      <p className="mt-3 text-sm text-muted">
        Vos modifications restent dans cette extension : rien n’est changé sur WikiMasters. Chaque page Collection que vous ouvrez sur le site est ajoutée ici.
      </p>

      {synchro && <p className="mt-2 font-medium" data-testid="synchro">{texteProgression(progression(synchro))}</p>}

      <p role="status" className="mt-2 min-h-6">{message}</p>

      {assistantOuvert ? (
        <AssistantTri
          cacheWiki={cacheWiki}
          collection={collection}
          preferencesInitiales={preferences}
          onAppliquer={appliquerAssistant}
          onFermer={() => setAssistantOuvert(false)}
        />
      ) : collection.cartes.length === 0 ? (
        <p className="mt-6 rounded border border-line bg-ink-2 p-6">
          Votre collection est vide. Ouvrez la page Collection de WikiMasters : la synchronisation automatique la remplit.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm" data-testid="resume">
            {resume.exemplaires} exemplaires · {resume.doublons} doublons ·{' '}
            {STATUTS.map((s) => `${LIBELLES_STATUT[s]} : ${resume.parStatut[s]}`).join(' · ')}
          </p>

          <FileVente
            cartes={collection.cartes}
            ventes={ventes}
            onMiseEnVente={(id) => {
              editer(id, { statut: 'en-vente', decidePar: 'moi' });
              noterVente('debut');
            }}
            onTerminee={(id) => {
              appliquer(terminerEnchere(collection, id));
              noterVente('fin');
            }}
          />

          <SynchroAuto collection={collection} preferences={preferences} cacheWiki={cacheWiki} />

          <VerificationWikipedia titres={titresConsultes} onCache={appliquerCacheWiki} />

          <Synchronisation
            collection={collection}
            registre={registre}
            preferences={preferences}
            chargement={!stockageSynchroLu || !preferencesLues}
            registreIllisible={registreIllisible}
            executionIllisible={executionIllisible}
            nbOnglets={0}
            executionEnCours={executionEnCours}
            onReessayer={relireStockageSynchro}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              aria-label="Rechercher une carte"
              placeholder="Rechercher une carte"
              className={`${CLASSE_CHAMP} w-full md:w-72`}
              value={filtres.recherche}
              onChange={(e) => setFiltres({ ...filtres, recherche: e.target.value })}
            />
            <select
              aria-label="Filtrer par statut"
              className={CLASSE_CHAMP}
              value={filtres.statut}
              onChange={(e) => setFiltres({ ...filtres, statut: e.target.value as Filtres['statut'] })}
            >
              <option value="tous">Tous les statuts</option>
              {STATUTS.map((s) => (
                <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
              ))}
            </select>
            <select aria-label="Filtrer par thème" className={CLASSE_CHAMP} value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="tous">Tous les thèmes</option>
              {IDS_THEMES.map((id) => (
                <option key={id} value={id}>{LIBELLES_THEMES[id]}</option>
              ))}
            </select>
            <label className="inline-flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={filtres.doublonsSeulement}
                onChange={(e) => setFiltres({ ...filtres, doublonsSeulement: e.target.checked })}
              />
              Doublons seulement
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="mt-6">Aucune carte ne correspond à ces filtres.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {visibles.slice(0, limite).map((carte) => (
                <CarteLigne key={`${carte.id}-${revision}`} carte={carte} onEdition={(edition) => editer(carte.id, edition)} />
              ))}
            </ul>
          )}

          {visibles.length > limite && (
            <button type="button" className={`${CLASSE_BOUTON} mt-4`} onClick={() => setLimite(limite + TAILLE_PAGE)}>
              Afficher plus ({visibles.length - limite} restantes)
            </button>
          )}
        </>
      )}
    </main>
  );
};

export default App;
