import React from 'react';
import { useMouvement } from './useMouvement';

export type EtatSynchro = 'a-jour' | 'en-cours' | 'arretee' | 'erreur';

const ETATS: Record<EtatSynchro, { mot: string; symbole: string; couleur: string }> = {
  'a-jour': { mot: 'À jour', symbole: '●', couleur: 'border-garder' },
  'en-cours': { mot: 'En cours', symbole: '▶', couleur: 'border-echanger' },
  arretee: { mot: 'Arrêtée', symbole: '■', couleur: 'border-muted' },
  erreur: { mot: 'Erreur', symbole: '✕', couleur: 'border-defausser' },
};

/** Pastille de statut de synchro (D-40) : symbole + mot, jamais la couleur seule. */
const PastilleStatut: React.FC<{ etat: EtatSynchro }> = ({ etat }) => {
  const mouvement = useMouvement();
  const { mot, symbole, couleur } = ETATS[etat];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 bg-ink-2 px-3 py-1 text-sm text-paper ${couleur}`}>
      <span aria-hidden="true" className={etat === 'a-jour' && mouvement ? 'wm-pulsation' : undefined}>
        {symbole}
      </span>
      <span>{mot}</span>
    </span>
  );
};

export default PastilleStatut;
