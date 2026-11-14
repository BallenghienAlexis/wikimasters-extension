import React, { useMemo, useState } from 'react';
import { STATUTS, LIBELLES_STATUT, filtrerCartes, resumer, type Filtres } from '../lib/collection';
import { themesDeCarte } from '../lib/themes';
import { trierLignes } from '../lib/ordreTableau';
import { plafondDefausse } from '../lib/tri';
import AnalysesCollection from './AnalysesCollection';
import GraphiqueEvolution from './GraphiqueEvolution';
import TableauCartes, { valeurDeTri, type EtatTri } from './TableauCartes';
import FiltresCollection from './FiltresCollection';
import VerificationWikipedia from './VerificationWikipedia';
import type { DonneesPage } from './useDonneesPage';

export const TAILLE_PAGE = 200;

interface Props {
  donnees: DonneesPage;
  filtres: Filtres;
  theme: string;
  limite: number;
  /** Change quand l’assistant ou une importation recrée les lignes. */
  revision: number;
  onFiltres: (filtres: Filtres) => void;
  onTheme: (theme: string) => void;
  onLimite: (limite: number) => void;
}

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';

/**
 * Onglet Collection : résumé, filtres, tableau triable, analyses et évolution sur 30 jours. La vérification Wikipédia
 * n’y est montée que dans cette vue liste, pour les cartes affichées (pages de 200).
 */
const OngletCollection: React.FC<Props> = ({ donnees, filtres, theme, limite, revision, onFiltres, onTheme, onLimite }) => {
  const { collection, cacheWiki, appliquerCacheWiki, editer } = donnees;
  const visibles = useMemo(
    () => filtrerCartes(collection.cartes, filtres).filter((c) => theme === 'tous' || themesDeCarte(c).includes(theme)),
    // `cacheWiki` change les thèmes lus par `themesDeCarte` (surcouche Wikipédia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection.cartes, filtres, theme, cacheWiki],
  );
  // Cartes consultées = cartes affichées dans la liste (les pages suivantes comptent quand on les ouvre).
  const [tri, setTri] = useState<EtatTri>({ cle: null, sens: null });
  // Le tri est d’affichage seulement : jamais écrit. Il précède la coupe à `limite` lignes.
  const rendues = useMemo(() => {
    const cle = tri.cle;
    const triees = cle === null ? visibles : trierLignes(visibles, (c) => valeurDeTri(c, cle), tri.sens);
    return triees.slice(0, limite);
  }, [visibles, tri, limite]);
  const titresConsultes = useMemo(() => rendues.map((c) => c.titre), [rendues]);
  const resume = useMemo(() => resumer(collection.cartes), [collection.cartes]);

  if (collection.cartes.length === 0) {
    return (
      <p className="mt-6 rounded border border-line bg-ink-2 p-6">
        Votre collection est vide. Ouvrez la page Collection de WikiMasters : la synchronisation automatique la remplit.
      </p>
    );
  }
  return (
    <>
      <p className="mt-2 text-sm" data-testid="resume">
        {resume.exemplaires} exemplaires · {resume.doublons} doublons ·{' '}
        {STATUTS.map((s) => `${LIBELLES_STATUT[s]} : ${resume.parStatut[s]}`).join(' · ')}
      </p>

      <VerificationWikipedia titres={titresConsultes} onCache={appliquerCacheWiki} />

      <FiltresCollection filtres={filtres} theme={theme} onFiltres={onFiltres} onTheme={onTheme} />

      {visibles.length === 0 ? (
        <p className="mt-6">Aucune carte ne correspond à ces filtres.</p>
      ) : (
        <TableauCartes
          cartes={rendues}
          tri={tri}
          revision={revision}
          cleFiltre={`${filtres.recherche}|${filtres.statut}|${filtres.doublonsSeulement}|${theme}`}
          onTri={setTri}
          onEdition={editer}
        />
      )}

      {visibles.length > limite && (
        <button type="button" className={`${CLASSE_BOUTON} mt-4`} onClick={() => onLimite(limite + TAILLE_PAGE)}>
          Afficher plus ({visibles.length - limite} restantes)
        </button>
      )}

      <AnalysesCollection cartes={collection.cartes} plafond={plafondDefausse(donnees.preferences)} cacheWiki={cacheWiki} />
      <GraphiqueEvolution />
    </>
  );
};

export default OngletCollection;
