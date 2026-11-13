import React from 'react';
import { plafondDefausse } from '../lib/tri';
import type { Donnees } from '../lib/sauvegarde';
import EtiquettesPreexistantes from './EtiquettesPreexistantes';
import PlafondDefausse from './PlafondDefausse';
import { lancerSuppressionEtiquettes } from './pilotageLots';
import Sauvegarde from './Sauvegarde';
import type { DonneesPage } from './useDonneesPage';

interface Props {
  donnees: DonneesPage;
  onImportee: (donnees: Donnees) => void;
}

/** Onglet Réglages : sauvegarde, plafond de défausse, étiquettes préexistantes (contenu actuel, déplacé tel quel). */
const OngletReglages: React.FC<Props> = ({ donnees, onImportee }) => {
  const { collection, registre, preferences, preferencesLues, etiquettesSite, executionEnCours, enregistrerLesPreferences, setMessage } = donnees;
  return (
    <>
      <Sauvegarde onImportee={onImportee} />

      {collection.cartes.length > 0 && (
        <>
          {preferencesLues && (
            <PlafondDefausse
              plafond={plafondDefausse(preferences)}
              onChange={(plafond) => enregistrerLesPreferences({ ...preferences, plafondDefausse: plafond }, 'Enregistrement du plafond impossible.')}
            />
          )}

          <EtiquettesPreexistantes
            cartes={collection.cartes}
            registre={registre}
            amis={preferences.amis}
            site={etiquettesSite}
            occupe={executionEnCours}
            onSupprimer={(liste) => void lancerSuppressionEtiquettes(liste).catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'La suppression n’a pas pu démarrer.'))}
          />
        </>
      )}
    </>
  );
};

export default OngletReglages;
