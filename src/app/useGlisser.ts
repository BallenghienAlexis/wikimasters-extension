import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColonneTri } from '../lib/colonnesTri';

export interface EtatGlisser {
  id: string;
  origine: ColonneTri;
  /** Colonne survolée (y compris l’origine) ou `null`. */
  cible: ColonneTri | null;
}

interface Session {
  id: string;
  origine: ColonneTri;
  pointerId: number;
  x: number;
  y: number;
  actif: boolean;
  annule: boolean;
}

const SEUIL_PX = 6;

function colonneSous(x: number, y: number): ColonneTri | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const c = el.closest<HTMLElement>('[data-colonne]');
    if (c?.dataset.colonne) return c.dataset.colonne as ColonneTri;
  }
  return null;
}

function remettre(el: HTMLElement): void {
  el.style.transform = '';
  el.style.zIndex = '';
  el.style.position = '';
  el.style.boxShadow = '';
}

/**
 * Glisser-déposer au pointeur (Pointer Events avec capture, aucune bibliothèque). Voie de confort : les flèches
 * restent la voie principale. Un glisser ne démarre qu’après un déplacement de 6 px et jamais depuis un bouton ;
 * Échap ou une interruption du pointeur (défilement tactile) l’annule sans rien écrire.
 */
export function useGlisser(onDeposer: (id: string, colonne: ColonneTri) => void) {
  const [etat, setEtat] = useState<EtatGlisser | null>(null);
  const session = useRef<Session | null>(null);
  const element = useRef<HTMLElement | null>(null);
  const rappel = useRef(onDeposer);
  useEffect(() => {
    rappel.current = onDeposer;
  });

  const terminer = useCallback(() => {
    if (element.current) remettre(element.current);
    element.current = null;
    session.current = null;
    setEtat(null);
  }, []);

  useEffect(() => {
    if (!etat) return undefined;
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (session.current) session.current.annule = true;
      terminer();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [etat, terminer]);

  const proprietes = (id: string, origine: ColonneTri) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>): void => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      session.current = { id, origine, pointerId: e.pointerId, x: e.clientX, y: e.clientY, actif: false, annule: false };
      element.current = e.currentTarget;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>): void => {
      const s = session.current;
      if (!s || s.annule || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.actif && Math.hypot(dx, dy) < SEUIL_PX) return;
      s.actif = true;
      const el = e.currentTarget;
      el.style.position = 'relative';
      el.style.zIndex = '10';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.boxShadow = 'var(--shadow-leve)';
      const cible = colonneSous(e.clientX, e.clientY);
      setEtat((p) => (p && p.cible === cible ? p : { id: s.id, origine: s.origine, cible }));
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>): void => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const depose = s.actif && !s.annule ? colonneSous(e.clientX, e.clientY) : null;
      terminer();
      if (depose && depose !== s.origine) rappel.current(s.id, depose);
    },
    onPointerCancel: (): void => {
      if (session.current) terminer();
    },
  });

  return { etat, proprietes };
}
