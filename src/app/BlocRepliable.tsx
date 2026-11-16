import React, { useId, useState } from 'react';

interface Props {
  titre: string;
  /** Dernière information ou résumé visible replié (« 3 entrées », « À jour »). */
  resume: string;
  /** Identifiant stable : base de ceux du bouton et du contenu, et du repère de test `bloc-<id>`. */
  id: string;
  /** Ouvert au premier affichage (une opération en cours ou une erreur à voir). Replié sinon. */
  ouvertParDefaut?: boolean;
  children?: React.ReactNode;
}

/**
 * Bloc repliable (épuration de l’interface, 2026-11-16) : une barre avec le titre et un résumé, le contenu en dessous.
 * Le contenu garde sa propre présentation ; replié, il est `invisible` donc hors tabulation et hors lecture d’écran.
 * Le choix de l’utilisateur est gardé tant que le bloc reste affiché ; `ouvertParDefaut` ne sert qu’au premier affichage.
 */
const BlocRepliable: React.FC<Props> = ({ titre, resume, id, ouvertParDefaut = false, children }) => {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const suffixe = useId();
  const idContenu = `${id}-contenu${suffixe}`;
  return (
    <div className="mt-4" data-testid={`bloc-${id}`}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={idContenu}
        data-testid={`bloc-${id}-bouton`}
        onClick={() => setOuvert((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-muted bg-ink-2 px-3 text-left focus-visible:shadow-(--halo-focus)"
      >
        <span className="font-bold">{titre}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm text-muted">{resume}</span>
          <span aria-hidden="true" className="wm-chevron" data-ouvert={ouvert}>
            ▼
          </span>
        </span>
      </button>
      <div className="wm-repli" data-ouvert={ouvert}>
        <div id={idContenu} className={`wm-repli-contenu ${ouvert ? '' : 'invisible'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default BlocRepliable;
