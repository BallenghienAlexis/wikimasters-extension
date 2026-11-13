import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { LIBELLES_STATUT, type Statut } from '../lib/collection';
import type { LigneRepartition } from '../lib/tableauDeBord';
import BulleRepartition, { texteExemplaires, texteValeur } from './BulleRepartition';
import { useMouvement } from './useMouvement';

interface Props {
  repartition: readonly LigneRepartition[];
}

/** Largeur rendue minimale pour écrire l’étiquette dans le segment (D-14). */
const LARGEUR_ETIQUETTE = 96;
/** Délai avant fermeture quand le pointeur quitte segment ou bulle (laisse le temps de passer de l’un à l’autre). */
const DELAI_FERMETURE_MS = 150;

const FONDS: Record<Statut, string> = {
  'a-trier': 'bg-muted',
  garder: 'bg-garder',
  echanger: 'bg-echanger',
  vendre: 'bg-vendre',
  'en-vente': 'bg-(image:--hachure-en-vente)',
  defausser: 'bg-defausser',
};

const SYMBOLES: Record<Statut, string> = {
  'a-trier': '?',
  garder: '●',
  echanger: '⇄',
  vendre: '€',
  'en-vente': '▤',
  defausser: '✕',
};

const FONDS_LEGENDE: Record<Statut, string> = {
  'a-trier': 'border-muted',
  garder: 'border-garder',
  echanger: 'border-echanger',
  vendre: 'border-vendre',
  'en-vente': 'border-vendre',
  defausser: 'border-defausser',
};

interface Ouverture {
  statut: Statut;
  /** Élément d’où la bulle a été ouverte : segment ou bouton de légende. */
  source: 'segment' | 'legende';
}

const nomAccessible = (l: LigneRepartition): string =>
  `${LIBELLES_STATUT[l.statut]}\u00a0: ${texteExemplaires(l.exemplaires)}, ${l.part}\u00a0%, valeur estimée ${texteValeur(l.valeur)}`;

/**
 * Barre de répartition des décisions (D-06, D-13, D-14) : segments proportionnels en boutons, bulle de détail,
 * légende en boutons de 44 px pour les segments trop étroits pour porter leur étiquette.
 */
const BarreRepartition: React.FC<Props> = ({ repartition }) => {
  const mouvement = useMouvement();
  const idBulle = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  const segments = useRef(new Map<Statut, HTMLButtonElement>());
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [largeur, setLargeur] = useState(0);
  const [ouvert, setOuvert] = useState<Ouverture | null>(null);
  const [gaucheBulle, setGaucheBulle] = useState(0);

  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    setLargeur(el.getBoundingClientRect().width);
    const observateur = new ResizeObserver(() => setLargeur(el.getBoundingClientRect().width));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const annulerFermeture = useCallback((): void => {
    if (minuterie.current !== null) clearTimeout(minuterie.current);
    minuterie.current = null;
  }, []);
  const ouvrir = useCallback(
    (statut: Statut, source: Ouverture['source']): void => {
      annulerFermeture();
      setOuvert({ statut, source });
    },
    [annulerFermeture],
  );
  const fermerBientot = useCallback((): void => {
    annulerFermeture();
    minuterie.current = setTimeout(() => setOuvert(null), DELAI_FERMETURE_MS);
  }, [annulerFermeture]);
  useEffect(() => annulerFermeture, [annulerFermeture]);

  // Échap ferme la bulle seulement quand elle est ouverte ; le focus reste (ou revient) sur l’élément d’origine.
  const statutOuvert = ouvert?.statut ?? null;
  const sourceOuverte = ouvert?.source ?? null;
  useEffect(() => {
    if (statutOuvert === null) return;
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setOuvert(null);
      if (sourceOuverte === 'segment') {
        const segment = segments.current.get(statutOuvert);
        const actif = document.activeElement;
        if (segment && actif !== segment && conteneur.current?.parentElement?.contains(actif)) segment.focus();
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [statutOuvert, sourceOuverte]);

  // La bulle suit son segment, bornée à la largeur de la barre.
  useLayoutEffect(() => {
    if (statutOuvert === null) return;
    const segment = segments.current.get(statutOuvert);
    if (!segment) return;
    const centre = segment.offsetLeft + segment.offsetWidth / 2;
    const largeurBulle = Math.min(288, largeur);
    setGaucheBulle(Math.max(0, Math.min(centre - largeurBulle / 2, largeur - largeurBulle)));
  }, [statutOuvert, largeur]);

  const ligneOuverte = repartition.find((l) => l.statut === statutOuvert) ?? null;
  const etroit = (l: LigneRepartition): boolean => (largeur * l.part) / 100 < LARGEUR_ETIQUETTE;
  const etroits = repartition.filter(etroit);

  return (
    <div className="mt-4">
      <div className="relative">
        <div
          ref={conteneur}
          data-testid="barre-repartition"
          role="group"
          aria-label="Répartition des décisions"
          className="flex h-12 items-center"
        >
          {repartition.map((ligne, i) => {
            const actif = ouvert?.statut === ligne.statut;
            const estompe = ouvert !== null && !actif;
            const zoom = actif && mouvement;
            const hauteur = zoom ? '3.5rem' : estompe ? '2.5rem' : '3rem';
            const arrondi = `${i === 0 ? 'rounded-l-xl ' : ''}${i === repartition.length - 1 ? 'rounded-r-xl' : ''}`;
            const court = etroit(ligne);
            return (
              <button
                key={ligne.statut}
                type="button"
                ref={(el) => {
                  if (el) segments.current.set(ligne.statut, el);
                  else segments.current.delete(ligne.statut);
                }}
                aria-label={nomAccessible(ligne)}
                aria-describedby={actif ? idBulle : undefined}
                tabIndex={court ? -1 : undefined}
                onMouseEnter={() => ouvrir(ligne.statut, 'segment')}
                onMouseLeave={fermerBientot}
                onFocus={() => ouvrir(ligne.statut, 'segment')}
                onBlur={fermerBientot}
                className={`${FONDS[ligne.statut]} ${arrondi} flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap px-1 text-sm font-semibold text-ink ${zoom ? 'shadow-segment' : ''}`}
                style={{
                  flex: `${Math.max(ligne.part, 0.5) + (zoom ? 3 : 0)} 1 0`,
                  height: hauteur,
                  filter: estompe ? 'saturate(0.45)' : 'none',
                  outline: actif && !mouvement ? '3px solid var(--color-paper)' : undefined,
                  outlineOffset: actif && !mouvement ? '0' : undefined,
                  transition: 'height var(--d-base) var(--ease-spring), flex-grow var(--d-base) var(--ease-spring), filter var(--d-base) var(--ease-out)',
                }}
              >
                {!court && <span>{`${LIBELLES_STATUT[ligne.statut]}\u00a0${ligne.part}\u00a0%`}</span>}
              </button>
            );
          })}
        </div>
        {ligneOuverte && (
          <BulleRepartition id={idBulle} ligne={ligneOuverte} gauche={gaucheBulle} onEntrer={annulerFermeture} onSortir={fermerBientot} />
        )}
      </div>
      {etroits.length > 0 && (
        <div data-testid="legende-repartition" className="mt-3 flex flex-wrap gap-2">
          {etroits.map((ligne) => (
            <button
              key={ligne.statut}
              type="button"
              onMouseEnter={() => ouvrir(ligne.statut, 'legende')}
              onMouseLeave={fermerBientot}
              onFocus={() => ouvrir(ligne.statut, 'legende')}
              onBlur={fermerBientot}
              onClick={() => ouvrir(ligne.statut, 'legende')}
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded border-2 bg-ink-2 px-3 text-sm text-paper ${FONDS_LEGENDE[ligne.statut]}`}
            >
              <span aria-hidden="true">{SYMBOLES[ligne.statut]}</span>
              <span>{`${LIBELLES_STATUT[ligne.statut]}\u00a0${ligne.part}\u00a0%`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BarreRepartition;
