import React from 'react';

interface Props {
  animations: boolean;
  /** Appelée avec la nouvelle valeur ; l’écriture de la clé `affichage` est faite par l’appelant. */
  onChange: (animations: boolean) => void;
}

/** Réglage « Animations » (D-17) : coupe le mouvement de l’interface sans retirer aucune fonction. */
const ReglageAnimations: React.FC<Props> = ({ animations, onChange }) => (
  <div className="py-2">
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={animations}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-[var(--color-paper)] focus-visible:shadow-(--halo-focus)"
      />
      <span>Animations</span>
    </label>
    <p className="mt-1 text-sm text-muted">
      Coupées, les transitions et les mouvements disparaissent ; toutes les fonctions restent disponibles. Le réglage du système
      « réduire les animations » est toujours respecté.
    </p>
  </div>
);

export default ReglageAnimations;
