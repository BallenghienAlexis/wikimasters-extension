import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LIBELLES_STATUT,
  STATUTS,
  analyserImport,
  appliquerEdition,
  collectionVide,
  filtrerCartes,
  fusionnerImport,
  resumer,
  terminerEnchere,
  type Collection,
  type EditionCarte,
  type Filtres,
} from '../lib/collection';
import { versCsv, versJson } from '../lib/exports';
import { chargerCollection, chargerExecution, chargerPreferences, chargerRegistre, chargerSynchro, ecouterCollection, ecouterSynchro, enregistrerCollection, enregistrerPreferences } from '../lib/stockage';
import { progression, texteProgression, type Synchro } from '../lib/synchro';
import { LIBELLES_THEMES, IDS_THEMES, themesDeCarte } from '../lib/themes';
import { appliquerTri, preferencesParDefaut, type Preferences } from '../lib/tri';
import type { Registre } from '../lib/actions';
import { registreVide } from '../lib/registre';
import AssistantTri from './AssistantTri';
import Synchronisation from './Synchronisation';
import FileVente from './FileVente';
import CarteLigne from './CarteLigne';

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
  const [preferences, setPreferences] = useState<Preferences>(preferencesParDefaut);
  const [assistantOuvert, setAssistantOuvert] = useState(false);
  const [synchro, setSynchro] = useState<Synchro | null>(null);
  const [registre, setRegistre] = useState<Registre>(registreVide);
  const [executionEnCours, setExecutionEnCours] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void chargerPreferences().then(setPreferences);
    void chargerSynchro().then(setSynchro);
    void chargerRegistre().then(setRegistre).catch(() => undefined);
    void chargerExecution()
      .then((e) => setExecutionEnCours(e?.etat === 'en-cours'))
      .catch(() => undefined);
    return ecouterSynchro(setSynchro);
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
    [collection.cartes, filtres, theme],
  );
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

  const importer = async (fichier: File): Promise<void> => {
    let brut: unknown;
    try {
      brut = JSON.parse(await fichier.text());
    } catch {
      setMessage('Import refusé : ce fichier n’est pas du JSON valide.');
      return;
    }
    const resultat = analyserImport(brut);
    if (!resultat.ok) {
      setMessage(`Import refusé : ${resultat.erreur}`);
      return;
    }
    appliquer(fusionnerImport(collection, resultat.cartes));
    setRevision((r) => r + 1);
    setMessage(`${resultat.cartes.length} cartes importées.`);
  };

  if (blocage) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <h1 className="text-2xl font-semibold">WM Collection</h1>
        <p role="alert" className="mt-4">{blocage}</p>
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
          <button type="button" className={CLASSE_BOUTON} onClick={() => champFichier.current?.click()}>
            Importer un fichier
          </button>
          <input
            ref={champFichier}
            type="file"
            accept="application/json,.json"
            aria-label="Fichier de collection à importer"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              e.target.value = '';
              if (fichier) void importer(fichier);
            }}
          />
          <button type="button" className={CLASSE_BOUTON} onClick={() => telecharger(versCsv(collection.cartes), 'collection.csv', 'text/csv;charset=utf-8')}>
            Exporter en CSV
          </button>
          <button type="button" className={CLASSE_BOUTON} onClick={() => telecharger(versJson(collection), 'collection.json', 'application/json')}>
            Exporter en JSON
          </button>
        </div>
      </header>

      <p className="mt-3 text-sm text-muted">
        Vos modifications restent dans cette extension : rien n’est changé sur WikiMasters. Chaque page Collection que vous ouvrez sur le site est ajoutée ici.
      </p>

      {synchro && <p className="mt-2 font-medium" data-testid="synchro">{texteProgression(progression(synchro))}</p>}

      <p role="status" className="mt-2 min-h-6">{message}</p>

      {assistantOuvert ? (
        <AssistantTri
          collection={collection}
          preferencesInitiales={preferences}
          onAppliquer={appliquerAssistant}
          onFermer={() => setAssistantOuvert(false)}
        />
      ) : collection.cartes.length === 0 ? (
        <p className="mt-6 rounded border border-line bg-ink-2 p-6">
          Votre collection est vide. Ouvrez la page Collection de WikiMasters, ou importez un fichier JSON.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm" data-testid="resume">
            {resume.exemplaires} exemplaires · {resume.doublons} doublons ·{' '}
            {STATUTS.map((s) => `${LIBELLES_STATUT[s]} : ${resume.parStatut[s]}`).join(' · ')}
          </p>

          <FileVente
            cartes={collection.cartes}
            onMiseEnVente={(id) => editer(id, { statut: 'en-vente', decidePar: 'moi' })}
            onTerminee={(id) => appliquer(terminerEnchere(collection, id))}
          />

          <Synchronisation collection={collection} registre={registre} nbOnglets={0} executionEnCours={executionEnCours} />

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
