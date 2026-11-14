import React from 'react';
import type { Carte } from '../lib/collection';
import { colonneVoisine, libelleDeplacement, type ColonneTri } from '../lib/colonnesTri';

interface Props {
  carte: Carte;
  colonne: ColonneTri;
  /** Ref de la carte, pour le FLIP (useFlip). */
  refCarte: (el: HTMLElement | null) => void;
  /** Propriétés du glisser-déposer (Pointer Events), voir `useGlisser`. */
  glisser: React.HTMLAttributes<HTMLElement>;
  enGlisse: boolean;
  onDeplacer: (id: string, vers: ColonneTri, sens: 'gauche' | 'droite') => void;
}

const CLASSE_FLECHE =
  'inline-flex size-11 cursor-pointer items-center justify-center rounded border border-muted bg-ink-2 text-paper ' +
  'focus:outline-2 focus:outline-offset-2 focus:outline-paper focus-visible:shadow-(--halo-focus) aria-disabled:cursor-not-allowed aria-disabled:bg-ink aria-disabled:text-muted';

const Fleche: React.FC<{
  carte: Carte;
  sens: 'gauche' | 'droite';
  colonne: ColonneTri;
  onDeplacer: Props['onDeplacer'];
}> = ({ carte, sens, colonne, onDeplacer }) => {
  const vers = colonneVoisine(colonne, sens);
  const libelle = vers
    ? libelleDeplacement(carte.titre, vers)
    : `Déplacer « ${carte.titre} » : aucune colonne à ${sens === 'gauche' ? 'gauche' : 'droite'}`;
  return (
    <button
      type="button"
      aria-label={libelle}
      aria-disabled={vers === null ? true : undefined}
      data-sens={sens}
      className={CLASSE_FLECHE}
      onClick={() => {
        if (vers) onDeplacer(carte.id, vers, sens);
      }}
    >
      <span aria-hidden="true">{sens === 'gauche' ? '←' : '→'}</span>
    </button>
  );
};

/** Carte du tableau de tri (D-15) : titre, rareté, quantité, deux flèches de 44 px. Toute la carte bouge. */
const CarteTri: React.FC<Props> = ({ carte, colonne, refCarte, glisser, enGlisse, onDeplacer }) => (
  <li
    ref={refCarte}
    data-testid="carte-tri"
    data-id={carte.id}
    data-glisse={enGlisse ? 'true' : undefined}
    {...glisser}
    className="touch-pan-y select-none list-none rounded-lg border border-muted bg-ink p-3 shadow-(--shadow-carte) transition-shadow duration-(--d-fast) hover:shadow-(--shadow-leve)"
  >
    <p className="font-bold break-words">{carte.titre}</p>
    <p className="text-sm text-muted">
      {carte.rarete ?? 'Rareté inconnue'} · Quantité : {carte.quantite}
    </p>
    <div className="mt-2 flex gap-2">
      <Fleche carte={carte} sens="gauche" colonne={colonne} onDeplacer={onDeplacer} />
      <Fleche carte={carte} sens="droite" colonne={colonne} onDeplacer={onDeplacer} />
    </div>
  </li>
);

export default CarteTri;
