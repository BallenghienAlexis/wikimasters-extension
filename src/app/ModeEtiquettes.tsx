import React from 'react';
import type { ModeEtiquettes as Mode } from '../lib/tri';

interface Props {
  mode: Mode;
  /** Nombre d’étiquettes posées par l’extension (couples exemplaire/étiquette du registre). */
  posees: number;
  onChange: (mode: Mode) => void;
  onCopie: () => void;
}

const NB = ' ';

const CHOIX: ReadonlyArray<{ mode: Mode; titre: string; aide: string }> = [
  { mode: 'suspendre', titre: 'Pose suspendue (par défaut)', aide: 'Les lots ne créent ni ne posent aucune étiquette ; seuls les retraits d’étiquettes devenues fausses sont proposés.' },
  { mode: 'retirer-tout', titre: 'Retirer toutes les étiquettes', aide: 'Le prochain lot ne propose que le retrait de toutes les étiquettes posées par l’extension. Rien n’est envoyé avant votre « Lancer ».' },
  { mode: 'poser', titre: 'Poser selon les règles', aide: 'Fonctionnement normal : les lots posent et retirent les étiquettes d’après les règles de thèmes courantes.' },
];

/** Mode des étiquettes (Alexis, 2026-11-17) : suspendre la pose, tout retirer, puis réappliquer quand les règles sont stables. */
const ModeEtiquettes: React.FC<Props> = ({ mode, posees, onChange, onCopie }) => (
  <section aria-labelledby="titre-mode-etiquettes" className="py-2" data-testid="mode-etiquettes">
    <h4 id="titre-mode-etiquettes" className="font-semibold">Étiquettes sur le site</h4>
    <p className="mt-1 text-sm text-muted">
      {posees} étiquette(s) posée(s) par l’extension. Le changement de mode n’envoie rien{NB}: l’aperçu de l’onglet Lots montre le nombre d’actions, et
      seul « Lancer » écrit sur le site. Pour tout réappliquer, choisissez « Poser selon les règles » une fois les règles stables.
    </p>
    <fieldset className="mt-3 flex flex-col gap-2">
      <legend className="sr-only">Mode des étiquettes</legend>
      {CHOIX.map((c) => (
        <label key={c.mode} className="flex min-h-11 items-start gap-3">
          <input type="radio" name="mode-etiquettes" className="mt-1" checked={mode === c.mode} onChange={() => onChange(c.mode)} />
          <span>
            <span className="font-medium">{c.titre}</span>
            <span className="block text-sm text-muted">{c.aide}</span>
          </span>
        </label>
      ))}
    </fieldset>
    <button type="button" className="mt-3 min-h-11 rounded border border-line px-3" onClick={onCopie}>
      Télécharger la liste des étiquettes posées
    </button>
  </section>
);

export default ModeEtiquettes;
