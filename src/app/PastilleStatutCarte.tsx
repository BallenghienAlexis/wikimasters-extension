import React from 'react';
import { LIBELLES_STATUT, type Statut } from '../lib/collection';

const MARQUES: Record<Statut, { symbole: string; couleur: string }> = {
  'a-trier': { symbole: '?', couleur: 'border-muted' },
  garder: { symbole: '♥', couleur: 'border-garder' },
  echanger: { symbole: '⇄', couleur: 'border-echanger' },
  vendre: { symbole: '€', couleur: 'border-vendre' },
  'en-vente': { symbole: '⏱', couleur: 'border-vendre' },
  defausser: { symbole: '✕', couleur: 'border-defausser' },
};

/** Pastille de statut d’une carte hors répartition (D-13) : texte `paper` sur `ink-2`, contour du statut, symbole + mot. */
const PastilleStatutCarte: React.FC<{ statut: Statut | null | undefined }> = ({ statut }) => {
  const s: Statut = statut ?? 'a-trier';
  const { symbole, couleur } = MARQUES[s];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 bg-ink-2 px-3 py-1 text-sm text-paper ${couleur}`}>
      <span aria-hidden="true">{symbole}</span>
      <span>{LIBELLES_STATUT[s]}</span>
    </span>
  );
};

export default PastilleStatutCarte;
