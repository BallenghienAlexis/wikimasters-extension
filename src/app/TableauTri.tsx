import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Carte } from '../lib/collection';
import { COLONNES_TRI, annonceDeplacement, repartirParColonne, type ColonneTri as Colonne } from '../lib/colonnesTri';
import ColonneTri, { CARTES_PAR_COLONNE } from './ColonneTri';
import { useFlip } from './useFlip';
import { useGlisser } from './useGlisser';

interface Props {
  /** Cartes visibles après la recherche et les filtres de l’onglet. */
  cartes: readonly Carte[];
  /** Applique `statut` + `decidePar` « moi » (écriture locale, aucune requête). */
  onDeplacer: (id: string, statut: Colonne) => void;
}

const REQUETE_ETROIT = '(max-width: 599.98px)';
const abonner = (rappel: () => void): (() => void) => {
  const liste = window.matchMedia(REQUETE_ETROIT);
  liste.addEventListener('change', rappel);
  return () => liste.removeEventListener('change', rappel);
};
const estEtroit = (): boolean => window.matchMedia(REQUETE_ETROIT).matches;

/**
 * Tableau de tri (T-312, D-15) : cinq colonnes, déplacement par flèches (voie principale) ou glisser-déposer.
 * Aucune requête réseau, aucune vérification Wikipédia. L’ordre dans une colonne n’est pas stocké.
 */
const TableauTri: React.FC<Props> = ({ cartes, onDeplacer }) => {
  const etroit = useSyncExternalStore(abonner, estEtroit, () => false);
  const { colonnes, enVente } = useMemo(() => repartirParColonne(cartes), [cartes]);
  const [limites, setLimites] = useState<Record<Colonne, number>>(() => ({
    garder: CARTES_PAR_COLONNE, echanger: CARTES_PAR_COLONNE, vendre: CARTES_PAR_COLONNE,
    defausser: CARTES_PAR_COLONNE, 'a-trier': CARTES_PAR_COLONNE,
  }));
  const [annonce, setAnnonce] = useState('');
  const racine = useRef<HTMLDivElement>(null);
  const focus = useRef<{ id: string; sens: 'gauche' | 'droite' } | null>(null);

  const titres = useMemo(() => new Map(cartes.map((c) => [c.id, c.titre])), [cartes]);
  const cles = useMemo(
    () => COLONNES_TRI.flatMap((s) => colonnes[s].slice(0, limites[s]).map((c) => c.id)),
    [colonnes, limites],
  );
  const refCarte = useFlip(cles);

  const deplacer = (id: string, vers: Colonne): void => {
    onDeplacer(id, vers);
    setAnnonce(annonceDeplacement(titres.get(id) ?? '', vers));
  };
  const { etat, proprietes } = useGlisser(deplacer);

  // Le focus suit la carte : elle change de parent, donc de nœud DOM.
  useEffect(() => {
    const f = focus.current;
    if (!f) return;
    focus.current = null;
    const carte = [...(racine.current?.querySelectorAll<HTMLElement>('[data-testid="carte-tri"]') ?? [])].find(
      (el) => el.dataset.id === f.id,
    );
    carte?.querySelector<HTMLElement>(`button[data-sens="${f.sens}"]`)?.focus();
  }, [colonnes]);

  return (
    <div className="mt-4">
      {enVente > 0 && (
        <p className="mb-3 text-sm text-muted" data-testid="tri-en-vente">
          {enVente} en vente, non déplaçables
        </p>
      )}
      <p className="sr-only" aria-live="polite" data-testid="tri-annonce">
        {annonce}
      </p>
      <div
        ref={racine}
        data-testid="tableau-tri"
        className="grid grid-cols-1 items-start gap-3 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-5"
      >
        {COLONNES_TRI.map((s) => (
          <ColonneTri
            key={s}
            statut={s}
            cartes={colonnes[s]}
            limite={limites[s]}
            cible={etat?.cible === s}
            etroit={etroit}
            glisserDe={proprietes}
            idEnGlisse={etat?.id ?? null}
            refCarte={refCarte}
            onDeplacer={(id, vers, sens) => {
              focus.current = { id, sens };
              deplacer(id, vers);
            }}
            onPlus={() => setLimites((l) => ({ ...l, [s]: l[s] + CARTES_PAR_COLONNE }))}
          />
        ))}
      </div>
    </div>
  );
};

export default TableauTri;
