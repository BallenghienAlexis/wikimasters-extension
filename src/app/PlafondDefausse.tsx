import React, { useState } from 'react';
import { PLAFOND_DEFAUSSE_MAX, PLAFOND_DEFAUSSE_MIN, PLAFOND_VALEUR_DEFAUSSE } from '../config/prix';

interface Props {
  /** Plafond effectif (réglé ou par défaut). */
  plafond: number;
  /** Appelée avec un entier valide (1 à 20) uniquement. */
  onChange: (plafond: number) => void;
}

const NB = ' ';

/** Plafond de défausse réglable (Alexis, 2026-11-12) : une carte plus chère n’est jamais défaussée par l’extension. */
const PlafondDefausse: React.FC<Props> = ({ plafond, onChange }) => {
  const [saisie, setSaisie] = useState(String(plafond));
  const valeur = Number(saisie);
  const valide = saisie.trim() !== '' && Number.isInteger(valeur) && valeur >= PLAFOND_DEFAUSSE_MIN && valeur <= PLAFOND_DEFAUSSE_MAX;
  return (
    <section aria-labelledby="titre-plafond" className="mt-4 rounded border border-line bg-ink-2 p-4" data-testid="plafond-defausse">
      <h2 id="titre-plafond" className="font-semibold">
        Plafond de défausse
      </h2>
      <p className="mt-1 text-sm text-muted">
        Une carte dont la valeur marchande est inconnue ou supérieure à ce plafond n’est jamais défaussée, même décidée à la main.
        Valeur par défaut{NB}: {PLAFOND_VALEUR_DEFAUSSE}. Les cartes juste au-dessus du plafond sont proposées à la vente.
      </p>
      <label className="mt-3 flex flex-wrap items-center gap-3">
        <span>Plafond ({PLAFOND_DEFAUSSE_MIN} à {PLAFOND_DEFAUSSE_MAX})</span>
        <input
          type="number"
          inputMode="numeric"
          min={PLAFOND_DEFAUSSE_MIN}
          max={PLAFOND_DEFAUSSE_MAX}
          step={1}
          value={saisie}
          aria-invalid={!valide}
          aria-describedby="aide-plafond"
          className="min-h-11 w-24 rounded border border-line bg-ink px-3"
          onChange={(e) => {
            setSaisie(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isInteger(v) && v >= PLAFOND_DEFAUSSE_MIN && v <= PLAFOND_DEFAUSSE_MAX) onChange(v);
          }}
        />
      </label>
      <p id="aide-plafond" aria-live="polite" className="mt-2 text-sm">
        {!valide
          ? `Saisissez un entier de ${PLAFOND_DEFAUSSE_MIN} à ${PLAFOND_DEFAUSSE_MAX} : le plafond enregistré reste ${plafond}.`
          : valeur > PLAFOND_VALEUR_DEFAUSSE
            ? `Attention${NB}: au-dessus de ${PLAFOND_VALEUR_DEFAUSSE}, des cartes de valeur plus élevée seront défaussées définitivement.`
            : ''}
      </p>
    </section>
  );
};

export default PlafondDefausse;
