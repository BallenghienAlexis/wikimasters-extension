import React, { useState } from 'react';
import type { EcartCarte } from '../lib/ecarts';
import { NB } from './apercuLot';

const PAS = 50;

interface Props {
  ecarts: readonly EcartCarte[];
}

/** Écarts entre les étiquettes attendues et celles lues sur le site (lecture seule). */
const ListeEcarts: React.FC<Props> = ({ ecarts }) => {
  const [limite, setLimite] = useState(PAS);
  return (
    <section aria-labelledby="titre-ecarts-lots" className="mt-4" data-testid="ecarts-lots">
      <h3 id="titre-ecarts-lots" className="font-semibold">
        Écarts avec le site
      </h3>
      {ecarts.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Aucun écart.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {ecarts.slice(0, limite).map((e) => (
              <li key={e.idCarte} className="py-2 text-sm">
                <p className="break-words font-medium">{e.titre}</p>
                {e.manquantes.length > 0 && (
                  <p className="break-words">
                    <span className="text-muted">Attendue, absente du site{NB}: </span>
                    {e.manquantes.join(', ')}
                  </p>
                )}
                {e.enTrop.length > 0 && (
                  <p className="break-words">
                    <span className="text-muted">Présente sur le site, non attendue{NB}: </span>
                    {e.enTrop.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {ecarts.length > limite && (
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink px-4 focus-visible:shadow-(--halo-focus)"
              onClick={() => setLimite(limite + PAS)}
            >
              Afficher {PAS} de plus ({ecarts.length - limite} restants)
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default ListeEcarts;
