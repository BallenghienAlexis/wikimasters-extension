import React, { useId, useState } from 'react';

interface Props {
  titre: string;
  /** Résumé écrit à côté du titre, visible replié (« Plafond : 5 »). */
  resume: string;
  /** Identifiant stable, base de ceux du bouton et du contenu. */
  id: string;
  /** Niveau du titre (3 par défaut). */
  niveau?: 2 | 3 | 4;
  /** Ouvert au premier rendu (replié sinon) : réservé aux blocs qui portent l’opération en cours. */
  ouvertParDefaut?: boolean;
  /** Repère de test de la section. */
  testId?: string;
  /** Classes ajoutées à la section (marge). */
  className?: string;
  children?: React.ReactNode;
}

/** Section repliable (D-50) : replié par défaut, contenu `invisible` donc hors tabulation. */
const SectionRepliable: React.FC<Props> = ({ titre, resume, id, niveau = 3, ouvertParDefaut = false, testId, className = '', children }) => {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const suffixe = useId();
  const idContenu = `${id}-contenu${suffixe}`;
  const Titre = `h${niveau}` as 'h2' | 'h3' | 'h4';
  return (
    <section className={`rounded-xl border border-muted bg-ink-2 ${className}`} data-testid={testId}>
      <Titre>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idContenu}
          onClick={() => setOuvert((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left focus-visible:shadow-(--halo-focus)"
        >
          <span className="min-w-0 shrink-0 max-w-[55%] font-bold">{titre}</span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="min-w-0 flex-1 truncate text-right text-sm text-muted">{resume}</span>
            <span aria-hidden="true" className="wm-chevron shrink-0" data-ouvert={ouvert}>
              ▼
            </span>
          </span>
        </button>
      </Titre>
      <div className="wm-repli" data-ouvert={ouvert}>
        <div id={idContenu} className={`wm-repli-contenu px-3 ${ouvert ? 'pb-3' : 'invisible'}`}>
          {children}
        </div>
      </div>
    </section>
  );
};

export default SectionRepliable;
