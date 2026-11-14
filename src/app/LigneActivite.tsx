import React, { useId, useState } from 'react';
import { useMouvement } from './useMouvement';

/** Une barre du détail déplié (une par étape de synchro ou par lot). */
export interface BarreDetail {
  libelle: string;
  valeur: number | null;
  max: number;
  /** Texte écrit à côté (« 3 / 6 · 50 % »). */
  texte: string;
}

export interface Commande {
  nom: string;
  onActiver: () => void;
}

interface Props {
  genre: 'synchro' | 'lots';
  nom: string;
  /** Pourcentage écrit de la ligne repliée, `null` = inconnu (barre indéterminée). */
  pourcent: number | null;
  /** Valeurs ARIA de la barre repliée (par défaut le pourcentage sur 100). */
  barre?: { valeur: number | null; max: number };
  resume: string;
  details: BarreDetail[];
  /** Boutons du détail ; `null` = lecture seule (traitement d’un autre onglet). */
  commandes: Commande[] | null;
  /** Lot suspendu par le joueur (symbole ⏸ et mot d’état, jamais la couleur seule). */
  enPause?: boolean;
}

/** Barre fine ou normale, sans texte propre : le texte est écrit à côté par la ligne. */
const Piste: React.FC<{ valeur: number | null; max: number; libelle: string; fine?: boolean; testid?: string }> = ({ valeur, max, libelle, fine = false, testid }) => {
  const mouvement = useMouvement();
  const indeterminee = valeur === null;
  const borne = indeterminee ? 0 : Math.min(max, Math.max(0, valeur));
  const pct = indeterminee || max <= 0 ? 100 : (borne / max) * 100;
  const remplissage = indeterminee ? (mouvement ? 'wm-rayures' : 'bg-muted') : 'bg-paper wm-barre-remplissage';
  return (
    <div
      role="progressbar"
      aria-label={libelle}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminee ? undefined : borne}
      data-testid={testid}
      className={`w-full min-w-0 overflow-hidden rounded-full border border-paper bg-ink-2 ${fine ? 'h-2' : 'h-4'}`}
    >
      <div className={`h-full w-full rounded-full ${remplissage}`} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
};

/**
 * Ligne du bandeau d’activité (D-03) : en-tête bouton de 44 px (`aria-expanded`, `aria-controls`), puis détail.
 * L’état déplié reste dans le composant : il n’est jamais stocké (H13).
 */
const LigneActivite: React.FC<Props> = ({ genre, nom, pourcent, barre, resume, details, commandes, enPause = false }) => {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  const idDetail = `detail-activite-${genre}${id}`;
  return (
    <div data-testid={`ligne-activite-${genre}`} className="border-y border-line bg-ink-2">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={idDetail}
        onClick={() => setOuvert((o) => !o)}
        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left focus-visible:shadow-(--halo-focus)"
      >
        <span className="font-bold">{nom}</span>
        <span className="text-sm">
          <span aria-hidden="true">{enPause ? '⏸' : '▶'}</span> {enPause ? 'Suspendu' : 'En cours'}
        </span>
        <span className="flex min-w-24 flex-1 items-center gap-2">
          <Piste valeur={barre ? barre.valeur : pourcent} max={barre ? barre.max : 100} libelle={`Progression : ${nom}`} fine />
          <span data-testid="pourcentage-ligne" className="shrink-0 text-sm">
            {pourcent === null ? '… %' : `${pourcent} %`}
          </span>
        </span>
        <span data-testid="resume-ligne" className="hidden text-sm text-muted md:inline">
          {resume}
        </span>
        <span aria-hidden="true" className="wm-chevron" data-ouvert={ouvert}>
          ▼
        </span>
      </button>
      <div className="wm-repli" data-ouvert={ouvert}>
        <div id={idDetail} className={`wm-repli-contenu px-3 ${ouvert ? 'pb-3' : 'invisible'}`}>
          {ouvert && (
            <>
              <p className="mb-2 text-sm text-muted md:hidden">{resume}</p>
              <ul className="flex flex-col gap-2">
                {details.map((d) => (
                  <li key={d.libelle} className="flex flex-col gap-1">
                    <span className="text-sm">{d.libelle}</span>
                    <Piste valeur={d.valeur} max={d.max} libelle={d.libelle} testid="barre-detail" />
                    <span className="text-sm text-muted">{d.texte}</span>
                  </li>
                ))}
              </ul>
              {commandes !== null && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {commandes.map((c) => (
                    <button
                      key={c.nom}
                      type="button"
                      onClick={c.onActiver}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded border border-muted bg-ink px-4 focus-visible:shadow-(--halo-focus)"
                    >
                      {c.nom}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LigneActivite;
