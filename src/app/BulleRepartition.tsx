import React from 'react';
import { LIBELLES_STATUT } from '../lib/collection';
import type { LigneRepartition } from '../lib/tableauDeBord';
import { useMouvement } from './useMouvement';

interface Props {
  id: string;
  ligne: LigneRepartition;
  /** Décalage gauche en pixels dans la barre. */
  gauche: number;
  onEntrer: () => void;
  onSortir: () => void;
}

const nombre = (n: number): string => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, '\u00a0');

/** Texte de la valeur estimée, partagé avec le nom accessible des segments. */
export const texteValeur = (valeur: number | null): string => (valeur === null ? 'inconnue' : nombre(valeur));
export const texteExemplaires = (n: number): string => `${nombre(n)} exemplaire${n > 1 ? 's' : ''}`;

/** Bulle de détail d’un segment (D-06) : exemplaires, part, valeur, 3 titres en texte seul. */
const BulleRepartition: React.FC<Props> = ({ id, ligne, gauche, onEntrer, onSortir }) => {
  const mouvement = useMouvement();
  return (
    <div
      id={id}
      role="tooltip"
      onMouseEnter={onEntrer}
      onMouseLeave={onSortir}
      className="absolute bottom-full z-10 w-72 max-w-full pb-2"
      style={{ left: gauche, transition: mouvement ? 'left var(--d-move) var(--ease-out)' : 'none' }}
    >
      <div className="rounded-lg border border-muted bg-ink-2 p-3 text-sm text-paper shadow-leve">
        <p className="font-semibold">{LIBELLES_STATUT[ligne.statut]}</p>
        <p>{`${texteExemplaires(ligne.exemplaires)}\u00a0· ${ligne.part}\u00a0%`}</p>
        <p>{`Valeur estimée\u00a0: ${texteValeur(ligne.valeur)}`}</p>
        <ul className="mt-1 list-disc pl-4">
          {ligne.exemples.map((titre, i) => (
            <li key={`${i}-${titre}`}>{titre}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BulleRepartition;
