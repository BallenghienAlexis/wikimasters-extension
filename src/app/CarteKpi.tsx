import React from 'react';
import ChiffreAnime from './ChiffreAnime';

interface Props {
  libelle: string;
  /** Valeur numérique animée ; `null` : « — » (jamais NaN). */
  valeur: number | null;
  /** Texte après le chiffre (« / 5 »), décoratif pour le nom accessible. */
  suffixe?: string;
  /** Unité écrite à côté de la valeur (« exemplaires », « pièces »). */
  unite?: string;
  /** Sous-texte (cartes distinctes, part sans prix…). */
  detail: string;
}

/** Carte de chiffre clé compacte (D-01, D-61) : valeur de 24 px en gras, libellé, sous-texte. */
const CarteKpi: React.FC<Props> = ({ libelle, valeur, suffixe, unite, detail }) => (
  <div data-testid="kpi" className="rounded border border-line bg-ink-2 px-3 py-2 shadow-carte">
    <p className="text-sm font-semibold text-paper">{libelle}</p>
    <p className="text-2xl font-bold leading-tight text-paper">
      {valeur === null ? (
        <span>
          <span className="sr-only">{`${libelle}\u00a0: valeur inconnue`}</span>
          <span aria-hidden="true">—</span>
        </span>
      ) : (
        <ChiffreAnime valeur={valeur} libelle={libelle} />
      )}
      {suffixe && <span className="ml-1 text-2xl font-bold">{suffixe}</span>}
      {unite && <span className="ml-2 text-sm font-normal text-muted">{unite}</span>}
    </p>
    <p className="text-xs text-muted">{detail}</p>
  </div>
);

export default CarteKpi;
