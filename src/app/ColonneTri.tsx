import React, { useId, useState } from 'react';
import { LIBELLES_STATUT, type Carte } from '../lib/collection';
import type { ColonneTri as Colonne } from '../lib/colonnesTri';
import CarteTri from './CarteTri';

export const CARTES_PAR_COLONNE = 50;

const BORDURE: Record<Colonne, string> = {
  garder: 'border-t-garder',
  echanger: 'border-t-echanger',
  vendre: 'border-t-vendre',
  defausser: 'border-t-defausser',
  'a-trier': 'border-t-muted',
};
const SYMBOLE: Record<Colonne, string> = { garder: '♥', echanger: '⇄', vendre: '€', defausser: '✕', 'a-trier': '?' };

interface Props {
  statut: Colonne;
  /** Toutes les cartes de la colonne ; seules `limite` sont rendues. */
  cartes: readonly Carte[];
  limite: number;
  cible: boolean;
  /** Sous 600 px : colonne repliable. */
  etroit: boolean;
  glisserDe: (id: string, colonne: Colonne) => React.HTMLAttributes<HTMLElement>;
  idEnGlisse: string | null;
  refCarte: (cle: string) => (el: HTMLElement | null) => void;
  onDeplacer: (id: string, vers: Colonne, sens: 'gauche' | 'droite') => void;
  onPlus: () => void;
}

/** Colonne du tableau de tri (D-15) : `role="group"` nommé par « titre + nombre », bordure haute de 4 px. */
const ColonneTri: React.FC<Props> = ({
  statut, cartes, limite, cible, etroit, glisserDe, idEnGlisse, refCarte, onDeplacer, onPlus,
}) => {
  const idTitre = useId();
  const idContenu = useId();
  const [ouvertEtroit, setOuvertEtroit] = useState(true);
  const ouvert = !etroit || ouvertEtroit;
  const titre = (
    <span id={idTitre}>
      {LIBELLES_STATUT[statut]} {cartes.length}
    </span>
  );
  const rendues = cartes.slice(0, limite);
  return (
    <section
      role="group"
      aria-labelledby={idTitre}
      data-testid={`colonne-tri-${statut}`}
      data-colonne={statut}
      data-cible={cible ? 'true' : undefined}
      className={`min-w-0 rounded-lg border border-muted border-t-4 bg-ink-2 transition-colors duration-(--d-fast) data-[cible=true]:border-2 data-[cible=true]:border-dashed data-[cible=true]:border-paper data-[cible=true]:bg-(--surface-survol) ${BORDURE[statut]}`}
    >
      <h3 className="text-lg font-bold">
        {etroit ? (
          <button
            type="button"
            aria-expanded={ouvertEtroit}
            aria-controls={idContenu}
            onClick={() => setOuvertEtroit((o) => !o)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 text-left focus-visible:shadow-(--halo-focus)"
          >
            <span aria-hidden="true">{SYMBOLE[statut]}</span>
            {titre}
            <span aria-hidden="true" className="wm-chevron ml-auto" data-ouvert={ouvertEtroit}>▼</span>
          </button>
        ) : (
          <span className="flex min-h-11 items-center gap-2 px-3">
            <span aria-hidden="true">{SYMBOLE[statut]}</span>
            {titre}
          </span>
        )}
      </h3>
      <div className="wm-repli" data-ouvert={ouvert}>
        <div id={idContenu} className={`wm-repli-contenu px-3 ${ouvert ? 'pb-3' : 'invisible'}`}>
          {cartes.length === 0 ? (
            <p className="text-sm text-muted">Aucune carte.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {rendues.map((c) => (
                <CarteTri
                  key={c.id}
                  carte={c}
                  colonne={statut}
                  refCarte={refCarte(c.id)}
                  glisser={glisserDe(c.id, statut)}
                  enGlisse={idEnGlisse === c.id}
                  onDeplacer={onDeplacer}
                />
              ))}
            </ul>
          )}
          {cartes.length > rendues.length && (
            <button
              type="button"
              onClick={onPlus}
              className="mt-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded border border-muted bg-ink px-4 focus-visible:shadow-(--halo-focus)"
            >
              Afficher plus ({cartes.length - rendues.length} restantes)
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default ColonneTri;
