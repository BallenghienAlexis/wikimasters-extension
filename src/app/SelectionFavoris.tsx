import React, { useMemo, useState } from 'react';
import type { Carte } from '../lib/collection';
import type { PropositionFavori } from '../lib/selectionFavoris';
import { CLASSE_ACTIF, CLASSE_BOUTON, NB, carteTexte } from './apercuLot';
import SectionRepliable from './SectionRepliable';

interface Props {
  propositions: readonly PropositionFavori[];
  decochees: ReadonlySet<string>;
  cartes: ReadonlyMap<string, Carte>;
  onBasculer: (cle: string) => void;
  /** Coche ou décoche d’un coup les lignes données (celles du filtre affiché). */
  onTout: (cles: readonly string[], cocher: boolean) => void;
}

type Filtre = 'toutes' | 'poses' | 'retraits' | 'regle' | 'choix';
const FILTRES: { id: Filtre; libelle: string; garde: (p: PropositionFavori) => boolean }[] = [
  { id: 'toutes', libelle: 'Toutes', garde: () => true },
  { id: 'poses', libelle: 'Mises en favori', garde: (p) => p.sens === 'pose' },
  { id: 'retraits', libelle: 'Retraits', garde: (p) => p.sens === 'retrait' },
  { id: 'regle', libelle: 'Par la règle', garde: (p) => p.origine === 'regle' },
  { id: 'choix', libelle: 'Votre choix', garde: (p) => p.origine === 'choix' },
];

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;

/** Résumé replié : « 12 mises en favori, 1 retrait · 3 décochées ». */
export function resumeFavoris(propositions: readonly PropositionFavori[], decochees: ReadonlySet<string>): string {
  const retenues = propositions.filter((p) => !decochees.has(p.cle));
  const poses = retenues.filter((p) => p.sens === 'pose').length;
  const retraits = retenues.length - poses;
  const base = `${pluriel(poses, 'mise en favori', 'mises en favori')}, ${pluriel(retraits, 'retrait', 'retraits')}`;
  const nbDecochees = propositions.length - retenues.length;
  return nbDecochees > 0 ? `${base} · ${pluriel(nbDecochees, 'décochée', 'décochées')}` : base;
}

/** Choix carte par carte des favoris du lot : le joueur décide avant « Lancer » (Alexis, 2026-11-17). */
const SelectionFavoris: React.FC<Props> = ({ propositions, decochees, cartes, onBasculer, onTout }) => {
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const garde = FILTRES.find((f) => f.id === filtre)!.garde;
  const visibles = useMemo(() => propositions.filter(garde), [propositions, garde]);
  if (propositions.length === 0) return null;
  const cles = visibles.map((p) => p.cle);
  return (
    <SectionRepliable id="choix-favoris" testId="choix-favoris" className="mt-4" titre="Favoris carte par carte" resume={resumeFavoris(propositions, decochees)}>
      <p className="text-sm text-muted">
        Décochez une carte pour ne pas lui appliquer le favori. Une mise en favori décochée est mémorisée comme « pas favori » (la règle ne la reproposera plus ; « Revenir aux règles » dans la Collection l’annule). Un retrait ou une mise en favori de votre choix décochés restent proposés au prochain lot.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer les favoris">
        {FILTRES.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtre === f.id}
            className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} ${filtre === f.id ? 'border-paper font-semibold' : 'border-muted'}`}
            onClick={() => setFiltre(f.id)}
          >
            {f.libelle}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`} onClick={() => onTout(cles, true)}>
          Tout cocher
        </button>
        <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`} onClick={() => onTout(cles, false)}>
          Tout décocher
        </button>
      </div>
      <ul aria-label="Favoris du lot" className="mt-2">
        {visibles.slice(0, 200).map((p) => (
          <li key={p.cle} className="border-b border-line py-1 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5" checked={!decochees.has(p.cle)} onChange={() => onBasculer(p.cle)} />
              <span className="min-w-0 break-words">
                {carteTexte(p.idCarte, cartes)}
                {NB}: {p.sens === 'pose' ? 'mise en favori' : `retrait du favori${p.nbActions > 1 ? ` (${p.nbActions} exemplaires)` : ''}`}{' '}
                <span className="text-muted">· {p.origine === 'regle' ? 'thème gardé' : 'votre choix'}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {visibles.length > 200 && <p className="text-sm text-muted">… et {visibles.length - 200} autres (utilisez les filtres).</p>}
      {visibles.length === 0 && <p className="text-sm text-muted">Aucune carte pour ce filtre.</p>}
    </SectionRepliable>
  );
};

export default SelectionFavoris;
