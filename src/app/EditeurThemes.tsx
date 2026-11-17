import React, { useEffect, useRef, useState } from 'react';
import { IDS_THEMES_CHOISISSABLES, LIBELLES_THEMES } from '../lib/themes';
import { MAX_THEMES_CHOISIS } from '../lib/themesChoisis';

interface Props {
  titre: string;
  /** Thèmes actuellement choisis à la main (null = automatique) ; sert de point de départ. */
  choisis: readonly string[] | null;
  /** Thèmes déduits automatiquement, proposés comme point de départ quand rien n’est choisi. */
  automatiques: readonly string[];
  /** null = revenir à l’automatique. */
  onValider: (themes: string[] | null) => void;
  /** Fermeture sans rien changer (Échap, Annuler) ou après validation. */
  onFermer: () => void;
}

const BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-3';

/** Choix manuel des thèmes d’une carte (1 à 4, jamais « autres ») : fenêtre modale native, clavier et Échap compris. */
const EditeurThemes: React.FC<Props> = ({ titre, choisis, automatiques, onValider, onFermer }) => {
  const dialogue = useRef<HTMLDialogElement>(null);
  const depart = (choisis ?? automatiques.filter((t) => IDS_THEMES_CHOISISSABLES.includes(t))).slice(0, MAX_THEMES_CHOISIS);
  const [selection, setSelection] = useState<string[]>([...depart]);

  useEffect(() => {
    if (dialogue.current && !dialogue.current.open) dialogue.current.showModal?.();
  }, []);

  const basculer = (id: string): void =>
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_THEMES_CHOISIS ? s : [...s, id]));
  const pleine = selection.length >= MAX_THEMES_CHOISIS;

  return (
    <dialog ref={dialogue} aria-label={`Thèmes de ${titre}`} className="m-auto max-h-[90vh] w-[min(36rem,92vw)] overflow-y-auto rounded border border-line bg-ink p-4 text-paper" onClose={onFermer}>
      <h3 className="font-bold break-words">Thèmes de {titre}</h3>
      <p className="mt-1 text-sm text-muted">
        De 1 à {MAX_THEMES_CHOISIS} thèmes. Votre choix remplace les thèmes déduits et prime sur toutes les règles ; « Autres » et « À classer » n’existent pas ici.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-1 min-[480px]:grid-cols-2">
        {IDS_THEMES_CHOISISSABLES.map((id) => {
          const coche = selection.includes(id);
          return (
            <li key={id}>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={coche} disabled={!coche && pleine} onChange={() => basculer(id)} />
                {LIBELLES_THEMES[id] ?? id}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm" aria-live="polite">{selection.length} sur {MAX_THEMES_CHOISIS} thèmes choisis</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BOUTON} disabled={selection.length === 0} onClick={() => { onValider([...selection]); dialogue.current?.close(); }}>
          Enregistrer
        </button>
        {choisis !== null && (
          <button type="button" className={BOUTON} onClick={() => { onValider(null); dialogue.current?.close(); }}>
          Revenir à l’automatique
        </button>
        )}
        <button type="button" className={BOUTON} onClick={() => dialogue.current?.close()}>
          Annuler
        </button>
      </div>
    </dialog>
  );
};

export default EditeurThemes;
