import React from 'react';
import type { Filtres } from '../lib/collection';
import { IDS_THEMES, LIBELLES_THEMES } from '../lib/themes';

interface Props {
  filtres: Filtres;
  theme: string;
  onFiltres: (filtres: Filtres) => void;
  onTheme: (theme: string) => void;
}

const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3';

/** Recherche, thème et doublons de la liste (état remonté dans `App`, conservé au changement d’onglet). */
const FiltresCollection: React.FC<Props> = ({ filtres, theme, onFiltres, onTheme }) => (
  <div className="mt-4 flex flex-wrap items-center gap-3">
    <input
      type="search"
      aria-label="Rechercher une carte"
      placeholder="Rechercher une carte"
      className={`${CLASSE_CHAMP} w-full md:w-72`}
      value={filtres.recherche}
      onChange={(e) => onFiltres({ ...filtres, recherche: e.target.value })}
    />
    <select aria-label="Filtrer par thème" className={CLASSE_CHAMP} value={theme} onChange={(e) => onTheme(e.target.value)}>
      <option value="tous">Tous les thèmes</option>
      {IDS_THEMES.map((id) => (
        <option key={id} value={id}>{LIBELLES_THEMES[id]}</option>
      ))}
    </select>
    <label className="inline-flex min-h-11 items-center gap-2">
      <input
        type="checkbox"
        checked={filtres.doublonsSeulement}
        onChange={(e) => onFiltres({ ...filtres, doublonsSeulement: e.target.checked })}
      />
      Doublons seulement
    </label>
  </div>
);

export default FiltresCollection;
