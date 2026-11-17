import React, { useId, useMemo, useState } from 'react';
import { basculer, CLASSE_BOUTON } from './outilsReglages';
import { chercherThemes, couvertPar, enfantsDe, RACINES, selectionMinimale } from '../lib/arbreThemes';
import { LIBELLES_THEMES } from '../lib/themes';

/** Un choix hors catalogue (étiquette du site suivie par un ami). */
export interface ChoixSupplementaire {
  cle: string;
  libelle: string;
}

interface Props {
  /** Nom du jeu de choix, pour des étiquettes accessibles uniques (« Mon thème », « Thème de Léa »). */
  nom: string;
  selection: readonly string[];
  onChange: (selection: string[]) => void;
  /** Nombre de cartes par thème, affiché à côté du libellé (facultatif). */
  comptes?: Readonly<Record<string, number>>;
  supplementaires?: readonly ChoixSupplementaire[];
}

const libelle = (id: string): string => LIBELLES_THEMES[id] ?? id;

/**
 * Sélection de thèmes par famille, la même pour le joueur et pour ses amis : recherche, familles dépliables,
 * un thème parent coché couvre tous ses enfants (qui restent cochables seuls). Un thème peut figurer sous plusieurs familles.
 */
const ArbreThemes: React.FC<Props> = ({ nom, selection, onChange, comptes, supplementaires = [] }) => {
  const [requete, setRequete] = useState('');
  const [ouverts, setOuverts] = useState<ReadonlySet<string>>(new Set());
  const idRecherche = useId();
  const recherche = useMemo(() => chercherThemes(requete), [requete]);
  const catalogue = useMemo(() => selection.filter((s) => LIBELLES_THEMES[s] !== undefined), [selection]);
  const basculerOuvert = (id: string): void =>
    setOuverts((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const supp = supplementaires.filter((s) => requete.trim() === '' || s.libelle.toLowerCase().includes(requete.trim().toLowerCase().replace(/^#/, '')));

  const noeud = (id: string, chemin: string): React.ReactNode => {
    if (recherche && !recherche.visibles.has(id)) return null;
    const enfants = enfantsDe(id);
    const visiblesEnfants = recherche ? enfants.filter((e) => recherche.visibles.has(e)) : enfants;
    const deplie = recherche ? visiblesEnfants.length > 0 : ouverts.has(id);
    const couvert = couvertPar(id, selection);
    const coche = selection.includes(id) || couvert !== undefined;
    const n = comptes?.[id];
    const cle = `${chemin}/${id}`;
    return (
      <li key={cle}>
        <div className="flex min-h-11 items-center gap-1">
          {enfants.length > 0 ? (
            <button
              type="button"
              aria-expanded={deplie}
              aria-label={`${deplie ? 'Replier' : 'Déplier'} ${libelle(id)}`}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded"
              onClick={() => basculerOuvert(id)}
            >
              <span aria-hidden="true">{deplie ? '▾' : '▸'}</span>
            </button>
          ) : (
            <span aria-hidden="true" className="inline-block size-11 shrink-0" />
          )}
          <label className={`flex min-h-11 flex-1 items-center gap-2 ${recherche?.trouves.has(id) ? 'font-medium' : ''}`}>
            <input
              type="checkbox"
              aria-label={`${nom} : ${libelle(id)}`}
              checked={coche}
              disabled={couvert !== undefined}
              onChange={() => onChange(selectionMinimale(basculer([...selection], id)))}
            />
            <span className="break-words">
              {libelle(id)}
              {n !== undefined && <span className="text-muted"> ({n})</span>}
              {couvert !== undefined && <span className="text-muted"> · inclus dans {libelle(couvert)}</span>}
              {enfants.length > 0 && !deplie && <span className="text-muted"> · {enfants.length} sous-thèmes</span>}
            </span>
          </label>
        </div>
        {deplie && visiblesEnfants.length > 0 && (
          <ul className="ml-5 border-l border-line pl-2">{visiblesEnfants.map((e) => noeud(e, cle))}</ul>
        )}
      </li>
    );
  };

  const racines = RACINES.filter((r) => !recherche || recherche.visibles.has(r));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={idRecherche} className="sr-only">Rechercher un thème ({nom})</label>
        <input
          id={idRecherche}
          type="search"
          placeholder="Rechercher un thème…"
          className="min-h-11 min-w-0 flex-1 rounded border border-line bg-ink px-3"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
        />
        <button type="button" className={CLASSE_BOUTON} onClick={() => setOuverts(new Set(RACINES))}>Déplier les familles</button>
        <button type="button" className={CLASSE_BOUTON} onClick={() => setOuverts(new Set())}>Tout replier</button>
      </div>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {selection.length === 0 ? 'Aucun thème choisi.' : `${selection.length} thème${selection.length > 1 ? 's' : ''} choisi${selection.length > 1 ? 's' : ''}.`}
        {recherche ? ` ${recherche.trouves.size} résultat${recherche.trouves.size > 1 ? 's' : ''}.` : ''}
      </p>
      {selection.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Thèmes choisis (${nom})`}>
          {[...catalogue, ...selection.filter((s) => !catalogue.includes(s))].map((s) => (
            <li key={s}>
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded border border-line bg-ink-2 px-3 text-sm"
                aria-label={`Retirer ${LIBELLES_THEMES[s] ?? supplementaires.find((x) => x.cle === s)?.libelle ?? s}`}
                onClick={() => onChange(selection.filter((x) => x !== s))}
              >
                {LIBELLES_THEMES[s] ?? supplementaires.find((x) => x.cle === s)?.libelle ?? s} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 divide-y divide-line border-y border-line">{racines.map((r) => noeud(r, ''))}</ul>
      {racines.length === 0 && supp.length === 0 && <p className="mt-3 text-muted">Aucun thème ne correspond à cette recherche.</p>}
      {supp.length > 0 && (
        <fieldset className="mt-3">
          <legend className="font-medium">Étiquettes du site</legend>
          <ul>
            {supp.map((s) => (
              <li key={s.cle}>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`${nom} : ${s.libelle} (site)`}
                    checked={selection.includes(s.cle)}
                    onChange={() => onChange(basculer([...selection], s.cle))}
                  />
                  <span className="break-words">{s.libelle} <span className="text-muted">(site)</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </div>
  );
};

export default ArbreThemes;
