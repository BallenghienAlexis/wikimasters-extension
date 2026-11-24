import React from 'react';
import type { PastilleSynchro } from '../lib/tableauDeBord';
import type { LigneSante } from '../lib/tableauDeBord';
import PastilleStatut from './PastilleStatut';
import BlocTableauDeBord from './BlocTableauDeBord';

interface Props {
  pastille: PastilleSynchro;
  ageLibelle: string;
  /** Synchro automatique activée : sinon le libellé d’âge se suffit à lui-même. */
  activee: boolean;
  /** Nombre de prix relevés (fraîcheur des prix). */
  prixReleves: number;
  /** Lignes Lecture / Étiquettes / Prix / Ignorées (symbole + mot, jamais la couleur seule). */
  lignes?: readonly LigneSante[];
}

const LIEN: Record<PastilleSynchro, string | null> = {
  'a-jour': null,
  'en-cours': 'Suivre la synchro',
  arretee: 'Voir pourquoi la synchro est arrêtée',
  erreur: 'Voir l’erreur de synchro',
};

/** Santé de la synchro (D-40) : pastille texte + symbole, âge de la dernière synchro terminée, lien vers #synchro. */
const SanteSynchro: React.FC<Props> = ({ pastille, ageLibelle, activee, prixReleves, lignes = [] }) => {
  const lien = LIEN[pastille];
  return (
    <BlocTableauDeBord
      id="sante-synchro"
      titre="Santé de la synchro"
      resume={`${prixReleves > 0 ? `${prixReleves} prix relevés` : ''}`}
    >
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <PastilleStatut etat={pastille} />
        <p>{activee ? `Dernière synchro\u00a0: ${ageLibelle}` : `Synchro\u00a0: ${ageLibelle}`}</p>
        {lien && (
          <a href="#synchro" className="inline-flex min-h-8 items-center rounded px-2 underline">
            {lien}
          </a>
        )}
      </div>
      {lignes.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-y border-line text-sm" data-testid="lignes-sante">
          {lignes.map((l) => (
            <li key={l.nom} className="flex flex-wrap items-baseline gap-x-3 gap-y-0 py-1">
              <span className="w-28 shrink-0 font-semibold">
                <span aria-hidden="true">{l.symbole} </span>
                {l.nom}
              </span>
              <span className="min-w-0 break-words">{l.texte}</span>
              {l.lien && (
                <a href={l.lien.href} aria-label={l.lien.nomAccessible} className="inline-flex min-h-8 items-center rounded px-2 underline">
                  {l.lien.libelle}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {prixReleves > 0 && lignes.length === 0 && <p className="mt-2 text-sm text-muted">{`Prix relevés\u00a0: ${prixReleves}`}</p>}
    </BlocTableauDeBord>
  );
};

export default SanteSynchro;
