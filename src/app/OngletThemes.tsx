import React, { useMemo, useState } from 'react';
import ArbreThemes, { type ChoixSupplementaire } from './ArbreThemes';
import { CLASSE_BOUTON } from './outilsReglages';
import { cleEtiquetteSite, ETIQUETTE_A_CLASSER } from '../lib/lot';
import { selectionMinimale } from '../lib/arbreThemes';
import { LIBELLES_THEMES, themesDeCarte } from '../lib/themes';
import { themesAimesDesFavoris } from '../lib/tri';
import type { DonneesPage } from './useDonneesPage';

const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3';
const LIBELLES_EXTENSION = new Set(Object.values(LIBELLES_THEMES));
const MOI = '__moi__';

interface Props {
  donnees: DonneesPage;
}

/**
 * Onglet Thèmes : mes thèmes aimés et ceux de chaque ami, avec le même arbre de familles, la même recherche
 * et les mêmes gestes. Cocher une famille couvre ses sous-thèmes ; une carte ne reçoit que son thème le plus précis.
 */
const OngletThemes: React.FC<Props> = ({ donnees }) => {
  const { collection, preferences, etiquettesSite, enregistrerLesPreferences } = donnees;
  const [profil, setProfil] = useState<string>(MOI);
  const [nomAmi, setNomAmi] = useState('');
  const comptes = useMemo(() => {
    const c: Record<string, number> = {};
    for (const carte of collection.cartes) for (const t of themesDeCarte(carte)) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [collection.cartes]);
  const aimesDesFavoris = useMemo(() => themesAimesDesFavoris(collection.cartes), [collection.cartes]);
  const supplementaires: ChoixSupplementaire[] = useMemo(
    () =>
      (etiquettesSite ?? [])
        .filter((e) => !e.nom.startsWith('#À échanger ') && e.nom !== ETIQUETTE_A_CLASSER && !LIBELLES_EXTENSION.has(e.nom))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map((e) => ({ cle: cleEtiquetteSite(e.nom), libelle: e.nom })),
    [etiquettesSite],
  );
  const ami = preferences.amis.find((a) => a.nom === profil);
  const courant = profil === MOI || !ami ? MOI : profil;

  const ajouterAmi = (): void => {
    const nom = nomAmi.trim();
    if (!nom || preferences.amis.some((a) => a.nom === nom)) return;
    enregistrerLesPreferences({ ...preferences, amis: [...preferences.amis, { nom, themes: [] }] }, 'Enregistrement des amis impossible.');
    setNomAmi('');
    setProfil(nom);
  };

  return (
    <div className="mt-4">
      <p className="text-sm">
        Choisissez les thèmes qui vous intéressent, et ceux de vos amis : les cartes concernées (hors favoris) reçoivent l’étiquette « #À échanger » à leur nom.
        Cocher une famille (Alcool, Guerre…) couvre tous ses sous-thèmes.
      </p>
      <div role="group" aria-label="Choisir une personne" className="mt-3 flex flex-wrap gap-2">
        {[{ nom: MOI, etiquette: 'Moi' }, ...preferences.amis.map((a) => ({ nom: a.nom, etiquette: a.nom }))].map((p) => (
          <button
            key={p.nom}
            type="button"
            aria-pressed={courant === p.nom}
            className={`${CLASSE_BOUTON} ${courant === p.nom ? 'font-medium underline' : ''}`}
            onClick={() => setProfil(p.nom)}
          >
            {p.etiquette}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input type="text" aria-label="Nom de l’ami" placeholder="Nom de l’ami" maxLength={100} className={CLASSE_CHAMP} value={nomAmi} onChange={(e) => setNomAmi(e.target.value)} />
        <button type="button" className={CLASSE_BOUTON} onClick={ajouterAmi}>Ajouter cet ami</button>
      </div>

      <section className="mt-4 rounded border border-line p-3" aria-label={courant === MOI ? 'Mes thèmes' : `Ce qu’aime ${courant}`}>
        <h3 className="font-medium break-words">{courant === MOI ? 'Mes thèmes aimés' : `Ce qu’aime ${courant}`}</h3>
        {courant === MOI ? (
          <>
            {aimesDesFavoris.length > 0 && (
              <div className="mt-2">
                <p className="text-sm">Vos cartes favorites évoquent : {aimesDesFavoris.map((a) => `${LIBELLES_THEMES[a.theme] ?? a.theme} (${a.nombre})`).join(', ')}.</p>
                <button
                  type="button"
                  className={`${CLASSE_BOUTON} mt-2`}
                  onClick={() =>
                    enregistrerLesPreferences(
                      { ...preferences, mesThemes: selectionMinimale([...new Set([...preferences.mesThemes, ...aimesDesFavoris.map((a) => a.theme)])]) },
                      'Enregistrement des thèmes impossible.',
                    )
                  }
                >
                  Cocher les thèmes de vos favoris
                </button>
              </div>
            )}
            <div className="mt-3">
              <ArbreThemes
                nom="Mon thème"
                selection={preferences.mesThemes}
                comptes={comptes}
                onChange={(s) => enregistrerLesPreferences({ ...preferences, mesThemes: s }, 'Enregistrement des thèmes impossible.')}
              />
            </div>
          </>
        ) : (
          ami && (
            <>
              <div className="mt-3">
                <ArbreThemes
                  nom={`Thème de ${ami.nom}`}
                  selection={ami.themes}
                  comptes={comptes}
                  supplementaires={supplementaires}
                  onChange={(s) =>
                    enregistrerLesPreferences(
                      { ...preferences, amis: preferences.amis.map((a) => (a.nom === ami.nom ? { ...a, themes: s } : a)) },
                      'Enregistrement des amis impossible.',
                    )
                  }
                />
              </div>
              <button
                type="button"
                className={`${CLASSE_BOUTON} mt-3`}
                onClick={() => {
                  enregistrerLesPreferences({ ...preferences, amis: preferences.amis.filter((a) => a.nom !== ami.nom) }, 'Enregistrement des amis impossible.');
                  setProfil(MOI);
                }}
              >
                Retirer {ami.nom}
              </button>
            </>
          )
        )}
      </section>
    </div>
  );
};

export default OngletThemes;
