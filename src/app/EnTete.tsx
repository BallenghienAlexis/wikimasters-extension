import React from 'react';
import { ageLibelle } from '../lib/tableauDeBord';
import PastilleStatut from './PastilleStatut';
import { pastilleDe, useLectureSynchro } from './useLectureSynchro';

/** En-tête sur une ligne (maquette) : titre, âge de la dernière synchro, pastille de santé. Lecture seule du stockage. */
const EnTete: React.FC = () => {
  const synchro = useLectureSynchro();
  const age = ageLibelle({ activee: synchro.activee, etat: pastilleDe(synchro), derniereTerminee: synchro.derniere }, synchro.maintenant);
  return (
    <header className="flex flex-wrap items-baseline gap-3">
      <h1 className="text-2xl font-semibold">WM Collection</h1>
      <span className="text-sm text-muted" data-testid="entete-synchro">
        {!synchro.activee ? 'Synchro automatique coupée' : age === 'jamais' ? 'Jamais synchronisée' : `Dernière synchro ${age}`}
      </span>
      <PastilleStatut etat={pastilleDe(synchro)} />
    </header>
  );
};

export default EnTete;
