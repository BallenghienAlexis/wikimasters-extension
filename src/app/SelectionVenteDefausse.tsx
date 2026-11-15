import React, { useMemo, useState } from 'react';
import { observations, type EvenementVente } from '../lib/affluence';
import { normaliser, type Carte } from '../lib/collection';
import { conseilLancement, estProposable, type Choix, type ChoixCarte } from '../lib/selectionLot';
import { NB, CLASSE_BOUTON } from './apercuLot';
import HeuresFortes from './HeuresFortes';

interface Props {
  cartes: readonly Carte[];
  choix: Choix;
  plafond: number;
  onChoisir: (idCarte: string, choix: ChoixCarte, exemplaires: number) => void;
  /** Pré-coche selon mes thèmes, mes amis et le plafond (explicite, jamais automatique). */
  onPrecocher: () => void;
  onVider: () => void;
  /** Évènements de vente (relevés du site et du joueur) pour les heures de plus forte influence. */
  ventes: readonly EvenementVente[];
}

const MAX_AFFICHEES = 30;
const MAX_CHOISIES = 50;

/** Choix manuel des cartes à mettre aux enchères ou à défausser, avant l’aperçu du lot (rien n’est envoyé ici). */
const SelectionVenteDefausse: React.FC<Props> = ({ cartes, choix, plafond, onChoisir, onPrecocher, onVider, ventes }) => {
  const [recherche, setRecherche] = useState('');
  const proposables = useMemo(() => cartes.filter(estProposable), [cartes]);
  const choisies = useMemo(() => proposables.filter((c) => (choix.get(c.id)?.choix ?? 'aucun') !== 'aucun'), [proposables, choix]);
  const trouvees = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (q === '') return [];
    return proposables.filter((c) => normaliser(c.titre).includes(q) && !choisies.includes(c));
  }, [proposables, recherche, choisies]);
  const nbVendre = choisies.filter((c) => choix.get(c.id)?.choix === 'vendre').length;
  const nbDefausser = choisies.length - nbVendre;

  const [maintenant] = useState(() => Date.now());
  const ligne = (c: Carte): React.ReactNode => {
    const x = choix.get(c.id) ?? { choix: 'aucun' as ChoixCarte, exemplaires: 1 };
    const defausseOk = c.valeurMarchande !== null && c.valeurMarchande <= plafond;
    const nom = `choix-${c.id}`;
    return (
      <li key={c.id} className="flex flex-col gap-2 border-b border-line py-2 md:flex-row md:items-center md:justify-between" data-testid="ligne-selection">
        <span className="break-words">
          {c.titre}
          <span className="text-muted">
            {NB}· {c.quantite} ex.{NB}· valeur {c.valeurMarchande ?? 'inconnue'}
          </span>
        </span>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Action pour {c.titre}</legend>
          {(['aucun', 'vendre', 'defausser'] as const).map((v) => (
            <label key={v} className="inline-flex min-h-11 items-center gap-1">
              <input
                type="radio"
                name={nom}
                checked={x.choix === v}
                disabled={v === 'defausser' && !defausseOk}
                onChange={() => onChoisir(c.id, v, x.exemplaires)}
              />
              {v === 'aucun' ? 'Rien' : v === 'vendre' ? 'Mettre aux enchères' : 'Défausser'}
            </label>
          ))}
          {x.choix === 'defausser' && c.quantite > 1 && (
            <label className="inline-flex items-center gap-1">
              Exemplaires{NB}:
              <input
                type="number"
                min={1}
                max={c.quantite}
                value={x.exemplaires}
                className={`${CLASSE_BOUTON} w-20 border-line`}
                onChange={(e) => onChoisir(c.id, 'defausser', Math.max(1, Math.min(c.quantite, Number(e.target.value) || 1)))}
              />
            </label>
          )}
          {x.choix === 'vendre' && <span className="text-sm text-muted">{conseilLancement(c.valeurMarchande, maintenant, ventes)}</span>}
          {!defausseOk && <span className="text-sm text-muted">défausse impossible : valeur inconnue ou au-dessus de {plafond}</span>}
        </fieldset>
      </li>
    );
  };

  return (
    <section aria-labelledby="titre-selection" className="mt-4 rounded border border-line bg-ink-2 p-4" data-testid="selection-vente-defausse">
      <h2 id="titre-selection" className="font-semibold">
        Cartes à mettre aux enchères ou à défausser
      </h2>
      <p className="mt-1 text-sm text-muted">
        Choisissez les cartes ici, puis voyez l’aperçu du lot. Les cartes portant l’étiquette « Statut · Vendre » sur le site sont déjà choisies pour les enchères ; la défausse se choisit à la main. Un favori n’est jamais proposé. Rien n’est envoyé avant « Lancer ».
      </p>
      <p className="mt-2 text-sm" data-testid="resume-selection">
        {choisies.length === 0 ? 'Aucune carte choisie.' : `${nbVendre} à mettre aux enchères · ${nbDefausser} à défausser`}
      </p>
      <div className="mt-2 flex flex-col gap-2 md:flex-row">
        <button type="button" className={`${CLASSE_BOUTON} border-muted`} onClick={onPrecocher}>
          Pré-cocher selon mes thèmes, mes amis et le plafond
        </button>
        {choisies.length > 0 && (
          <button type="button" className={`${CLASSE_BOUTON} border-muted`} onClick={onVider}>
            Tout décocher
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Pré-coche{NB}: un thème que vous gardez ou un ami concerné, rien (l’échange passe par les étiquettes « #À échanger »)
        ; valeur au plafond ({plafond}) ou en dessous, défausse ; au-dessus, mise aux enchères. Vous gardez la main sur chaque case.
      </p>
      {choisies.length > 0 && <ul className="mt-2">{choisies.slice(0, MAX_CHOISIES).map(ligne)}</ul>}
      {choisies.length > MAX_CHOISIES && <p className="mt-1 text-sm text-muted">… et {choisies.length - MAX_CHOISIES} autres cartes choisies (toutes seront dans le lot).</p>}
      <HeuresFortes nbObservations={observations(ventes)} />
      <label className="mt-3 flex flex-col gap-1 text-sm">
        Ajouter une carte{NB}:
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Titre de la carte"
          className={`${CLASSE_BOUTON} justify-start border-line`}
        />
      </label>
      {trouvees.length > 0 && <ul className="mt-2">{trouvees.slice(0, MAX_AFFICHEES).map(ligne)}</ul>}
      {trouvees.length > MAX_AFFICHEES && <p className="mt-1 text-sm text-muted">… et {trouvees.length - MAX_AFFICHEES} autres : précisez la recherche.</p>}
    </section>
  );
};

export default SelectionVenteDefausse;
