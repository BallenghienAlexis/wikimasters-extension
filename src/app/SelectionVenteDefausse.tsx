import React, { useMemo, useState } from 'react';
import { observations, type EvenementVente } from '../lib/affluence';
import { normaliser, type Carte } from '../lib/collection';
import { conseilLancement, estProposable, raisonNonProposable, type Choix, type ChoixCarte, type CodeVerdict, type Verdict } from '../lib/selectionLot';
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
  /** Verdict de chaque carte avec les règles courantes (recalculé à chaque rendu, jamais mis en cache). */
  verdicts?: ReadonlyMap<string, Verdict>;
  /** Demande le calcul des verdicts (paresseux : coûteux sur une grosse collection). */
  onVoirVerdicts?: () => void;
  onChoisir: (idCarte: string, choix: ChoixCarte, exemplaires: number) => void;
  /** Pré-coche selon mes thèmes, mes amis et le plafond (explicite, jamais automatique). */
  onPrecocher: () => void;
  onVider: () => void;
  /** Évènements de vente (relevés du site et du joueur) pour les heures de plus forte influence. */
  ventes: readonly EvenementVente[];
}

const MAX_AFFICHEES = 30;
const MAX_CHOISIES = 50;

const LIBELLES_CODES: Record<CodeVerdict, string> = {
  'defausse-plafond': 'Défausse proposée (valeur au plafond ou en dessous)',
  'defausse-sans-prix': 'Défausse proposée (aucun prix trouvé)',
  enchere: 'Enchère proposée',
  'theme-garde': 'Gardées : thème que je garde',
  ami: 'Gardées : ami concerné',
  'valeur-inconnue': 'Gardées : valeur inconnue',
  'sans-prix-trop': 'Gardées : sans prix, trop nombreuses (à choisir à la main)',
  'a-classer': 'Gardées : sans thème fiable (« à classer »)',
  favori: 'Gardées : favori',
  'non-reliee': 'Gardées : non reliée au site',
};
const ORDRE_CODES = Object.keys(LIBELLES_CODES) as CodeVerdict[];

/** Choix manuel des cartes à mettre aux enchères ou à défausser, avant l’aperçu du lot (rien n’est envoyé ici). */
const SelectionVenteDefausse: React.FC<Props> = ({ cartes, choix, plafond, sansPrix, resumeSansPrix, verdicts, onVoirVerdicts, onChoisir, onPrecocher, onVider, ventes }) => {
  const [recherche, setRecherche] = useState('');
  const proposables = useMemo(() => cartes.filter(estProposable), [cartes]);
  const choisies = useMemo(() => proposables.filter((c) => (choix.get(c.id)?.choix ?? 'aucun') !== 'aucun'), [proposables, choix]);
  const trouvees = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (q === '') return [];
    return proposables.filter((c) => normaliser(c.titre).includes(q) && !choisies.includes(c));
  }, [proposables, recherche, choisies]);
  const nonProposables = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (q === '') return [];
    return cartes.filter((c) => !estProposable(c) && normaliser(c.titre).includes(q));
  }, [cartes, recherche]);
  const nbVendre = choisies.filter((c) => choix.get(c.id)?.choix === 'vendre').length;
  const nbDefausser = choisies.length - nbVendre;

  const [filtreCode, setFiltreCode] = useState<CodeVerdict | 'tous'>('theme-garde');
  const [nbAffichees, setNbAffichees] = useState(MAX_AFFICHEES);
  const comptes = useMemo(() => {
    const m = new Map<CodeVerdict, number>();
    for (const c of cartes) {
      const v = verdicts?.get(c.id);
      if (v) m.set(v.code, (m.get(v.code) ?? 0) + 1);
    }
    return m;
  }, [cartes, verdicts]);
  const parVerdict = useMemo(
    () => (verdicts ? cartes.filter((c) => filtreCode === 'tous' || verdicts.get(c.id)?.code === filtreCode) : []),
    [cartes, verdicts, filtreCode],
  );
  const [maintenant] = useState(() => Date.now());
  const ligne = (c: Carte): React.ReactNode => {
    const x = choix.get(c.id) ?? { choix: 'aucun' as ChoixCarte, exemplaires: 1 };
    const sansPrixTrouve = c.valeurMarchande === null && sansPrix?.has(c.id) === true;
    const defausseOk = sansPrixTrouve || (c.valeurMarchande !== null && c.valeurMarchande <= plafond);
    const nom = `choix-${c.id}`;
    return (
      <li key={c.id} className="flex flex-col gap-2 border-b border-line py-2 md:flex-row md:items-center md:justify-between" data-testid="ligne-selection">
        <span className="break-words">
          {c.titre}
          <span className="text-muted">
            {NB}· {c.quantite} ex.{NB}· valeur {c.valeurMarchande ?? (sansPrixTrouve ? 'aucun prix trouvé' : 'inconnue')}
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
          {verdicts?.get(c.id) && (
            <span className="basis-full text-sm text-muted" data-testid="verdict-carte">
              {verdicts.get(c.id)?.libelle}
            </span>
          )}
          {x.choix === 'vendre' && <span className="text-sm text-muted">{conseilLancement(c.valeurMarchande, maintenant, ventes)}</span>}
          {!defausseOk && <span className="text-sm text-muted">défausse impossible : valeur inconnue ou au-dessus de {plafond}</span>}
        </fieldset>
      </li>
    );
  };

  return (
    <SectionRepliable
      id="selection-vente-defausse"
      testId="selection-vente-defausse"
      className="mt-4"
      titre="Enchères et défausses"
      ouvertParDefaut={choisies.length > 0}
      resume={choisies.length === 0 ? 'Aucune carte choisie' : `${nbVendre} enchère${nbVendre > 1 ? 's' : ''} · ${nbDefausser} défausse${nbDefausser > 1 ? 's' : ''}`}
    >
      <p className="mt-1 text-sm text-muted">
        Choisissez les cartes ici, puis voyez l’aperçu du lot. Les cartes portant l’étiquette « Statut · Vendre » sur le site sont déjà choisies pour les enchères ; la défausse se choisit à la main ou par la pré-coche. Un favori n’est jamais proposé. Rien n’est envoyé avant « Lancer ».
      </p>
      <p className="mt-2 text-sm" data-testid="resume-selection">
        {choisies.length === 0 ? 'Aucune carte choisie.' : `${nbVendre} à mettre aux enchères · ${nbDefausser} à défausser`}
      </p>
      <div className="mt-2 flex flex-col gap-2 md:flex-row">
        <button type="button" className={`${CLASSE_BOUTON} border-muted`} onClick={onPrecocher}>
          Pré-cocher selon mes thèmes, mes amis, le plafond et les cartes sans prix
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
      {resumeSansPrix && resumeSansPrix.nombre > 0 && (
        <p className="mt-1 text-sm" data-testid="avertissement-sans-prix">
          {resumeSansPrix.trop
            ? `${resumeSansPrix.nombre} cartes sans prix trouvé seraient défaussables : trop pour une pré-coche de masse, elles ne sont pas cochées. Choisissez-les à la main.`
            : `${resumeSansPrix.nombre} carte(s) sans prix trouvé sur le site seront pré-cochées en défausse (définitive, un exemplaire gardé si elle est en plusieurs).`}
        </p>
      )}
      {!verdicts && onVoirVerdicts && (
        <button type="button" className={`${CLASSE_BOUTON} mt-3 border-muted`} onClick={onVoirVerdicts}>
          Voir pourquoi chaque carte est gardée ou proposée
        </button>
      )}
      {verdicts && (
        <div className="mt-3" data-testid="verdicts-toutes-cartes">
          <p className="text-sm">
            Toutes les cartes sont revues avec les règles courantes à chaque ouverture : voici pourquoi chacune est proposée ou gardée. Vous pouvez choisir la défausse
            (valeur au plafond ou sans prix trouvé) ou l’enchère de n’importe quelle carte, même gardée par une règle de thème ou d’ami.
          </p>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            Voir les cartes{NB}:
            <select
              className={`${CLASSE_BOUTON} justify-start border-line`}
              value={filtreCode}
              onChange={(e) => {
                setFiltreCode(e.target.value as CodeVerdict | 'tous');
                setNbAffichees(MAX_AFFICHEES);
              }}
            >
              <option value="tous">Toutes ({cartes.length})</option>
              {ORDRE_CODES.filter((k) => (comptes.get(k) ?? 0) > 0).map((k) => (
                <option key={k} value={k}>
                  {LIBELLES_CODES[k]} ({comptes.get(k)})
                </option>
              ))}
            </select>
          </label>
          {parVerdict.length > 0 && <ul className="mt-2">{parVerdict.slice(0, nbAffichees).map((c) => (estProposable(c) ? ligne(c) : (
            <li key={c.id} className="border-b border-line py-2 text-sm text-muted">
              {c.titre}
              {NB}: {verdicts.get(c.id)?.libelle}
            </li>
          )))}</ul>}
          {parVerdict.length > nbAffichees && (
            <button type="button" className={`${CLASSE_BOUTON} mt-2 border-muted`} onClick={() => setNbAffichees((n) => n + MAX_AFFICHEES)}>
              Afficher plus ({parVerdict.length - nbAffichees} restantes)
            </button>
          )}
        </div>
      )}
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
      {nonProposables.length > 0 && (
        <ul className="mt-2" data-testid="non-proposables">
          {nonProposables.slice(0, MAX_AFFICHEES).map((c) => (
            <li key={c.id} className="border-b border-line py-2 text-sm text-muted">
              {c.titre}
              {NB}: non proposable, {raisonNonProposable(c)}.
            </li>
          ))}
        </ul>
      )}
      {trouvees.length > MAX_AFFICHEES && <p className="mt-1 text-sm text-muted">… et {trouvees.length - MAX_AFFICHEES} autres : précisez la recherche.</p>}
    </SectionRepliable>
  );
};

export default SelectionVenteDefausse;
