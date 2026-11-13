import React from 'react';
import type { Action } from '../lib/actions';
import type { Carte } from '../lib/collection';
import {
  GRILLE,
  NB,
  carteTexte,
  classeType,
  libelleType,
  texteDuree,
  texteTotaux,
  totauxParType,
} from './apercuLot';

interface Props {
  disponibles: readonly Action[];
  n: number;
  page: { visibles: Action[]; restantes: number };
  details: readonly string[];
  cartes: ReadonlyMap<string, Carte>;
}

/** Totaux, durée et liste des actions du lot (au plus 100 lignes). */
const ListeActionsLot: React.FC<Props> = ({ disponibles, n, page, details, cartes }) => (
  <>
    <p className="mt-2 text-sm">{texteTotaux(totauxParType(disponibles))}</p>
    <p className="mt-1 text-sm">{texteDuree(n)}</p>

    <div
      aria-hidden="true"
      className={`mt-3 hidden border-b border-line pb-1 text-sm font-semibold md:grid ${GRILLE}`}
    >
      <span>Carte</span>
      <span>Action sur le site</span>
      <span>Détail</span>
    </div>
    <ul aria-label="Actions du lot">
      {page.visibles.map((a, i) => (
        <li key={i} className={`border-b border-line px-0 py-2 text-sm md:px-2 ${GRILLE}`}>
          <span className="break-words">{carteTexte(a.idCarte, cartes)}</span>
          <span className={`break-words font-semibold ${classeType(a.type)}`}>
            <span className="font-normal text-muted md:sr-only">Action{NB}: </span>
            {libelleType(a.type)}
          </span>
          <span className="break-words text-muted">
            <span className="md:sr-only">Détail{NB}: </span>
            {details[i]}
          </span>
        </li>
      ))}
    </ul>
    {page.restantes > 0 && (
      <p className="mt-2 text-sm text-muted" data-testid="actions-restantes">
        … et {page.restantes} {page.restantes > 1 ? 'autres actions' : 'autre action'}
      </p>
    )}
  </>
);

export default ListeActionsLot;
