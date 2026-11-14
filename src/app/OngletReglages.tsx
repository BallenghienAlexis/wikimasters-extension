import React from 'react';
import { enregistrerAffichage } from '../lib/stockage';
import { plafondDefausse } from '../lib/tri';
import type { Donnees } from '../lib/sauvegarde';
import GestionAmis from './GestionAmis';
import EtiquettesPreexistantes from './EtiquettesPreexistantes';
import PlafondDefausse from './PlafondDefausse';
import { lancerSuppressionEtiquettes } from './pilotageLots';
import ReglageAnimations from './ReglageAnimations';
import ReglageSynchroAuto from './ReglageSynchroAuto';
import Sauvegarde from './Sauvegarde';
import SectionRepliable from './SectionRepliable';
import { useAffichage } from './useAffichage';
import type { DonneesPage } from './useDonneesPage';

interface Props {
  donnees: DonneesPage;
  onImportee: (donnees: Donnees) => void;
}

const NB = ' ';

/** Onglet Réglages (D-50) : sept sections repliées par défaut, titre et résumé visibles. */
const OngletReglages: React.FC<Props> = ({ donnees, onImportee }) => {
  const { collection, registre, preferences, preferencesLues, etiquettesSite, executionEnCours, enregistrerLesPreferences, setMessage } = donnees;
  const { animations } = useAffichage();
  const plafond = plafondDefausse(preferences);
  const avecCartes = collection.cartes.length > 0;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <SectionRepliable id="reglage-synchro" titre="Synchronisation automatique" resume="Activer ou couper">
        <ReglageSynchroAuto />
      </SectionRepliable>

      <SectionRepliable id="reglage-sauvegarde" titre="Sauvegarde" resume="Exporter, importer">
        <Sauvegarde onImportee={onImportee} />
      </SectionRepliable>

      <SectionRepliable id="reglage-plafond" titre="Plafond de défausse" resume={`Plafond${NB}: ${plafond}`}>
        {avecCartes && preferencesLues ? (
          <PlafondDefausse
            plafond={plafond}
            onChange={(valeur) => enregistrerLesPreferences({ ...preferences, plafondDefausse: valeur }, 'Enregistrement du plafond impossible.')}
          />
        ) : (
          <p className="py-2 text-sm text-muted">Le plafond se règle une fois la collection lue.</p>
        )}
      </SectionRepliable>

      <SectionRepliable id="reglage-etiquettes" titre="Étiquettes préexistantes" resume="Tri et suppression">
        {avecCartes ? (
          <EtiquettesPreexistantes
            cartes={collection.cartes}
            registre={registre}
            amis={preferences.amis}
            site={etiquettesSite}
            occupe={executionEnCours}
            onSupprimer={(liste) => void lancerSuppressionEtiquettes(liste).catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'La suppression n’a pas pu démarrer.'))}
          />
        ) : (
          <p className="py-2 text-sm text-muted">Aucune étiquette à trier tant que la collection est vide.</p>
        )}
      </SectionRepliable>

      <SectionRepliable id="reglage-wikipedia" titre="Wikipédia" resume="Vérification automatique">
        <p className="py-2 text-sm">
          Les titres des cartes affichées dans la Collection sont vérifiés sur Wikipédia (puis Wikidata) pour affiner leurs thèmes, une requête
          par seconde. Seul le titre de la carte est envoyé, jamais une donnée du compte. Les résultats sont gardés 30{NB}jours.
        </p>
      </SectionRepliable>

      <SectionRepliable id="reglage-themes" titre="Thèmes" resume="Mots-clés et amis">
        <p className="py-2 text-sm">
          Les thèmes des cartes sont déduits du titre et de la description par mots-clés, puis complétés par Wikipédia.
        </p>
        <GestionAmis
          preferences={preferences}
          onChange={(p) => enregistrerLesPreferences(p, 'Enregistrement des amis impossible.')}
        />
      </SectionRepliable>

      <SectionRepliable id="reglage-animations" titre="Animations" resume={`Animations${NB}: ${animations ? 'activées' : 'désactivées'}`}>
        <ReglageAnimations
          animations={animations}
          onChange={(valeur) => void enregistrerAffichage({ version: 1, animations: valeur }).catch(() => setMessage('Enregistrement du réglage impossible.'))}
        />
      </SectionRepliable>
    </div>
  );
};

export default OngletReglages;
