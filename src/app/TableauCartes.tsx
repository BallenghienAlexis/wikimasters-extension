import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { LIBELLES_STATUT, type Carte, type EditionCarte } from '../lib/collection';
import { basculerTri, type SensTri, type ValeurTri } from '../lib/ordreTableau';
import CarteLigne from './CarteLigne';
import EnTeteTriable from './EnTeteTriable';
import { courbeToken, dureeToken, useMouvement } from './useMouvement';
import { useFlip } from './useFlip';

export type CleTri = 'titre' | 'rarete' | 'quantite' | 'statut' | 'valeur';
export interface EtatTri {
  cle: CleTri | null;
  sens: SensTri;
}

export const COLONNES: { cle: CleTri; libelle: string }[] = [
  { cle: 'titre', libelle: 'Titre' },
  { cle: 'rarete', libelle: 'Rareté' },
  { cle: 'quantite', libelle: 'Quantité' },
  { cle: 'statut', libelle: 'Statut' },
  { cle: 'valeur', libelle: 'Valeur' },
];

/** Valeur de tri d’une carte pour une colonne (une rareté vide ou une valeur inconnue passent en dernier). */
export function valeurDeTri(carte: Carte, cle: CleTri): ValeurTri {
  switch (cle) {
    case 'titre':
      return carte.titre;
    case 'rarete':
      return carte.rarete || null;
    case 'quantite':
      return carte.quantite;
    case 'statut':
      return LIBELLES_STATUT[carte.statut];
    case 'valeur':
      return carte.valeurMarchande;
  }
}

interface Props {
  /** Cartes déjà triées et limitées : exactement les lignes rendues. */
  cartes: readonly Carte[];
  tri: EtatTri;
  revision: number;
  /** Change quand les filtres changent (fondu des lignes). */
  cleFiltre: string;
  onTri: (tri: EtatTri) => void;
  onEdition: (id: string, edition: EditionCarte) => void;
}

const CLASSE_CHAMP = 'min-h-11 rounded border border-paper bg-ink px-3';

/** Tableau triable des cartes (D-16) ; sous 600 px, cartes empilées pilotées par « Trier par » et « Sens ». */
const TableauCartes: React.FC<Props> = ({ cartes, tri, revision, cleFiltre, onTri, onEdition }) => {
  const cles = useMemo(() => cartes.map((c) => c.id), [cartes]);
  const enregistrer = useFlip(cles);
  const mouvement = useMouvement();
  const corps = useRef<HTMLTableSectionElement>(null);
  const premierRendu = useRef(true);

  // Un filtre retire/ajoute des lignes : fondu du corps du tableau, sans saut de hauteur.
  useLayoutEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const duree = dureeToken('--d-base');
    const courbe = courbeToken('--ease-out');
    if (!mouvement || duree === null || courbe === null || typeof corps.current?.animate !== 'function') return;
    corps.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duree, easing: courbe });
  }, [cleFiltre, mouvement]);

  const basculer = (cle: CleTri): void => {
    if (tri.cle !== cle) return onTri({ cle, sens: 'croissant' });
    const suivant = basculerTri(tri.sens);
    onTri(suivant === null ? { cle: null, sens: null } : { cle, sens: suivant });
  };

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 min-[600px]:hidden">
        <label className="flex items-center gap-2">
          <span>Trier par</span>
          <select
            className={CLASSE_CHAMP}
            value={tri.cle ?? ''}
            onChange={(e) => {
              const cle = e.target.value as CleTri | '';
              onTri(cle === '' ? { cle: null, sens: null } : { cle, sens: tri.sens ?? 'croissant' });
            }}
          >
            <option value="">Aucun tri</option>
            {COLONNES.map((c) => (
              <option key={c.cle} value={c.cle}>{c.libelle}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={tri.sens === 'decroissant'}
          aria-disabled={tri.cle === null}
          onClick={() => {
            if (tri.cle !== null) onTri({ cle: tri.cle, sens: tri.sens === 'decroissant' ? 'croissant' : 'decroissant' });
          }}
          className={`${CLASSE_CHAMP} inline-flex cursor-pointer items-center gap-2 ${tri.sens === 'decroissant' ? 'bg-ink-2 font-bold' : ''}`}
        >
          <span>Sens</span>
          <span aria-hidden="true">{tri.sens === 'decroissant' ? '▼' : '▲'}</span>
        </button>
      </div>

      <div className="mt-4 min-[600px]:overflow-x-auto">
        <table data-testid="tableau-cartes" className="block w-full border-y border-line min-[600px]:table">
          <caption className="sr-only">Cartes de la collection, triables par colonne</caption>
          <colgroup className="hidden min-[600px]:table-column-group">
            <col />
            <col className="w-28" />
            <col className="w-26" />
            <col className="w-32" />
            <col className="w-26" />
            <col className="w-40" />
          </colgroup>
          <thead className="hidden min-[600px]:table-header-group">
            <tr className="border-b border-line">
              {COLONNES.map((c) => (
                <EnTeteTriable key={c.cle} colonne={c} etat={tri.cle === c.cle ? tri.sens : null} onBasculer={() => basculer(c.cle)} />
              ))}
              <th scope="col" className="px-3 text-left font-normal">Prix cible et note</th>
            </tr>
          </thead>
          <tbody ref={corps} className="block min-[600px]:table-row-group">
            {cartes.map((carte) => (
              <CarteLigne
                key={`${carte.id}-${revision}`}
                carte={carte}
                refLigne={enregistrer(carte.id)}
                onEdition={(edition) => onEdition(carte.id, edition)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default TableauCartes;
