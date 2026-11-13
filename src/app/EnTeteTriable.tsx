import React from 'react';
import type { SensTri } from '../lib/ordreTableau';

interface Props {
  colonne: { cle: string; libelle: string };
  etat: SensTri;
  /** Appelé au clic, à Entrée et à Espace (comportement natif du bouton). */
  onBasculer: () => void;
}

const ARIA: Record<'croissant' | 'decroissant', 'ascending' | 'descending'> = {
  croissant: 'ascending',
  decroissant: 'descending',
};

/** En-tête de colonne triable (D-16) : `th` + `button` de 44 px, état porté par `aria-sort` et un chevron. */
const EnTeteTriable: React.FC<Props> = ({ colonne, etat, onBasculer }) => (
  <th scope="col" aria-sort={etat === null ? 'none' : ARIA[etat]} className="p-0 text-left">
    <button
      type="button"
      onClick={onBasculer}
      className={`flex min-h-11 w-full items-center gap-2 px-3 text-left ${etat === null ? 'font-normal' : 'font-bold'}`}
    >
      <span>{colonne.libelle}</span>
      {etat !== null && <span aria-hidden="true">{etat === 'croissant' ? '▲' : '▼'}</span>}
    </button>
  </th>
);

export default EnTeteTriable;
