import React from 'react';
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

  return (
    <tr
      ref={refLigne}
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
        <p className="text-sm text-muted break-words">
          {themesDeCarte(carte).map((theme) => LIBELLES_THEMES[theme]).join(', ')}
          {carte.ami ? ` · À échanger avec ${carte.ami}` : ''}
          {excedent(carte) > 0 ? ` · ${excedent(carte)} en double` : ''}
          {carte.favori ? ' · Favori, verrouillé sur le site' : ''}
        </p>
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
      </td>
      <td className={`${CELLULE} space-y-2`}>
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
      </td>
    </tr>
  );
};

export default CarteLigne;
