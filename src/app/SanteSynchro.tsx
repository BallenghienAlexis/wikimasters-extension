import React from 'react';
import type { PastilleSynchro } from '../lib/tableauDeBord';
import PastilleStatut, { MOT_PASTILLE } from './PastilleStatut';
import SectionRepliable from './SectionRepliable';

interface Props {
  pastille: PastilleSynchro;
  ageLibelle: string;
  /** Synchro automatique activée : sinon le libellé d’âge se suffit à lui-même. */
  activee: boolean;
  /** Nombre de prix relevés (fraîcheur des prix). */
  prixReleves: number;
}

const LIEN: Record<PastilleSynchro, string | null> = {
  'a-jour': null,
  'en-cours': 'Suivre la synchro',
  arretee: 'Voir pourquoi la synchro est arrêtée',
  erreur: 'Voir l’erreur de synchro',
};

/** Santé de la synchro (D-40) : pastille texte + symbole, âge de la dernière synchro terminée, lien vers #synchro. */
const SanteSynchro: React.FC<Props> = ({ pastille, ageLibelle, activee, prixReleves }) => {
  const lien = LIEN[pastille];
  return (
    <SectionRepliable
      id="sante-synchro"
      testId="sante-synchro"
      className="mt-4"
      titre="Santé de la synchro"
      ouvertParDefaut={pastille === 'erreur' || pastille === 'arretee'}
      resume={`${pastille === 'a-jour' ? '●' : pastille === 'en-cours' ? '▶' : pastille === 'arretee' ? '■' : '✕'} ${MOT_PASTILLE(pastille)} · ${ageLibelle}${prixReleves > 0 ? ` · ${prixReleves} prix relevés` : ''}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <PastilleStatut etat={pastille} />
        <p>{activee ? `Dernière synchro\u00a0: ${ageLibelle}` : `Synchro\u00a0: ${ageLibelle}`}</p>
        {lien && (
          <a href="#synchro" className="inline-flex min-h-11 items-center rounded px-2 underline">
            {lien}
          </a>
        )}
      </div>
      {prixReleves > 0 && <p className="mt-2 text-sm text-muted">{`Prix relevés\u00a0: ${prixReleves}`}</p>}
    </SectionRepliable>
  );
};

export default SanteSynchro;
