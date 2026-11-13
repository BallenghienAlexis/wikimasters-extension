import React from 'react';
import PanneauApercuLot from './PanneauApercuLot';
import type { DonneesPage } from './useDonneesPage';

interface Props {
  donnees: DonneesPage;
}

/** Onglet Lots : aperçu du lot, lancement et journal (contenu actuel, déplacé tel quel). */
const OngletLots: React.FC<Props> = ({ donnees }) => {
  const { collection, registre, preferences, stockageSynchroLu, preferencesLues, registreIllisible, executionIllisible, executionEnCours, relireStockageSynchro } = donnees;
  if (collection.cartes.length === 0) {
    return (
      <p className="mt-6 rounded border border-line bg-ink-2 p-6">
        Votre collection est vide. Ouvrez la page Collection de WikiMasters : la synchronisation automatique la remplit.
      </p>
    );
  }
  return (
    <PanneauApercuLot
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
  );
};

export default OngletLots;
