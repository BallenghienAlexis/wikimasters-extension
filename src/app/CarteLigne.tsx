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

const CLASSE_CHAMP = 'min-h-11 w-full rounded border border-line bg-ink px-3';

const COULEUR_STATUT: Record<Statut, string> = {
  'a-trier': 'text-muted',
  garder: 'text-garder',
  echanger: 'text-echanger',
  vendre: 'text-vendre',
};

interface Props {
  carte: Carte;
  onEdition: (edition: EditionCarte) => void;
}

const CarteLigne: React.FC<Props> = ({ carte, onEdition }) => {
  const validerPrix = (champ: HTMLInputElement): void => {
    const texte = champ.value.trim();
    const prix = texte === '' ? null : Number(texte);
    if (prix !== null && !estPrixValide(prix)) {
      champ.value = carte.prixCible === null ? '' : String(carte.prixCible);
      return;
    }
    if (prix !== carte.prixCible) onEdition({ prixCible: prix });
  };

  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,2fr)_10rem_8rem_minmax(0,2fr)] md:items-center">
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
        </p>
      </div>
      <select
        aria-label={`Statut de ${carte.titre}`}
        className={`${CLASSE_CHAMP} ${COULEUR_STATUT[carte.statut]}`}
        value={carte.statut}
        onChange={(e) => onEdition({ statut: e.target.value as Statut })}
      >
        {STATUTS.map((s) => (
          <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
        ))}
      </select>
      <input
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
