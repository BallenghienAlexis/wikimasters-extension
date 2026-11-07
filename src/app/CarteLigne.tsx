import React from 'react';
import {
  LIBELLES_STATUT,
  MAX_NOTE,
  STATUTS,
  estPrixValide,
  excedent,
  type Carte,
  type EditionCarte,
  type Statut,
} from '../lib/collection';
import { LIBELLES_THEMES, themesDeCarte } from '../lib/themes';

const CLASSE_CHAMP = 'min-h-11 w-full rounded border border-line bg-ink px-3';

const COULEUR_STATUT: Record<Statut, string> = {
  'a-trier': 'text-muted',
  garder: 'text-garder',
  echanger: 'text-echanger',
  vendre: 'text-vendre',
  'en-vente': 'text-vendre',
  defausser: 'text-defausser',
};

interface Props {
  carte: Carte;
  onEdition: (edition: EditionCarte) => void;
}

const CarteLigne: React.FC<Props> = ({ carte, onEdition }) => {
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
    // Un prix choisi à la main ne doit pas être remplacé par l'assistant.
    if (prix !== undefined && prix !== carte.prixCible) onEdition({ prixCible: prix, decidePar: 'moi' });
  };

  const validerValeur = (champ: HTMLInputElement): void => {
    const valeur = lireNombre(champ, carte.valeurMarchande);
    if (valeur !== undefined && valeur !== carte.valeurMarchande) onEdition({ valeurMarchande: valeur });
  };

  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,2fr)_10rem_7rem_7rem_minmax(0,1fr)] md:items-center">
      <div className="min-w-0">
        <p className="font-medium break-words">
          {carte.url ? (
            <a className="underline" href={carte.url} target="_blank" rel="noreferrer noopener">{carte.titre}</a>
          ) : (
            carte.titre
          )}
        </p>
        <p className="text-sm text-muted">
          {carte.rarete ? `${carte.rarete} · ` : ''}
          Quantité : {carte.quantite}
          {excedent(carte) > 0 ? ` · ${excedent(carte)} en double` : ''}
          {carte.favori ? ' · Favori, verrouillé sur le site' : ''}
        </p>
        <p className="text-sm text-muted break-words">
          {themesDeCarte(carte).map((theme) => LIBELLES_THEMES[theme]).join(', ')}
          {carte.ami ? ` · À échanger avec ${carte.ami}` : ''}
        </p>
      </div>
      <select
        aria-label={`Statut de ${carte.titre}`}
        className={`${CLASSE_CHAMP} ${COULEUR_STATUT[carte.statut]}`}
        value={carte.statut}
        onChange={(e) => onEdition({ statut: e.target.value as Statut, ami: null, decidePar: 'moi' })}
      >
        {STATUTS.map((s) => (
          <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
        ))}
      </select>
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
    </li>
  );
};

export default CarteLigne;
