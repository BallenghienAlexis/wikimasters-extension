import React from 'react';

export type EtapeLot = 1 | 2 | 3;

const ETAPES: readonly { n: EtapeLot; titre: string }[] = [
  { n: 1, titre: 'Choisir' },
  { n: 2, titre: 'Aperçu' },
  { n: 3, titre: 'Lancer' },
];

interface Props {
  courante: EtapeLot;
}

/** Fil d’étapes du parcours des lots : choisir les cartes, voir l’aperçu, lancer (affichage seul). */
const EtapesLots: React.FC<Props> = ({ courante }) => (
  <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Étapes du lot" data-testid="etapes-lots">
    {ETAPES.map((e) => {
      const active = e.n === courante;
      const faite = e.n < courante;
      return (
        <li key={e.n} aria-current={active ? 'step' : undefined} className={active ? 'font-semibold' : 'text-muted'}>
          <span aria-hidden="true">{faite ? '✓' : active ? '●' : '○'} </span>
          {e.n}. {e.titre}
          {faite && <span className="sr-only"> (faite)</span>}
        </li>
      );
    })}
  </ol>
);

export default EtapesLots;
