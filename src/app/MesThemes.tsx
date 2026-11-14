import React, { useMemo } from 'react';
import type { Carte } from '../lib/collection';
import { IDS_THEMES, LIBELLES_THEMES, THEME_AUTRES, themesDeCarte } from '../lib/themes';
import { themesAimesDesFavoris, type Preferences } from '../lib/tri';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';

interface Props {
  cartes: readonly Carte[];
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
}

const basculer = (liste: string[], valeur: string): string[] =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

/** Mes thèmes aimés : choix des thèmes qui vous intéressent, avec ceux déduits de vos favoris. */
const MesThemes: React.FC<Props> = ({ cartes, preferences, onChange }) => {
  const comptes = useMemo(() => {
    const c: Record<string, number> = {};
    for (const carte of cartes) for (const t of themesDeCarte(carte)) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [cartes]);
  const aimesDesFavoris = useMemo(() => themesAimesDesFavoris(cartes), [cartes]);
  const presents = IDS_THEMES.filter((id) => id !== THEME_AUTRES && ((comptes[id] ?? 0) > 0 || preferences.mesThemes.includes(id)));

  return (
    <div className="py-2">
      <p className="text-sm">Cochez les thèmes qui vous intéressent. Ils sont enregistrés dans vos préférences et repris dans la sauvegarde.</p>
      {aimesDesFavoris.length > 0 && (
        <div className="mt-3 rounded border border-line p-3">
          <p className="text-sm">
            Vos cartes favorites évoquent : {aimesDesFavoris.map((a) => `${LIBELLES_THEMES[a.theme] ?? a.theme} (${a.nombre})`).join(', ')}.
          </p>
          <button
            type="button"
            className={`${CLASSE_BOUTON} mt-2`}
            onClick={() => onChange({ ...preferences, mesThemes: [...new Set([...preferences.mesThemes, ...aimesDesFavoris.map((a) => a.theme)])] })}
          >
            Cocher les thèmes de vos favoris
          </button>
        </div>
      )}
      {presents.length === 0 && <p className="mt-3 text-muted">Aucun thème pour l’instant : lisez d’abord la collection.</p>}
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {presents.map((theme) => (
          <li key={theme}>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                aria-label={`Mon thème : ${LIBELLES_THEMES[theme] ?? theme}`}
                checked={preferences.mesThemes.includes(theme)}
                onChange={() => onChange({ ...preferences, mesThemes: basculer(preferences.mesThemes, theme) })}
              />
              <span>{LIBELLES_THEMES[theme] ?? theme} ({comptes[theme] ?? 0} cartes)</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MesThemes;
