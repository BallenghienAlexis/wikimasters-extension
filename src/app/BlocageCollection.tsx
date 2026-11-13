import React, { useState } from 'react';
import { lireCollectionBrute, reinitialiserCollection } from '../lib/stockage';

interface Props {
  /** Cause lisible du blocage (collection illisible). */
  blocage: string;
  /** Appelé après une réinitialisation réussie : la page repart d’une collection vide. */
  onReinitialisee: () => void;
}

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';

function telecharger(contenu: string, nom: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Collection illisible (D-62) : encadré `role="alert"` au-dessus des onglets, avec le téléchargement des
 * données brutes et la réinitialisation sur confirmation. Les données ne sont jamais effacées sans accord.
 */
const BlocageCollection: React.FC<Props> = ({ blocage, onReinitialisee }) => {
  const [confirmerReinit, setConfirmerReinit] = useState(false);
  const [echecRecuperation, setEchecRecuperation] = useState<string | null>(null);

  return (
    <section className="mt-4 rounded border border-line border-l-[6px] border-l-defausser bg-ink-2 p-4">
      <p role="alert">
        <span aria-hidden="true">✕ </span>
        {blocage}
      </p>
      <p className="mt-2 text-muted">
        Vos données ne sont pas effacées. Si vous venez de mettre à jour l’extension, rechargez-la depuis le dossier <code>dist/</code> reconstruit. Sinon, sauvegardez d’abord le contenu, puis réinitialisez.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={CLASSE_BOUTON}
          onClick={() => {
            lireCollectionBrute()
              .then((brut) => telecharger(JSON.stringify(brut ?? null, null, 2), 'wm-collection-brute.json', 'application/json'))
              .catch(() => setEchecRecuperation('Téléchargement impossible.'));
          }}
        >
          Télécharger les données brutes
        </button>
        {confirmerReinit ? (
          <>
            <button
              type="button"
              className={CLASSE_BOUTON}
              autoFocus
              onClick={() => {
                reinitialiserCollection()
                  .then(onReinitialisee)
                  .catch(() => setEchecRecuperation('Réinitialisation impossible : rien n’a été effacé.'));
              }}
            >
              Oui, effacer la collection
            </button>
            <button type="button" className={CLASSE_BOUTON} onClick={() => setConfirmerReinit(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" className={CLASSE_BOUTON} onClick={() => setConfirmerReinit(true)}>
            Réinitialiser la collection
          </button>
        )}
      </div>
      {echecRecuperation && <p role="status" className="mt-3">{echecRecuperation}</p>}
    </section>
  );
};

export default BlocageCollection;
