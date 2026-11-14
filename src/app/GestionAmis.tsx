import React, { useState } from 'react';
import { IDS_THEMES, LIBELLES_THEMES } from '../lib/themes';
import type { Preferences } from '../lib/tri';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';
const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3';

const basculer = (liste: string[], valeur: string): string[] =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

interface Props {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
}

/** Amis et thèmes qu’ils aiment : les cartes dont un thème correspond reçoivent « #À échanger <nom> » au prochain lot. */
const GestionAmis: React.FC<Props> = ({ preferences, onChange }) => {
  const [nomAmi, setNomAmi] = useState('');

  const ajouterAmi = (): void => {
    const nom = nomAmi.trim();
    if (!nom || preferences.amis.some((a) => a.nom === nom)) return;
    onChange({ ...preferences, amis: [...preferences.amis, { nom, themes: [] }] });
    setNomAmi('');
  };

  return (
    <div className="py-2">
      <p className="text-sm">
        Ajoutez vos amis et les thèmes qu’ils aiment : les cartes concernées (hors favoris) reçoivent l’étiquette « #À échanger » à leur nom.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          aria-label="Nom de l’ami"
          placeholder="Nom de l’ami"
          maxLength={100}
          className={CLASSE_CHAMP}
          value={nomAmi}
          onChange={(e) => setNomAmi(e.target.value)}
        />
        <button type="button" className={CLASSE_BOUTON} onClick={ajouterAmi}>Ajouter cet ami</button>
      </div>
      {preferences.amis.length === 0 && <p className="mt-4 text-muted">Aucun ami pour l’instant.</p>}
      <ul className="mt-4 grid gap-4">
        {preferences.amis.map((ami) => (
          <li key={ami.nom} className="rounded border border-line p-3">
            <fieldset>
              <legend className="font-medium break-words">Ce qu’aime {ami.nom}</legend>
              <div className="mt-2 flex flex-wrap gap-x-4">
                {IDS_THEMES.map((theme) => (
                  <label key={theme} className="inline-flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ami.themes.includes(theme)}
                      onChange={() =>
                        onChange({
                          ...preferences,
                          amis: preferences.amis.map((a) => (a.nom === ami.nom ? { ...a, themes: basculer(a.themes, theme) } : a)),
                        })
                      }
                    />
                    {LIBELLES_THEMES[theme]}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className={`${CLASSE_BOUTON} mt-2`}
              onClick={() => onChange({ ...preferences, amis: preferences.amis.filter((a) => a.nom !== ami.nom) })}
            >
              Retirer {ami.nom}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GestionAmis;
