import React from 'react';
import { progression, texteProgression } from '../lib/synchro';
import SynchroAuto from './SynchroAuto';
import type { DonneesPage } from './useDonneesPage';

interface Props {
  donnees: DonneesPage;
}

/** Onglet Synchro : lecture des pages et synchronisation automatique (contenu actuel, déplacé tel quel). */
const OngletSynchro: React.FC<Props> = ({ donnees }) => {
  const { synchro, collection, preferences, cacheWiki } = donnees;
  return (
    <>
      {synchro && <p className="mt-2 font-medium" data-testid="synchro">{texteProgression(progression(synchro))}</p>}
      <SynchroAuto collection={collection} preferences={preferences} cacheWiki={cacheWiki} />
    </>
  );
};

export default OngletSynchro;
