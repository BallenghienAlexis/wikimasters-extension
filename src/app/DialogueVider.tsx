import React, { useEffect, useRef } from 'react';

interface Props {
  onAnnuler: () => void;
  onConfirmer: () => void;
}

const BOUTON = 'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border px-4 font-semibold';

/**
 * Rend inertes tous les éléments qui entourent le dialogue (D-26). Renvoie la fonction
 * qui rétablit l’état d’origine.
 */
function isolerArrierePlan(racine: HTMLElement): () => void {
  const modifies: HTMLElement[] = [];
  let courant: HTMLElement | null = racine;
  while (courant && courant !== document.body) {
    const parent: HTMLElement | null = courant.parentElement;
    if (!parent) break;
    for (const frere of Array.from(parent.children)) {
      if (frere !== courant && frere instanceof HTMLElement && !frere.inert) {
        frere.inert = true;
        modifies.push(frere);
      }
    }
    courant = parent;
  }
  return () => {
    for (const element of modifies) element.inert = false;
  };
}

/**
 * Dialogue « Vider le journal ? » (D-32). Focus initial sur « Annuler », focus piégé,
 * Échap = Annuler, un clic sur le voile n’a aucun effet.
 */
const DialogueVider: React.FC<Props> = ({ onAnnuler, onConfirmer }) => {
  const boite = useRef<HTMLDivElement>(null);
  const annuler = useRef<HTMLButtonElement>(null);
  const vider = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    annuler.current?.focus();
    const rétablir = boite.current ? isolerArrierePlan(boite.current) : () => {};
    return () => {
      rétablir();
    };
  }, []);

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onAnnuler();
      return;
    }
    if (e.key !== 'Tab') return;
    const premier = annuler.current;
    const dernier = vider.current;
    if (!premier || !dernier) return;
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80" data-testid="dialogue-vider">
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-dialogue-vider"
        aria-describedby="corps-dialogue-vider"
        onKeyDown={surTouche}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded border border-paper bg-ink-2 p-4"
      >
        <h2 id="titre-dialogue-vider" className="text-lg font-semibold">
          Vider le journal ?
        </h2>
        <p id="corps-dialogue-vider" className="mt-2">
          Cela efface l’historique local. La collection et les étiquettes enregistrées ne sont pas touchées.
        </p>
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap">
          <button
            ref={annuler}
            type="button"
            className={`${BOUTON} border-paper bg-ink text-paper hover:bg-line active:bg-line`}
            onClick={onAnnuler}
          >
            Annuler
          </button>
          <button
            ref={vider}
            type="button"
            className={`${BOUTON} border-defausser bg-ink text-defausser hover:bg-ink-2 active:bg-ink-2`}
            onClick={onConfirmer}
          >
            Vider
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialogueVider;
