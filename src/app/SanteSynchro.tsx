import React from 'react';
import type { PastilleSynchro } from '../lib/tableauDeBord';
import PastilleStatut from './PastilleStatut';

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
    <section aria-label="Santé de la synchro" data-testid="sante-synchro" className="rounded border border-line bg-ink-2 p-4">
      <h3 className="mb-2 text-[17px] font-semibold">Santé de la synchro</h3>
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
    </section>
  );
};

export default SanteSynchro;
