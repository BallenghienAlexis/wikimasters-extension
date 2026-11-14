import React, { useState } from 'react';
import type { FamilleLot } from '../lib/actions';
import { basculerTri, trierLignes, type SensTri, type ValeurTri } from '../lib/ordreTableau';
import { libelleFamille } from './apercuLot';
import EnTeteTriable from './EnTeteTriable';
import { useFlip } from './useFlip';

export interface LigneLot {
  famille: FamilleLot;
  nbActions: number;
  /** Rang d’application dans `lot.ts` (1 = premier). */
  ordre: number;
}

type Cle = 'famille' | 'actions';
const COLONNES: { cle: Cle; libelle: string }[] = [
  { cle: 'famille', libelle: 'Famille' },
  { cle: 'actions', libelle: 'Actions' },
];
const VALEUR_TRI: Record<Cle, (l: LigneLot) => ValeurTri> = {
  famille: (l) => libelleFamille(l.famille),
  actions: (l) => l.nbActions,
};

const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3 focus-visible:shadow-(--halo-focus)';
const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink px-4 focus-visible:shadow-(--halo-focus)';

interface Props {
  lots: readonly LigneLot[];
  cochees: ReadonlySet<FamilleLot>;
  onBasculer: (famille: FamilleLot) => void;
}

/** Case de 44 px : l’entrée native, transparente, couvre la case dessinée. */
const Case: React.FC<{ ligne: LigneLot; coche: boolean; onBasculer: () => void }> = ({ ligne, coche, onBasculer }) => (
  <span className="relative inline-flex size-11 items-center justify-center">
    <input
      type="checkbox"
      checked={coche}
      onChange={onBasculer}
      aria-label={`Inclure le lot ${libelleFamille(ligne.famille)}`}
      className="peer absolute inset-0 size-11 cursor-pointer opacity-0"
    />
    <span
      aria-hidden="true"
      className="flex size-6 items-center justify-center rounded border-2 border-paper text-sm font-bold text-ink peer-checked:bg-paper peer-focus-visible:shadow-(--halo-focus)"
    >
      <span className={coche ? '' : 'invisible'}>✓</span>
    </span>
  </span>
);

/** Tableau des lots cochables (D-09, D-16) ; sous 600 px, cartes empilées. Le tri n’affecte que l’affichage. */
const TableauLots: React.FC<Props> = ({ lots, cochees, onBasculer }) => {
  const [tri, setTri] = useState<{ cle: Cle | null; sens: SensTri }>({ cle: null, sens: null });
  const lignes = tri.cle === null ? [...lots] : trierLignes(lots, VALEUR_TRI[tri.cle], tri.sens);
  const flip = useFlip(lignes.flatMap((l) => [`t:${l.famille}`, `c:${l.famille}`]));
  const basculer = (cle: Cle): void =>
    setTri((t) => {
      if (t.cle !== cle) return { cle, sens: 'croissant' };
      const sens = basculerTri(t.sens);
      return { cle: sens === null ? null : cle, sens };
    });
  const etat = (cle: Cle): SensTri => (tri.cle === cle ? tri.sens : null);

  return (
    <section aria-label="Lots" className="mt-3" data-testid="tableau-lots">
      <div className="flex flex-wrap items-center gap-2 min-[600px]:hidden">
        <label className="flex items-center gap-2">
          <span>Trier par</span>
          <select
            className={CLASSE_CHAMP}
            value={tri.cle ?? ''}
            onChange={(e) => {
              const cle = e.target.value as Cle | '';
              setTri(cle === '' ? { cle: null, sens: null } : { cle, sens: 'croissant' });
            }}
          >
            <option value="">Ordre du lot (défaut)</option>
            {COLONNES.map((c) => (
              <option key={c.cle} value={c.cle}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={CLASSE_BOUTON}
          aria-pressed={tri.sens === 'croissant'}
          disabled={tri.cle === null}
          onClick={() => setTri((t) => ({ ...t, sens: t.sens === 'croissant' ? 'decroissant' : 'croissant' }))}
        >
          Sens <span aria-hidden="true">{tri.sens === 'croissant' ? '▲' : tri.sens === 'decroissant' ? '▼' : ''}</span>
        </button>
      </div>

      <div className="hidden overflow-x-auto min-[600px]:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-11 p-0">
                <span className="sr-only">Inclure</span>
              </th>
              {COLONNES.map((c) => (
                <EnTeteTriable key={c.cle} colonne={c} etat={etat(c.cle)} onBasculer={() => basculer(c.cle)} />
              ))}
              <th scope="col" className="px-3 font-normal">
                Ordre
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.famille} ref={flip(`t:${l.famille}`)} className="border-b border-line" data-testid="ligne-lot" data-famille={l.famille}>
                <td className="p-0">
                  <Case ligne={l} coche={cochees.has(l.famille)} onBasculer={() => onBasculer(l.famille)} />
                </td>
                <td className="px-3 py-2" data-testid="famille-lot">{libelleFamille(l.famille)}</td>
                <td className="px-3 py-2" data-testid="nb-actions-lot">{l.nbActions}</td>
                <td className="px-3 py-2" data-testid="ordre-lot">{l.ordre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-2 grid gap-2 min-[600px]:hidden">
        {lignes.map((l) => (
          <li
            key={l.famille}
            ref={flip(`c:${l.famille}`)}
            className="flex items-center gap-3 rounded border border-line bg-ink p-1 pr-3"
            data-testid="ligne-lot"
            data-famille={l.famille}
          >
            <Case ligne={l} coche={cochees.has(l.famille)} onBasculer={() => onBasculer(l.famille)} />
            <div className="grid min-w-0 gap-0.5">
              <span className="font-semibold" data-testid="famille-lot">{libelleFamille(l.famille)}</span>
              <span className="text-sm">
                <span className="text-muted">Actions : </span>
                <span data-testid="nb-actions-lot">{l.nbActions}</span>
                <span className="text-muted"> · Ordre : </span>
                <span data-testid="ordre-lot">{l.ordre}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default TableauLots;
