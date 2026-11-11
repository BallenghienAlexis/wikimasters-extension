import React, { useMemo, useState } from 'react';
import { LIBELLES_STATUT, STATUTS, type Collection } from '../lib/collection';
import { IDS_THEMES, LIBELLES_THEMES, compterThemes, themesDeCarte } from '../lib/themes';
import { apercuTri, themesAimesDesFavoris, type Preferences } from '../lib/tri';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';
const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3';
const ETAPES = ['Mes thèmes', 'Mes amis', 'Vérification'];

const basculer = (liste: string[], valeur: string): string[] =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

interface Props {
  collection: Collection;
  preferencesInitiales: Preferences;
  onAppliquer: (preferences: Preferences) => void;
  onFermer: () => void;
}

const AssistantTri: React.FC<Props> = ({ collection, preferencesInitiales, onAppliquer, onFermer }) => {
  const [etape, setEtape] = useState(0);
  const [preferences, setPreferences] = useState(preferencesInitiales);
  const [nomAmi, setNomAmi] = useState('');

  const comptes = useMemo(() => compterThemes(collection.cartes), [collection.cartes]);
  const exemples = useMemo(() => {
    const parTheme: Record<string, string[]> = {};
    for (const carte of collection.cartes) {
      for (const theme of themesDeCarte(carte)) {
        const liste = (parTheme[theme] ??= []);
        if (liste.length < 3) liste.push(carte.titre);
      }
    }
    return parTheme;
  }, [collection.cartes]);
  const aimesDesFavoris = useMemo(() => themesAimesDesFavoris(collection.cartes), [collection.cartes]);
  const themesPresents = IDS_THEMES.filter((id) => (comptes[id] ?? 0) > 0);
  const apercu = useMemo(() => (etape === 2 ? apercuTri(collection, preferences) : null), [collection, preferences, etape]);

  const ajouterAmi = (): void => {
    const nom = nomAmi.trim();
    if (!nom || preferences.amis.some((a) => a.nom === nom)) return;
    setPreferences({ ...preferences, amis: [...preferences.amis, { nom, themes: [] }] });
    setNomAmi('');
  };

  const basculerThemeAmi = (nom: string, theme: string): void =>
    setPreferences({
      ...preferences,
      amis: preferences.amis.map((a) => (a.nom === nom ? { ...a, themes: basculer(a.themes, theme) } : a)),
    });

  return (
    <section aria-labelledby="titre-assistant" className="mt-4">
      <h2 id="titre-assistant" className="text-xl font-semibold">
        Assistant de tri, étape {etape + 1} sur {ETAPES.length} : {ETAPES[etape]}
      </h2>

      {etape === 0 && (
        <fieldset className="mt-4">
          <legend>Quels thèmes vous intéressent ? Les cartes de ces thèmes seront gardées. Vous pourrez revenir ici à tout moment.</legend>
          {aimesDesFavoris.length > 0 && (
            <div className="mt-4 rounded border border-line p-3">
              <p>
                Vos cartes favorites évoquent : {aimesDesFavoris.slice(0, 8).map((a) => `${LIBELLES_THEMES[a.theme]} (${a.nombre})`).join(', ')}.
              </p>
              <button
                type="button"
                className={`${CLASSE_BOUTON} mt-2`}
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    mesThemes: [...new Set([...preferences.mesThemes, ...aimesDesFavoris.map((a) => a.theme)])],
                  })
                }
              >
                Cocher les thèmes de mes favoris
              </button>
            </div>
          )}
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {themesPresents.map((theme) => (
              <li key={theme} className="py-2">
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Mon thème : ${LIBELLES_THEMES[theme]}`}
                    checked={preferences.mesThemes.includes(theme)}
                    onChange={() => setPreferences({ ...preferences, mesThemes: basculer(preferences.mesThemes, theme) })}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{LIBELLES_THEMES[theme]} ({comptes[theme]} cartes)</span>
                    <span className="block text-sm text-muted break-words">Par exemple : {exemples[theme]?.join(', ')}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {etape === 1 && (
        <div className="mt-4">
          <p>Ajoutez vos amis et leurs thèmes préférés : les cartes qui ne vous intéressent pas leur seront proposées en échange.</p>
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
          {preferences.amis.length === 0 && <p className="mt-4 text-muted">Aucun ami pour l’instant : vous pouvez passer cette étape.</p>}
          <ul className="mt-4 grid gap-4">
            {preferences.amis.map((ami) => (
              <li key={ami.nom} className="rounded border border-line p-3">
                <fieldset>
                  <legend className="font-medium break-words">Ce qu’aime {ami.nom}</legend>
                  <div className="mt-2 flex flex-wrap gap-x-4">
                    {IDS_THEMES.map((theme) => (
                      <label key={theme} className="inline-flex min-h-11 items-center gap-2">
                        <input type="checkbox" checked={ami.themes.includes(theme)} onChange={() => basculerThemeAmi(ami.nom, theme)} />
                        {LIBELLES_THEMES[theme]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  className={`${CLASSE_BOUTON} mt-2`}
                  onClick={() => setPreferences({ ...preferences, amis: preferences.amis.filter((a) => a.nom !== ami.nom) })}
                >
                  Retirer {ami.nom}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {etape === 2 && apercu && (
        <div className="mt-4">
          <p>Voici le tri proposé. Rien n’est fait sur WikiMasters : vous agirez vous-même. Vos choix faits à la main et vos favoris sont conservés.</p>
          <ul className="mt-4 grid gap-3" data-testid="apercu">
            {STATUTS.filter((s) => !['a-trier', 'en-vente'].includes(s) || apercu[s].nombre > 0).map((statut) => (
              <li key={statut} className="rounded border border-line p-3">
                <p className="font-medium">{LIBELLES_STATUT[statut]} : {apercu[statut].nombre}</p>
                {statut === 'a-trier' && (
                  <p className="text-sm">Valeur marchande inconnue : ouvrez « Mettre aux enchères » sur la carte pour qu’elle soit relevée, ou saisissez-la ici.</p>
                )}
                {apercu[statut].exemples.length > 0 && <p className="text-sm text-muted break-words">{apercu[statut].exemples.join(', ')}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {etape > 0 && <button type="button" className={CLASSE_BOUTON} onClick={() => setEtape(etape - 1)}>Précédent</button>}
        {etape < ETAPES.length - 1 ? (
          <button type="button" className={CLASSE_BOUTON} onClick={() => setEtape(etape + 1)}>Suivant</button>
        ) : (
          <button type="button" className={CLASSE_BOUTON} onClick={() => onAppliquer(preferences)}>Appliquer ce tri</button>
        )}
        <button type="button" className={CLASSE_BOUTON} onClick={onFermer}>Fermer</button>
      </div>
    </section>
  );
};

export default AssistantTri;
