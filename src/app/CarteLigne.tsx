import React, { useState } from 'react';
import {
  MAX_NOTE,
  estPrixValide,
  estFavori,
  excedent,
  type Carte,
  type EditionCarte,
} from '../lib/collection';
import { themesPrincipaux } from '../lib/themes';
import { tagsDeCarte } from '../lib/tagsCarte';
import EditeurThemes from './EditeurThemes';

const CLASSE_CHAMP = 'min-h-11 w-full rounded border border-line bg-ink px-3';
const CLASSE_PETIT_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-3 text-sm';

interface Props {
  carte: Carte;
  /** Rappel stable (le même à chaque rendu) : la ligne n’est refaite que si sa carte change. */
  onEdition: (id: string, edition: EditionCarte) => void;
  /** Change quand les thèmes lus (Wikipédia, IA) changent : seule raison de refaire une ligne dont la carte est la même. */
  versionThemes?: unknown;
  /** Verdict des règles courantes (gardée ou proposée, avec le motif), recalculé à chaque rendu de la liste. */
  verdict?: string;
  /** Ref de la ligne, pour le FLIP du tri (T-315). */
  refLigne?: (el: HTMLElement | null) => void;
}

/** Étiquette visible seulement en cartes empilées (sous 600 px), où l’en-tête du tableau est masqué. */
const Etiquette: React.FC<{ texte: string }> = ({ texte }) => (
  <span className="block text-sm text-muted min-[600px]:hidden">{texte}</span>
);

const CELLULE = 'block px-3 py-1 min-[600px]:table-cell min-[600px]:align-top min-[600px]:py-3';

/** Ligne éditable du tableau de la Collection (T-308) : `tr` empilée sous 600 px. */
const CarteLigne: React.FC<Props> = ({ carte, onEdition: onEditionCarte, refLigne, verdict }) => {
  const onEdition = (edition: EditionCarte): void => onEditionCarte(carte.id, edition);
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

  const [themesOuverts, setThemesOuverts] = useState(false);
  const favori = estFavori(carte);
  const choix = carte.choixFavori ?? null;
  // Choix pas encore envoyé au site : il le sera par le lot « Favoris » (« Lancer »).
  const enAttente = choix !== null && choix !== carte.favori;

  const validerPrix = (champ: HTMLInputElement): void => {
    const prix = lireNombre(champ, carte.prixCible);
    if (prix !== undefined && prix !== carte.prixCible) onEdition({ prixCible: prix });
  };

  const validerValeur = (champ: HTMLInputElement): void => {
    const valeur = lireNombre(champ, carte.valeurMarchande);
    if (valeur !== undefined && valeur !== carte.valeurMarchande) onEdition({ valeurMarchande: valeur });
  };

  const tags = tagsDeCarte(carte);
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
          {tags.poses.length > 0 ? tags.poses.join(', ') : tags.aPoser.join(', ') || 'Sans thème fiable'}
          {tags.poses.length > 0 && tags.aPoser.length > 0 ? ` · Prévu, pas encore posé sur le site : ${tags.aPoser.join(', ')}` : ''}
          {tags.poses.length === 0 && tags.aPoser.length > 0 ? ' · Prévus, pas encore posés' : ''}
          {carte.ami ? ` · À échanger avec ${carte.ami}` : ''}
          {excedent(carte) > 0 ? ` · ${excedent(carte)} en double` : ''}
          {favori ? ' · Favori, verrouillé sur le site' : ''}
          {carte.themesChoisis ? ' · Thèmes choisis par vous' : ''}
        </p>
        {verdict && (
          <p className="text-sm break-words" data-testid="verdict-ligne">
            {verdict}
          </p>
        )}
        <button type="button" className={`${CLASSE_PETIT_BOUTON} mt-1`} onClick={() => setThemesOuverts(true)} aria-label={`Modifier les thèmes de ${carte.titre}`}>
          Modifier les thèmes
        </button>
        {themesOuverts && (
          <EditeurThemes
            titre={carte.titre}
            choisis={carte.themesChoisis ?? null}
            automatiques={themesPrincipaux({ titre: carte.titre, description: carte.description })}
            onValider={(themes) => onEdition({ themesChoisis: themes })}
            onFermer={() => setThemesOuverts(false)}
          />
        )}
      </td>
      <td className={CELLULE}>
        <Etiquette texte="Favori" />
        <button
          type="button"
          aria-pressed={favori}
          aria-label={favori ? `Retirer ${carte.titre} des favoris` : `Mettre ${carte.titre} en favori`}
          title={favori ? 'Retirer des favoris' : 'Mettre en favori'}
          onClick={() => onEdition({ choixFavori: !favori })}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded text-2xl focus-visible:shadow-(--halo-focus)"
        >
          <span aria-hidden="true">{favori ? '★' : '☆'}</span>
        </button>
        {enAttente && <span className="block text-sm text-muted">À envoyer au site (lot Favoris)</span>}
        {choix !== null && (
          <button type="button" aria-label={`Revenir aux règles pour ${carte.titre}`} className="flex min-h-11 cursor-pointer items-center text-sm underline" onClick={() => onEdition({ choixFavori: null })}>
            Revenir aux règles
          </button>
        )}
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

// Le comparateur par défaut suffit : carte, rappels et version des thèmes sont stables entre deux rendus sans changement.
export default React.memo(CarteLigne);
