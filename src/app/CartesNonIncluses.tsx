import React from 'react';
import type { Carte } from '../lib/collection';
import { NB, carteTexte, libelleLigne, nombreCartes, type Ecartees, type LigneNonIncluse, type Places } from './apercuLot';

interface Props {
  lignes: readonly LigneNonIncluse[];
  groupees: Ecartees;
  places: Places;
  cartes: ReadonlyMap<string, Carte>;
}

/** Liste repliable des cartes non incluses dans le lot. */
const CartesNonIncluses: React.FC<Props> = ({ lignes, groupees, places, cartes }) => (
  <details className="mt-3 text-sm text-muted">
    <summary className="min-h-11 cursor-pointer py-2">Cartes non incluses ({nombreCartes(lignes)})</summary>
    {groupees.type === 'liste' ? (
      <ul>
        {groupees.lignes.map((e, i) => (
          <li key={i} className="break-words py-1">
            {carteTexte(e.idCarte, cartes)}
            {NB}: {libelleLigne(e.raison, { nomEtiquette: e.nomEtiquette, places })}
          </li>
        ))}
      </ul>
    ) : (
      <ul>
        {groupees.groupes.map((g) => (
          <li key={`${g.raison}-${g.nomEtiquette ?? ''}`} className="break-words py-1">
            {g.nombre} {g.nombre > 1 ? 'cartes' : 'carte'}
            {NB}: {libelleLigne(g.raison, { nomEtiquette: g.nomEtiquette, places })}
          </li>
        ))}
      </ul>
    )}
  </details>
);

export default CartesNonIncluses;
