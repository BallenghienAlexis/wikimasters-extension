import React from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type { Carte } from '../lib/collection';
import { fileDeVente, valeurDeCarte } from '../lib/tri';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink px-4';

interface Props {
  cartes: Carte[];
  onMiseEnVente: (id: string) => void;
  onTerminee: (id: string) => void;
}

const FileVente: React.FC<Props> = ({ cartes, onMiseEnVente, onTerminee }) => {
  const { enCours, placesLibres, prochaines, enAttente } = fileDeVente(cartes);
  if (enCours.length === 0 && prochaines.length === 0 && enAttente === 0) return null;

  return (
    <section aria-labelledby="titre-file-vente" className="mt-4 rounded border border-line bg-ink-2 p-4" data-testid="file-vente">
      <h2 id="titre-file-vente" className="font-semibold">
        Ventes : {enCours.length} en cours sur {CONFIG_PRIX.maxVentesSimultanees}, {placesLibres} place(s) libre(s)
      </h2>

      {enCours.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {enCours.map((carte) => (
            <li key={carte.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">En cours : {carte.titre}</span>
              <button type="button" className={CLASSE_BOUTON} onClick={() => onTerminee(carte.id)}>
                Enchère terminée
              </button>
            </li>
          ))}
        </ul>
      )}

      {prochaines.length > 0 && (
        <>
          <p className="mt-3 text-sm text-muted">À mettre aux enchères maintenant sur WikiMasters, de la plus chère à la moins chère :</p>
          <ul className="mt-2 grid gap-2">
            {prochaines.map((carte) => (
              <li key={carte.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  {carte.titre} · valeur {valeurDeCarte(carte)} · départ {carte.prixCible ?? 'à définir'}
                </span>
                <button type="button" className={CLASSE_BOUTON} onClick={() => onMiseEnVente(carte.id)}>
                  Je l’ai mise aux enchères
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {enAttente > 0 && <p className="mt-3 text-sm text-muted">{enAttente} carte(s) en attente d’une place libre.</p>}
    </section>
  );
};

export default FileVente;
