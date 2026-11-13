import React from 'react';
import { useMouvement } from './useMouvement';

interface Props {
  /** `null` = total inconnu (barre indéterminée, sans `aria-valuenow`). */
  valeur: number | null;
  max: number;
  /** Nom accessible, en français. */
  libelle: string;
  /** Texte écrit à côté (« 37 / 120 · 31 % », « 37 lus »). */
  texte: string;
  /** Version fine (8 px) pour la barre globale et le bandeau. */
  fine?: boolean;
  /** Barre active : reflet qui défile. */
  enCours?: boolean;
}

const BarreProgression: React.FC<Props> = ({ valeur, max, libelle, texte, fine = false, enCours = false }) => {
  const mouvement = useMouvement();
  const indeterminee = valeur === null;
  const borne = indeterminee ? 0 : Math.min(max, Math.max(0, valeur));
  const pct = indeterminee || max <= 0 ? 100 : (borne / max) * 100;
  const remplissage = indeterminee
    ? mouvement
      ? 'wm-rayures'
      : 'bg-muted'
    : `bg-paper wm-barre-remplissage${enCours && mouvement ? ' wm-reflet' : ''}`;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={libelle}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminee ? undefined : borne}
        className={`w-full overflow-hidden rounded-full border border-paper bg-ink-2 ${fine ? 'h-2' : 'h-4'}`}
      >
        <div className={`h-full w-full rounded-full ${remplissage}`} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="text-sm text-paper">{texte}</p>
    </div>
  );
};

export default BarreProgression;
