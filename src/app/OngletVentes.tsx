import React from 'react';
import { terminerEnchere } from '../lib/collection';
import type { Preferences } from '../lib/tri';
import AssistantTri from './AssistantTri';
import FileVente from './FileVente';
import type { DonneesPage } from './useDonneesPage';

interface Props {
  donnees: DonneesPage;
  assistantOuvert: boolean;
  onAssistant: (ouvert: boolean) => void;
  onAppliquerAssistant: (reponses: Preferences) => void;
}

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';

/** Onglet Ventes : assistant de tri et file de vente (contenu actuel, déplacé tel quel). */
const OngletVentes: React.FC<Props> = ({ donnees, assistantOuvert, onAssistant, onAppliquerAssistant }) => {
  const { collection, cacheWiki, preferences, ventes, editer, appliquer, noterVente } = donnees;
  if (collection.cartes.length === 0) {
    return (
      <p className="mt-6 rounded border border-line bg-ink-2 p-6">
        Votre collection est vide. Ouvrez la page Collection de WikiMasters : la synchronisation automatique la remplit.
      </p>
    );
  }
  if (assistantOuvert) {
    return (
      <AssistantTri
        cacheWiki={cacheWiki}
        collection={collection}
        preferencesInitiales={preferences}
        onAppliquer={onAppliquerAssistant}
        onFermer={() => onAssistant(false)}
      />
    );
  }
  return (
    <>
      <div className="mt-4">
        <button type="button" className={CLASSE_BOUTON} onClick={() => onAssistant(true)}>
          Gérer mes thèmes et mes amis
        </button>
      </div>
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
    </>
  );
};

export default OngletVentes;
