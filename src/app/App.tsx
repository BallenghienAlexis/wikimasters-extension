import React, { useState } from 'react';
import { collectionVide, type Filtres } from '../lib/collection';
import BandeauActivite from './BandeauActivite';
import BlocageCollection from './BlocageCollection';
import EnTete from './EnTete';
import MessageStockage from './MessageStockage';
import Onglets from './Onglets';
import OngletCollection, { TAILLE_PAGE } from './OngletCollection';
import OngletLots from './OngletLots';
import OngletReglages from './OngletReglages';
import OngletSynchro from './OngletSynchro';
import OngletTableauDeBord from './OngletTableauDeBord';
import { idOnglet, idPanneau } from './definitionOnglets';
import { ContexteAffichage } from './useMouvement';
import { useAffichage } from './useAffichage';
import { useDonneesPage } from './useDonneesPage';
import { useHistoriqueQuotidien } from './useHistoriqueQuotidien';
import { useOngletActif } from './useOngletActif';

/**
 * Coquille de la page de gestion : en-tête, blocage et messages de stockage (au-dessus des onglets, sur les cinq),
 * barre d’onglets, puis le seul panneau actif. Les lectures du stockage et les états de la Collection
 * (filtres, thème, pagination) vivent ici, pour survivre au changement d’onglet.
 */
const App: React.FC = () => {
  const donnees = useDonneesPage();
  const affichage = useAffichage();
  const [actif, aller] = useOngletActif();
  const { collection, chargee, blocage, message } = donnees;
  useHistoriqueQuotidien(collection, chargee && !blocage);

  const [revision, setRevision] = useState(0);
  const [limite, setLimite] = useState(TAILLE_PAGE);
  const [filtres, setFiltres] = useState<Filtres>({ recherche: '', doublonsSeulement: false });
  const [theme, setTheme] = useState('tous');

  let panneau: React.ReactNode = null;
  if (!blocage && chargee) {
    switch (actif) {
      case 'tableau-de-bord':
        panneau = <OngletTableauDeBord />;
        break;
      case 'synchro':
        panneau = <OngletSynchro donnees={donnees} />;
        break;
      case 'lots':
        panneau = <OngletLots donnees={donnees} />;
        break;
      case 'collection':
        panneau = (
          <OngletCollection
            donnees={donnees}
            filtres={filtres}
            theme={theme}
            limite={limite}
            revision={revision}
            onFiltres={setFiltres}
            onTheme={setTheme}
            onLimite={setLimite}
          />
        );
        break;
      case 'reglages':
        panneau = (
          <OngletReglages
            donnees={donnees}
            onImportee={(importees) => {
              donnees.setCollection(importees.collection);
              donnees.setPreferences(importees.preferences);
              donnees.setVentes(importees.ventes);
              setRevision((r) => r + 1);
            }}
          />
        );
        break;
    }
  } else if (!blocage) {
    panneau = <p className="p-4">Chargement…</p>;
  }

  return (
    <ContexteAffichage.Provider value={{ animations: affichage.animations }}>
      <main className="mx-auto max-w-[1280px] px-6 pt-5 pb-6">
        <EnTete />

        {blocage && (
          <BlocageCollection
            blocage={blocage}
            onReinitialisee={() => {
              donnees.setBlocage(null);
              donnees.setCollection(collectionVide());
              donnees.setChargee(true);
            }}
          />
        )}

        <MessageStockage message={message} />

        <Onglets actif={actif} onChoisir={aller} />

        <BandeauActivite />

        <div role="tabpanel" id={idPanneau(actif)} aria-labelledby={idOnglet(actif)} tabIndex={0}>
          {panneau}
        </div>
        <p className="mt-6 text-sm text-muted">
          Vos modifications restent dans cette extension : rien n’est changé sur WikiMasters. Chaque page Collection que vous ouvrez sur le site est ajoutée ici.
        </p>
      </main>
    </ContexteAffichage.Provider>
  );
};

export default App;
