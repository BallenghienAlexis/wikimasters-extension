import React, { useMemo } from 'react';
import type { Carte } from '../lib/collection';
import { repartitionParRarete } from '../lib/tableauDeBord';

interface Props {
  cartes: readonly Carte[];
}

const TH = 'border-b border-line px-2 py-1.5 text-left font-semibold';
const TD = 'border-b border-line px-2 py-1.5 tabular-nums';

/** Répartition par rareté : tableau dès 600 px, liste empilée en dessous (D-01). Donnée locale, aucune requête. */
const TableauRaretes: React.FC<Props> = ({ cartes }) => {
  const lignes = useMemo(() => repartitionParRarete(cartes), [cartes]);
  if (lignes.length === 0) return null;
  return (
    <div data-testid="tableau-raretes" className="mt-4">
      <table className="hidden w-full border-collapse text-sm sm:table">
        <caption className="sr-only">Répartition par rareté</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>Rareté</th>
            <th scope="col" className={TH}>Titres</th>
            <th scope="col" className={TH}>Garder</th>
            <th scope="col" className={TH}>Échanger</th>
            <th scope="col" className={TH}>Vendre</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.rarete}>
              <td className={TD}>{l.rarete}</td>
              <td className={TD}>{l.titres}</td>
              <td className={TD}>{l.garder}</td>
              <td className={TD}>{l.echanger}</td>
              <td className={TD}>{l.vendre}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="grid gap-2 text-sm sm:hidden" aria-label="Répartition par rareté">
        {lignes.map((l) => (
          <li key={l.rarete} className="border-b border-line pb-2">
            <strong>{l.rarete}</strong> · {l.titres} titres · Garder {l.garder} · Échanger {l.echanger} · Vendre {l.vendre}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TableauRaretes;
