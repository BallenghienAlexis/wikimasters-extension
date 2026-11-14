import React, { useState } from 'react';
import { collectionVide, type Filtres } from '../lib/collection';
import { appliquerTri, type Preferences } from '../lib/tri';
import { chargerPreferences, enregistrerPreferences } from '../lib/stockage';
import BandeauActivite from './BandeauActivite';
import BlocageCollection from './BlocageCollection';
import MessageStockage from './MessageStockage';
import Onglets from './Onglets';
import OngletCollection, { TAILLE_PAGE } from './OngletCollection';
import OngletLots from './OngletLots';
import OngletReglages from './OngletReglages';
import OngletSynchro from './OngletSynchro';
import OngletTableauDeBord from './OngletTableauDeBord';
import OngletVentes from './OngletVentes';
import { idOnglet, idPanneau } from './onglets';
import { ContexteAffichage } from './useMouvement';
import { useAffichage } from './useAffichage';
import { useDonneesPage } from './useDonneesPage';
import { useHistoriqueQuotidien } from './useHistoriqueQuotidien';
import { useOngletActif } from './useOngletActif';

/**
 * Coquille de la page de gestion : en-tête, blocage et messages de stockage (au-dessus des onglets, sur les six),
 * barre d’onglets, puis le seul panneau actif. Les lectures du stockage et les états de la Collection
 * (filtres, thème, pagination) et de l’assistant vivent ici, pour survivre au changement d’onglet.
 */
const App: React.FC = () => {
  const donnees = useDonneesPage();
  const affichage = useAffichage();
  const [actif, aller] = useOngletActif();
  const { collection, chargee, blocage, message, preferences, appliquer } = donnees;
  useHistoriqueQuotidien(collection, chargee && !blocage);

  const [revision, setRevision] = useState(0);
  const [limite, setLimite] = useState(TAILLE_PAGE);
  const [filtres, setFiltres] = useState<Filtres>({ recherche: '', statut: 'tous', doublonsSeulement: false });
  const [theme, setTheme] = useState('tous');
  const [assistantOuvert, setAssistantOuvert] = useState(false);

  const appliquerAssistant = (reponses: Preferences): void => {
    // Le plafond de défausse n'est pas une réponse de l'assistant : il garde la valeur réglée (autre onglet comprise).
    const choix = { ...reponses, plafondDefausse: preferences.plafondDefausse };
    donnees.setPreferences(choix);
    setAssistantOuvert(false);
    void chargerPreferences()
      .catch(() => choix)
      .then((stockees) => {
        const final = { ...choix, plafondDefausse: stockees.plafondDefausse };
        donnees.setPreferences(final);
        enregistrerPreferences(final).catch(() => donnees.setMessage('Enregistrement de vos réponses impossible.'));
        // Le tri applique le plafond relu dans le stockage (autre onglet compris).
        appliquer(appliquerTri(collection, final));
        setRevision((r) => r + 1);
        donnees.setMessage('Tri appliqué. À vous d’agir sur WikiMasters : les repères vous guident sur chaque carte.');
      });
  };

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
      case 'ventes':
        panneau = (
          <OngletVentes
            donnees={donnees}
            assistantOuvert={assistantOuvert}
            onAssistant={setAssistantOuvert}
            onAppliquerAssistant={appliquerAssistant}
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
      <main className="mx-auto max-w-6xl p-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">WM Collection</h1>
        </header>

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

        <p className="mt-3 text-sm text-muted">
          Vos modifications restent dans cette extension : rien n’est changé sur WikiMasters. Chaque page Collection que vous ouvrez sur le site est ajoutée ici.
        </p>

        <MessageStockage message={message} />

        <Onglets actif={actif} onChoisir={aller} />

        <BandeauActivite />

        <div role="tabpanel" id={idPanneau(actif)} aria-labelledby={idOnglet(actif)} tabIndex={0}>
          {panneau}
        </div>
      </main>
    </ContexteAffichage.Provider>
  );
};

export default App;
