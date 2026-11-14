import React from 'react';
import type { TypeAction } from '../lib/actions';
import { libelleType } from './Journal';

export interface CriteresHistorique {
  type: string;
  resultat: string;
  carte: string;
  execution: string;
}

export const CRITERES_VIDES: CriteresHistorique = { type: '', resultat: '', carte: '', execution: '' };

interface Props {
  criteres: CriteresHistorique;
  types: readonly TypeAction[];
  resultats: readonly string[];
  executions: readonly string[];
  onChange: (criteres: CriteresHistorique) => void;
}

const CHAMP = 'min-h-11 w-full rounded border border-muted bg-ink px-3 text-paper focus-visible:shadow-(--halo-focus)';

/** Filtres de l’historique (D-20, SC-018) : type, résultat, carte par texte, exécution ; combinés en ET. */
const FiltresHistorique: React.FC<Props> = ({ criteres, types, resultats, executions, onChange }) => {
  const maj = (champ: keyof CriteresHistorique, valeur: string): void => onChange({ ...criteres, [champ]: valeur });
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Filtres de l’historique">
      <label className="grid gap-1 text-sm">
        <span>Type</span>
        <select className={CHAMP} value={criteres.type} onChange={(e) => maj('type', e.target.value)}>
          <option value="">Tous</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {libelleType(t)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span>Résultat</span>
        <select className={CHAMP} value={criteres.resultat} onChange={(e) => maj('resultat', e.target.value)}>
          <option value="">Tous</option>
          {resultats.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span>Carte</span>
        <input type="search" className={CHAMP} value={criteres.carte} onChange={(e) => maj('carte', e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Exécution</span>
        <select className={CHAMP} value={criteres.execution} onChange={(e) => maj('execution', e.target.value)}>
          <option value="">Toutes</option>
          {executions.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default FiltresHistorique;
