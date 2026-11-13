import React, { useId, useState } from 'react';

interface Props {
  titre: string;
  /** Résumé écrit à côté du titre, visible replié (« Plafond : 5 »). */
  resume: string;
  /** Identifiant stable, base de ceux du bouton et du contenu. */
  id: string;
  children?: React.ReactNode;
}

/** Section repliable (D-50) : replié par défaut, contenu `invisible` donc hors tabulation. */
const SectionRepliable: React.FC<Props> = ({ titre, resume, id, children }) => {
  const [ouvert, setOuvert] = useState(false);
  const suffixe = useId();
  const idContenu = `${id}-contenu${suffixe}`;
  return (
    <section className="rounded-xl border border-muted bg-ink-2">
      <h3>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idContenu}
          onClick={() => setOuvert((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left"
        >
          <span className="font-bold">{titre}</span>
          <span className="text-sm text-muted">{resume}</span>
          <span aria-hidden="true">{ouvert ? '▲' : '▼'}</span>
        </button>
      </h3>
      <div className="wm-repli" data-ouvert={ouvert}>
        <div id={idContenu} className={`wm-repli-contenu px-3 ${ouvert ? 'pb-3' : 'invisible'}`}>
          {children}
        </div>
      </div>
    </section>
  );
};

export default SectionRepliable;
