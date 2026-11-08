import React, { useEffect, useRef } from 'react';
import type { Decision } from '../lib/file';

type BoutonDialogue = 'defausser' | 'passer' | 'arreter';

/** Ordre du DOM et de la tabulation (D-25). */
export const ORDRE_BOUTONS: readonly BoutonDialogue[] = ['defausser', 'passer', 'arreter'];

/** Focus initial : « Passer », jamais le bouton destructeur (D-26, D-43). */
export const BOUTON_FOCUS_INITIAL: BoutonDialogue = 'passer';

/** Échap vaut « Passer ». Entrée et Espace n’activent que le bouton focalisé : aucune décision ici. */
export function decisionTouche(touche: string): Decision | null {
  return touche === 'Escape' ? 'passer' : null;
}

/** Bouton à focaliser pour boucler le focus, ou `null` si le navigateur peut avancer seul. */
export function cibleTabulation(actif: BoutonDialogue | null, maj: boolean): BoutonDialogue | null {
  const premier = ORDRE_BOUTONS[0]!;
  const dernier = ORDRE_BOUTONS[ORDRE_BOUTONS.length - 1]!;
  if (!maj && actif === dernier) return premier;
  if (maj && actif === premier) return dernier;
  return null;
}

export const titreDialogue = (carte: string): string => `Défausser ${carte} ?`;

/** Rend inertes les éléments qui entourent le dialogue (D-26). Renvoie la fonction de rétablissement. */
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

const BOUTON = 'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border px-4 font-semibold';

interface Props {
  /** Carte telle qu’affichée : « [R] Titre ». */
  carte: string;
  /** Rang de l’exemplaire parmi les défausses de cette carte dans le lot. */
  rang: number;
  total: number;
  onDecision: (decision: Decision) => void;
}

/**
 * Dialogue de confirmation d’une défausse (D-24 à D-27, D-43). Focus initial sur « Passer »,
 * focus piégé, Échap = Passer, un clic sur le voile n’a aucun effet. Pas de formulaire.
 */
const DialogueDefausse: React.FC<Props> = ({ carte, rang, total, onDecision }) => {
  const boite = useRef<HTMLDivElement>(null);
  const boutons = useRef<Record<BoutonDialogue, HTMLButtonElement | null>>({ defausser: null, passer: null, arreter: null });

  useEffect(() => {
    boutons.current[BOUTON_FOCUS_INITIAL]?.focus();
    const retablir = boite.current ? isolerArrierePlan(boite.current) : () => {};
    return retablir;
  }, []);

  const surTouche = (e: React.KeyboardEvent): void => {
    const decision = decisionTouche(e.key);
    if (decision !== null) {
      e.preventDefault();
      e.stopPropagation();
      onDecision(decision);
      return;
    }
    if (e.key !== 'Tab') return;
    const actif = ORDRE_BOUTONS.find((b) => boutons.current[b] === document.activeElement) ?? null;
    const cible = cibleTabulation(actif, e.shiftKey);
    if (cible !== null) {
      e.preventDefault();
      boutons.current[cible]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80" data-testid="dialogue-defausse">
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-dialogue-defausse"
        aria-describedby="corps-dialogue-defausse"
        onKeyDown={surTouche}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded border border-paper bg-ink-2 p-4"
      >
        <h2 id="titre-dialogue-defausse" className="break-words text-lg font-semibold">
          {titreDialogue(carte)}
        </h2>
        <div id="corps-dialogue-defausse">
          <p className="mt-2">
            Exemplaire {rang} sur {total}.
          </p>
          <p className="mt-2 font-semibold text-defausser">
            <span aria-hidden="true">! </span>Cette action est définitive sur le site.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap">
          <button
            ref={(el) => {
              boutons.current.defausser = el;
            }}
            type="button"
            className={`${BOUTON} border-defausser bg-ink text-defausser hover:bg-ink-2 active:bg-ink-2`}
            onClick={() => onDecision('defausser')}
          >
            Défausser cette carte
          </button>
          <button
            ref={(el) => {
              boutons.current.passer = el;
            }}
            type="button"
            className={`${BOUTON} border-paper bg-ink text-paper hover:bg-line active:bg-line`}
            onClick={() => onDecision('passer')}
          >
            Passer
          </button>
          <button
            ref={(el) => {
              boutons.current.arreter = el;
            }}
            type="button"
            className={`${BOUTON} border-muted bg-ink text-paper hover:bg-line active:bg-line`}
            onClick={() => onDecision('arreter')}
          >
            Arrêter le lot
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialogueDefausse;
