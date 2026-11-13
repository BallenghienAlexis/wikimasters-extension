import React, { useLayoutEffect, useRef, useState } from 'react';
import { ONGLETS, idOnglet, idPanneau, type IdOnglet } from './onglets';
import { useMouvement } from './useMouvement';

interface Props {
  actif: IdOnglet;
  onChoisir: (id: IdOnglet) => void;
}

interface Indicateur {
  gauche: number;
  largeur: number;
}

/**
 * Barre d’onglets (D-12) : motif WAI-ARIA `tablist` / `tab`, `tabindex` itinérant, flèches, Origine et Fin.
 * Elle défile dans son propre conteneur à 375 px ; l’indicateur de 3 px glisse sous l’onglet actif.
 */
const Onglets: React.FC<Props> = ({ actif, onChoisir }) => {
  const mouvement = useMouvement();
  const conteneur = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<IdOnglet, HTMLAnchorElement>>(new Map());
  const [indicateur, setIndicateur] = useState<Indicateur | null>(null);
  const [anime, setAnime] = useState(false);

  useLayoutEffect(() => {
    const mesurer = (): void => {
      const el = refs.current.get(actif);
      if (el) setIndicateur({ gauche: el.offsetLeft, largeur: el.offsetWidth });
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [actif]);

  // Le glissement n’est actif qu’après la première mesure : pas de trajet à l’ouverture de la page.
  useLayoutEffect(() => {
    if (indicateur !== null) setAnime(true);
  }, [indicateur]);

  const deplacer = (e: React.KeyboardEvent, position: number): void => {
    const n = ONGLETS.length;
    let cible: number;
    if (e.key === 'ArrowRight') cible = (position + 1) % n;
    else if (e.key === 'ArrowLeft') cible = (position + n - 1) % n;
    else if (e.key === 'Home') cible = 0;
    else if (e.key === 'End') cible = n - 1;
    else return;
    e.preventDefault();
    const suivant = ONGLETS[cible];
    if (!suivant) return;
    onChoisir(suivant.id);
    refs.current.get(suivant.id)?.focus();
  };

  return (
    <div
      ref={conteneur}
      role="tablist"
      aria-label="Sections"
      className="relative mt-3 flex max-w-full overflow-x-auto border-b border-line"
    >
      {ONGLETS.map((o, i) => {
        const selectionne = o.id === actif;
        return (
          <a
            key={o.id}
            ref={(el) => {
              if (el) refs.current.set(o.id, el);
              else refs.current.delete(o.id);
            }}
            id={idOnglet(o.id)}
            role="tab"
            href={`#${o.id}`}
            aria-selected={selectionne}
            aria-controls={idPanneau(o.id)}
            tabIndex={selectionne ? 0 : -1}
            onKeyDown={(e) => deplacer(e, i)}
            className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-4 no-underline focus-visible:shadow-(--halo-focus) ${selectionne ? 'text-paper font-semibold' : 'text-muted'}`}
          >
            {o.nom}
          </a>
        );
      })}
      {indicateur && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-paper"
          style={{
            width: indicateur.largeur,
            transform: `translateX(${indicateur.gauche}px)`,
            transition: anime && mouvement ? 'transform var(--d-base) var(--ease-spring)' : 'none',
          }}
        />
      )}
    </div>
  );
};

export default Onglets;
