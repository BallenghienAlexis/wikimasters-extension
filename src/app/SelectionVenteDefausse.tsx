import React, { useMemo, useState } from 'react';
import { observations, type EvenementVente } from '../lib/affluence';
import { normaliser, type Carte } from '../lib/collection';
import { conseilLancement, estProposable, type Choix, type ChoixCarte, type Verdict } from '../lib/selectionLot';
import { NB, CLASSE_BOUTON } from './apercuLot';
import SectionRepliable from './SectionRepliable';
import HeuresFortes from './HeuresFortes';

interface Props {
  cartes: readonly Carte[];
  choix: Choix;
  plafond: number;
  /** Cartes sans aucun prix trouvé sur le site : défaussables malgré la valeur inconnue (2026-11-23). */
  sansPrix?: ReadonlySet<string>;
  /** Cartes sans prix défaussables par la pré-coche, et si leur nombre dépasse le plafond (rien n’est alors pré-coché). */
  resumeSansPrix?: { nombre: number; trop: boolean };
  /** Verdict de chaque carte avec les règles courantes (recalculé, jamais mis en cache). */
  verdicts?: ReadonlyMap<string, Verdict>;
  /** Demande le calcul des verdicts (paresseux : coûteux sur une grosse collection). */
  onVoirVerdicts?: () => void;
  onChoisir: (idCarte: string, choix: ChoixCarte, exemplaires: number) => void;
  /** Pré-coche selon les règles (recalculée à chaque fois). */
  onPrecocher: () => void;
  onVider: () => void;
  /** Évènements de vente (relevés du site et du joueur) pour les heures de plus forte influence. */
  ventes: readonly EvenementVente[];
}

const PAS = 30;
type Vue = 'defausser' | 'vendre' | 'gardees' | 'toutes';

const LIBELLES_CHOIX: Record<ChoixCarte, string> = { aucun: 'Rien', vendre: 'Enchère', defausser: 'Défausser' };

/** Choix des cartes à défausser ou à mettre aux enchères : listes courtes par vue, un motif bref et trois boutons par carte. Rien n’est envoyé ici. */
const SelectionVenteDefausse: React.FC<Props> = ({ cartes, choix, plafond, sansPrix, resumeSansPrix, verdicts, onVoirVerdicts, onChoisir, onPrecocher, onVider, ventes }) => {
  const [vue, setVue] = useState<Vue>('defausser');
  const [recherche, setRecherche] = useState('');
  const [affichees, setAffichees] = useState(PAS);
  const [maintenant] = useState(() => Date.now());

  const proposables = useMemo(() => cartes.filter(estProposable), [cartes]);
  const nbDefausser = useMemo(() => proposables.filter((c) => choix.get(c.id)?.choix === 'defausser').length, [proposables, choix]);
  const nbVendre = useMemo(() => proposables.filter((c) => choix.get(c.id)?.choix === 'vendre').length, [proposables, choix]);
  const nbGardees = useMemo(() => (verdicts ? cartes.filter((c) => verdicts.get(c.id)?.action === 'garder').length : 0), [cartes, verdicts]);

  // Cartes sans valeur dont le site n’a pas (encore) confirmé l’absence de prix : défausse impossible tant que le prix n’est pas relevé.
  const nbSansValeur = useMemo(() => proposables.filter((c) => c.valeurMarchande === null && sansPrix?.has(c.id) !== true).length, [proposables, sansPrix]);

  const liste = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (q !== '') return cartes.filter((c) => normaliser(c.titre).includes(q));
    if (vue === 'defausser') return proposables.filter((c) => choix.get(c.id)?.choix === 'defausser');
    if (vue === 'vendre') return proposables.filter((c) => choix.get(c.id)?.choix === 'vendre');
    if (vue === 'gardees') return cartes.filter((c) => verdicts?.get(c.id)?.action === 'garder');
    return cartes;
  }, [cartes, proposables, vue, recherche, verdicts, choix]);

  const ligne = (c: Carte): React.ReactNode => {
    const v = verdicts?.get(c.id);
    const proposable = estProposable(c);
    const sansPrixTrouve = c.valeurMarchande === null && sansPrix?.has(c.id) === true;
    const defausseOk = proposable && (sansPrixTrouve || (c.valeurMarchande !== null && c.valeurMarchande <= plafond));
    const x = choix.get(c.id) ?? { choix: 'aucun' as ChoixCarte, exemplaires: 1 };
    return (
      <li key={c.id} className="flex flex-col gap-1 border-b border-line py-2 md:flex-row md:items-center md:justify-between" data-testid="ligne-selection">
        <span className="min-w-0 break-words">
          <span className="font-medium">{c.titre}</span>
          <span className="block text-sm text-muted">
            {c.rarete || '—'}
            {NB}· {c.quantite} ex.{NB}· valeur {c.valeurMarchande ?? (sansPrixTrouve ? 'aucun prix' : 'inconnue')}
            {v ? `${NB}· ${v.court}` : ''}
          </span>
        </span>
        {proposable ? (
          <fieldset className="flex shrink-0 flex-wrap items-center gap-1">
            <legend className="sr-only">Action pour {c.titre}</legend>
            {(['aucun', 'vendre', 'defausser'] as const).map((k) => {
              const actif = x.choix === k;
              const desactive = k === 'defausser' && !defausseOk;
              return (
                <label
                  key={k}
                  title={desactive ? c.valeurMarchande === null ? 'Défausse impossible : le prix n’est pas relevé ou une vente passée dépasse le plafond (lancez « Forcer la synchro »)' : `Défausse impossible : valeur au-dessus de ${plafond}` : undefined}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded border px-3 text-sm ${actif ? 'border-paper font-semibold' : 'border-line'} ${desactive ? 'opacity-40' : ''}`}
                >
                  <input type="radio" className="sr-only" name={`choix-${c.id}`} checked={actif} disabled={desactive} onChange={() => onChoisir(c.id, k, x.exemplaires)} />
                  {LIBELLES_CHOIX[k]}
                </label>
              );
            })}
            {x.choix === 'defausser' && c.quantite > 1 && (
              <label className="inline-flex items-center gap-1 text-sm">
                ×
                <input
                  type="number"
                  min={1}
                  max={c.quantite}
                  value={x.exemplaires}
                  aria-label={`Exemplaires à défausser de ${c.titre}`}
                  className={`${CLASSE_BOUTON} w-16 border-line`}
                  onChange={(e) => onChoisir(c.id, 'defausser', Math.max(1, Math.min(c.quantite, Number(e.target.value) || 1)))}
                />
              </label>
            )}
            {x.choix === 'vendre' && <span className="text-sm text-muted">{conseilLancement(c.valeurMarchande, maintenant, ventes)}</span>}
          </fieldset>
        ) : (
          <span className="text-sm text-muted">Non proposable</span>
        )}
      </li>
    );
  };

  const onglet = (id: Vue, texte: string, n: number | null): React.ReactNode => (
    <button
      type="button"
      key={id}
      aria-pressed={vue === id && recherche === ''}
      className={`${CLASSE_BOUTON} ${vue === id && recherche === '' ? 'border-paper font-semibold' : 'border-line'}`}
      onClick={() => {
        setVue(id);
        setRecherche('');
        setAffichees(PAS);
        if (id === 'gardees' || id === 'toutes') onVoirVerdicts?.();
      }}
    >
      {texte}
      {n !== null ? `${NB}(${n})` : ''}
    </button>
  );

  return (
    <SectionRepliable
      id="selection-vente-defausse"
      testId="selection-vente-defausse"
      className="mt-4"
      titre="Enchères et défausses"
      ouvertParDefaut={nbDefausser + nbVendre > 0}
      resume={nbDefausser + nbVendre === 0 ? 'Aucune carte choisie' : `${nbDefausser} à défausser · ${nbVendre} en enchère`}
    >
      <p className="mt-1 text-sm" data-testid="resume-selection">
        {nbDefausser} à défausser · {nbVendre} à mettre aux enchères{verdicts ? ` · ${nbGardees} gardées` : ''}. La défausse est définitive : rien ne part avant « Lancer ».
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={`${CLASSE_BOUTON} border-muted`} onClick={onPrecocher}>
          Recalculer les propositions
        </button>
        {nbDefausser + nbVendre > 0 && (
          <button type="button" className={`${CLASSE_BOUTON} border-muted`} onClick={onVider}>
            Tout décocher
          </button>
        )}
      </div>
      {resumeSansPrix && resumeSansPrix.nombre > 0 && (
        <p className="mt-2 text-sm" data-testid="avertissement-sans-prix">
          {resumeSansPrix.trop
            ? `${resumeSansPrix.nombre} cartes sans prix trouvé : trop pour une pré-coche, choisissez-les à la main.`
            : `${resumeSansPrix.nombre} carte(s) sans prix trouvé proposée(s) en défausse.`}
        </p>
      )}
      {nbSansValeur > 0 && (
        <p className="mt-2 text-sm" data-testid="avertissement-sans-valeur">
          {nbSansValeur} carte(s) sans valeur connue ne peuvent pas être défaussées : le site n’a pas encore confirmé qu’aucun prix n’existe. Lancez « Forcer la synchro » (onglet Synchro) pour relever les prix : celles sans vente récente seront ensuite proposées en défausse si aucune règle ne les garde.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Vue des cartes">
        {onglet('defausser', 'À défausser', nbDefausser)}
        {onglet('vendre', 'Enchères', nbVendre)}
        {onglet('gardees', 'Gardées', verdicts ? nbGardees : null)}
        {onglet('toutes', 'Toutes', cartes.length)}
      </div>
      <label className="mt-2 flex flex-col gap-1 text-sm">
        <span className="sr-only">Chercher une carte</span>
        <input
          type="search"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            setAffichees(PAS);
            if (e.target.value !== '') onVoirVerdicts?.();
          }}
          placeholder="Chercher une carte par titre"
          className={`${CLASSE_BOUTON} justify-start border-line`}
        />
      </label>
      {liste.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{recherche !== '' ? 'Aucune carte trouvée.' : 'Aucune carte dans cette vue.'}</p>
      ) : (
        <ul className="mt-2">{liste.slice(0, affichees).map(ligne)}</ul>
      )}
      {liste.length > affichees && (
        <button type="button" className={`${CLASSE_BOUTON} mt-2 border-muted`} onClick={() => setAffichees((n) => n + PAS)}>
          Afficher plus ({liste.length - affichees} restantes)
        </button>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer">Heures de plus forte influence</summary>
        <HeuresFortes nbObservations={observations(ventes)} />
      </details>
    </SectionRepliable>
  );
};

export default SelectionVenteDefausse;
