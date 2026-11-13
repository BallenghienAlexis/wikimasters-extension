import React from 'react';

interface Props {
  occupees: number;
  max: number;
}

/** Places d’enchères « occupées / max » (SC-024), calculées par `placesEncheres`. */
const PlacesEncheres: React.FC<Props> = ({ occupees, max }) => (
  <p className="text-sm text-muted">
    Places d’enchères :{' '}
    <strong className="font-semibold text-paper" data-testid="places-encheres">
      {occupees} / {Number.isFinite(max) ? max : '—'}
    </strong>
  </p>
);

export default PlacesEncheres;
