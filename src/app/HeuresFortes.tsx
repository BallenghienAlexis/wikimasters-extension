import React from 'react';
import { CONFIG_AFFLUENCE } from '../config/affluence';

interface Props {
  nbObservations: number;
}

const heure = (h: number): string => `${h} h`;
const creneaux = (liste: readonly [number, number][]): string => liste.map(([d, f]) => `${heure(d)} à ${heure(f)}`).join(', ');

/** Heures fortes (SC-024) : origine des créneaux, nombre d’observations et, par défaut, les créneaux eux-mêmes. */
const HeuresFortes: React.FC<Props> = ({ nbObservations }) => {
  const parDefaut = nbObservations < CONFIG_AFFLUENCE.minObservations;
  return (
    <div className="mt-3 text-sm text-muted" data-testid="heures-fortes">
      <p>
        Heures fortes {parDefaut ? 'par défaut' : 'déduites des relevés et de vos ventes'} ({nbObservations}{' '}
        {nbObservations > 1 ? 'observations' : 'observation'}).
      </p>
      {parDefaut && (
        <ul className="mt-1 grid gap-0.5">
          <li>Semaine : {creneaux(CONFIG_AFFLUENCE.creneauxSemaine)}</li>
          <li>Week-end : {creneaux(CONFIG_AFFLUENCE.creneauxWeekend)}</li>
        </ul>
      )}
    </div>
  );
};

export default HeuresFortes;
