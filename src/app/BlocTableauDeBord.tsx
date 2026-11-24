import React, { useId } from 'react';

interface Props {
  titre: string;
  /** Résumé court à droite du titre (« 4 999 cartes · Ville 13 % »). */
  resume?: string;
  /** Identifiant stable et repère de test. */
  id: string;
  /** Classes ajoutées à la carte. */
  className?: string;
  children?: React.ReactNode;
}

/**
 * Bloc du Tableau de bord, toujours visible (Alexis, 2026-11-24 : « retire le principe de repli sur cette page uniquement »).
 * Carte compacte : titre et résumé sur une ligne, contenu directement dessous. Les autres onglets gardent `SectionRepliable`.
 */
const BlocTableauDeBord: React.FC<Props> = ({ titre, resume, id, className = '', children }) => {
  const idTitre = `${id}-titre${useId()}`;
  return (
    <section aria-labelledby={idTitre} data-testid={id} className={`min-w-0 rounded-xl border border-muted bg-ink-2 p-3 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={idTitre} className="font-bold">{titre}</h3>
        {resume && <span className="min-w-0 truncate text-xs text-muted">{resume}</span>}
      </div>
      {children}
    </section>
  );
};

export default BlocTableauDeBord;
