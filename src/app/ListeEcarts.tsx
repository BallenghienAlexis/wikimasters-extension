import React, { useState } from 'react';
import type { EcartCarte } from '../lib/ecarts';
import { NB } from './apercuLot';
import SectionRepliable from './SectionRepliable';

const PAS = 50;

interface Props {
  ecarts: readonly EcartCarte[];
}

/** Écarts entre les étiquettes attendues et celles lues sur le site (lecture seule). */
const ListeEcarts: React.FC<Props> = ({ ecarts }) => {
  const [limite, setLimite] = useState(PAS);
  return (
    <SectionRepliable
      id="ecarts-lots"
      testId="ecarts-lots"
      className="mt-4"
      titre="Écarts avec le site"
      resume={ecarts.length === 0 ? 'Aucun écart' : `${ecarts.length} carte${ecarts.length > 1 ? 's' : ''} avec écart`}
    >
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
    </SectionRepliable>
  );
};

export default ListeEcarts;
