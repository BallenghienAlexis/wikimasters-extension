import React, { useId, useState } from 'react';
import {
  MAX_NOTE,
  estPrixValide,
  excedent,
  type Carte,
  type EditionCarte,
} from '../lib/collection';
import { LIBELLES_THEMES, themesDeCarte } from '../lib/themes';

const CLASSE_CHAMP = 'min-h-11 w-full rounded border border-line bg-ink px-3';

interface Props {
  carte: Carte;
  onEdition: (edition: EditionCarte) => void;
  /** Ref de la ligne, pour le FLIP du tri (T-315). */
  refLigne?: (el: HTMLElement | null) => void;
}

/** Étiquette visible seulement en cartes empilées (sous 600 px), où l’en-tête du tableau est masqué. */
const Etiquette: React.FC<{ texte: string }> = ({ texte }) => (
  <span className="block text-sm text-muted min-[600px]:hidden">{texte}</span>
);

const CELLULE = 'block px-3 py-1 min-[600px]:table-cell min-[600px]:align-top min-[600px]:py-3';

/** Ligne éditable du tableau de la Collection (T-308) : `tr` empilée sous 600 px. */
const CarteLigne: React.FC<Props> = ({ carte, onEdition, refLigne }) => {
  // Retourne undefined et rétablit le champ si le nombre saisi est invalide.
  const lireNombre = (champ: HTMLInputElement, actuel: number | null): number | null | undefined => {
    const texte = champ.value.trim();
    const nombre = texte === '' ? null : Number(texte);
    if (nombre !== null && !estPrixValide(nombre)) {
      champ.value = actuel === null ? '' : String(actuel);
      return undefined;
    }
    return nombre;
  };

  const validerPrix = (champ: HTMLInputElement): void => {
    const prix = lireNombre(champ, carte.prixCible);
    if (prix !== undefined && prix !== carte.prixCible) onEdition({ prixCible: prix });
  };

  const validerValeur = (champ: HTMLInputElement): void => {
    const valeur = lireNombre(champ, carte.valeurMarchande);
    if (valeur !== undefined && valeur !== carte.valeurMarchande) onEdition({ valeurMarchande: valeur });
  };

  const [ouvert, setOuvert] = useState(false);
  const idDetail = `detail-carte-${useId()}`;
  const themes = themesDeCarte(carte).map((theme) => LIBELLES_THEMES[theme]).join(', ');
  const complement = [
    excedent(carte) > 0 ? `${excedent(carte)} en double` : '',
    carte.favori ? 'Favori' : '',
  ].filter(Boolean).join(' · ');

  return (
    <>
      <tr
        ref={refLigne}
        data-testid="carte-ligne"
        className="block border-b border-line py-2 hover:bg-(--surface-survol) min-[600px]:table-row min-[600px]:py-0"
      >
        <td className={`${CELLULE} min-w-0 break-words`}>
          <p className="font-medium break-words">
            {carte.url ? (
              <a className="underline" href={carte.url} target="_blank" rel="noreferrer noopener">{carte.titre}</a>
            ) : (
              carte.titre
            )}
          </p>
          {complement !== '' && <p className="text-sm text-muted break-words">{complement}</p>}
        </td>
        <td className={CELLULE}>
          <Etiquette texte="Rareté" />
          {carte.rarete || '—'}
        </td>
        <td className={CELLULE}>
          <Etiquette texte="Quantité" />
          {carte.quantite}
        </td>
        <td className={CELLULE}>
          <Etiquette texte="Valeur marchande" />
          {carte.valeurMarchande ?? '—'}
        </td>
        <td className={CELLULE}>
          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls={idDetail}
            aria-label={`Détails de ${carte.titre}`}
            onClick={() => setOuvert((o) => !o)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line bg-ink-2 px-3 focus-visible:shadow-(--halo-focus)"
          >
            <span>Détails</span>
            <span aria-hidden="true" className="wm-chevron shrink-0" data-ouvert={ouvert}>▼</span>
          </button>
          <span className="ml-2 text-sm text-muted">{carte.prixCible === null ? '' : `Cible : ${carte.prixCible}`}</span>
        </td>
      </tr>
      {ouvert && (
        <tr id={idDetail} className="block border-b border-line min-[600px]:table-row">
          <td colSpan={5} className="block px-3 pb-3 min-[600px]:table-cell">
            <p className="text-sm text-muted break-words">
              {themes === '' ? 'Aucun thème' : themes}
              {carte.ami ? ` · À échanger avec ${carte.ami}` : ''}
              {carte.favori ? ' · Favori, verrouillé sur le site' : ''}
            </p>
            <div className="mt-2 grid gap-2 min-[600px]:grid-cols-3">
              <input
                key={`valeur-${carte.valeurMarchande}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label={`Valeur marchande de ${carte.titre}, en wikibidous`}
                placeholder="Valeur"
                className={CLASSE_CHAMP}
                defaultValue={carte.valeurMarchande ?? ''}
                onBlur={(e) => validerValeur(e.target)}
              />
              <input
                key={`prix-${carte.prixCible}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label={`Prix cible de ${carte.titre}, en wikibidous`}
                placeholder="Prix cible"
                className={CLASSE_CHAMP}
                defaultValue={carte.prixCible ?? ''}
                onBlur={(e) => validerPrix(e.target)}
              />
              <input
                type="text"
                maxLength={MAX_NOTE}
                aria-label={`Note sur ${carte.titre}`}
                placeholder="Note"
                className={CLASSE_CHAMP}
                defaultValue={carte.note}
                onBlur={(e) => {
                  if (e.target.value !== carte.note) onEdition({ note: e.target.value });
                }}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default CarteLigne;
