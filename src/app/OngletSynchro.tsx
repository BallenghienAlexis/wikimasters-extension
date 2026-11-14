import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EntreeJournal, EtatExecutionV2 } from '../lib/actions';
import type { EtatOrdonnanceur } from '../lib/ordonnanceur';
import { dureeRestante, listesTaches, secondesSynchro } from '../lib/progression';
import type { StatutSynchroV2 } from '../lib/statutSynchro';
import {
  chargerBailSynchro,
  chargerEtatSynchro,
  chargerExecution,
  chargerJournal,
  chargerStatutSynchro,
  ecouterExecution,
  ecouterJournal,
  ecouterSynchroAuto,
  enregistrerJournal,
} from '../lib/stockage';
import { progression, texteProgression } from '../lib/synchro';
import PastilleStatut, { type EtatSynchro } from './PastilleStatut';
import FraicheurPrix from './FraicheurPrix';
import ListeTaches from './ListeTaches';
import Journal from './Journal';
import PanneauErreur from './PanneauErreur';
import ProgressionSynchro from './ProgressionSynchro';
import TableIgnorees from './TableIgnorees';
import SynchroAuto from './SynchroAuto';
import type { DonneesPage } from './useDonneesPage';

interface Props {
  donnees: DonneesPage;
}

/** Relecture périodique : l’expiration du bail se constate sans événement. */
const RELECTURE_MS = 5000;

interface Lecture {
  statut: StatutSynchroV2 | null;
  bail: number | null;
  execution: EtatExecutionV2 | null;
  /** L’état d’exécution stocké existe mais n’est pas lisible : rien n’est lançable ni sautable (SC-019). */
  executionIllisible: boolean;
  journal: EntreeJournal[];
  /** Le journal stocké existe mais n’est pas lisible. */
  journalIllisible: boolean;
  etat: EtatOrdonnanceur | null;
  maintenant: number;
}

const LECTURE_INITIALE: Lecture = { statut: null, bail: null, execution: null, executionIllisible: false, journal: [], journalIllisible: false, etat: null, maintenant: 0 };

/** Lecture du stockage de l’onglet : un échec de lecture donne une valeur vide, jamais une erreur. */
function useLecture(): Lecture {
  const [lecture, setLecture] = useState<Lecture>(LECTURE_INITIALE);
  const relire = useCallback(async (): Promise<void> => {
    const sans = <T,>(p: Promise<T>, defaut: T): Promise<T> => p.catch(() => defaut);
    let executionIllisible = false;
    let journalIllisible = false;
    const [statut, bail, execution, journal, etat] = await Promise.all([
      sans(chargerStatutSynchro(), null),
      sans(chargerBailSynchro(), null),
      chargerExecution().catch(() => {
        executionIllisible = true;
        return null;
      }),
      chargerJournal().catch(() => {
        journalIllisible = true;
        return [] as EntreeJournal[];
      }),
      sans(chargerEtatSynchro(), null),
    ]);
    setLecture({ statut, bail, execution, executionIllisible, journal, journalIllisible, etat, maintenant: Date.now() });
  }, []);
  useEffect(() => {
    const premiere = setTimeout(() => void relire(), 0);
    const minuteur = setInterval(() => void relire(), RELECTURE_MS);
    const arrets = [ecouterSynchroAuto(() => void relire()), ecouterExecution(() => void relire()), ecouterJournal(() => void relire())];
    return () => {
      clearTimeout(premiere);
      clearInterval(minuteur);
      arrets.forEach((a) => a());
    };
  }, [relire]);
  return lecture;
}

/** Onglet Synchro : progression, tâches, fraîcheur des prix, puis synchronisation automatique (inchangée). */
const OngletSynchro: React.FC<Props> = ({ donnees }) => {
  const { synchro, collection, registre, preferences, cacheWiki } = donnees;
  const { statut, bail, execution, executionIllisible, journal, journalIllisible, etat, maintenant } = useLecture();
  // Un statut « en cours » sans bail tenu est périmé (onglet WikiMasters fermé) : il n’est plus une activité.
  const synchroActive = statut?.etat === 'en-cours' && bail !== null && bail > maintenant;
  // Pastille D-40 : « En cours » seulement si le bail est tenu.
  let pastille: EtatSynchro = 'a-jour';
  if (synchroActive) pastille = 'en-cours';
  // Un statut « en cours » sans bail tenu est périmé : synchro interrompue, donc arrêtée.
  else if (statut?.etat === 'en-cours') pastille = 'arretee';
  else if (statut?.etat === 'arret') pastille = statut.raison === 'manuel' ? 'arretee' : 'erreur';
  else if ((etat?.arretJusqua ?? 0) > maintenant) pastille = 'arretee';
  const listes = useMemo(
    () => listesTaches({ statut: synchroActive ? statut : null, execution, journal }),
    [statut, synchroActive, execution, journal],
  );
  const releves = useMemo(() => Object.values(etat?.prix ?? {}).map((r) => r.releveLe), [etat]);
  return (
    <>
      <h2 className="mt-4 text-xl font-semibold">Synchro</h2>
      {synchro && <p className="mt-2 font-medium" data-testid="synchro">{texteProgression(progression(synchro))}</p>}
      <div className="mt-4" data-testid="pastille-synchro">
        <PastilleStatut etat={pastille} />
      </div>
      {statut && <ProgressionSynchro statut={statut} actif={synchroActive} />}
      {synchroActive && statut && (
        <p className="mt-2 text-sm text-muted">
          Durée restante estimée&nbsp;: <span data-testid="duree-restante">{dureeRestante(secondesSynchro(statut))}</span>
        </p>
      )}
      <ListeTaches listes={listes} />
      <FraicheurPrix releves={releves} maintenant={maintenant} />
      <SynchroAuto collection={collection} preferences={preferences} cacheWiki={cacheWiki} />
      {executionIllisible && (
        <p role="alert" data-testid="etat-execution-illisible" className="mt-4 break-words rounded border border-line border-l-[6px] border-l-defausser bg-ink-2 p-4 font-semibold">
          L’état de l’exécution est illisible. Aucun lot ne peut être lancé ni sauté tant qu’il n’est pas rétabli ; il n’a pas été modifié.
        </p>
      )}
      <PanneauErreur
        execution={executionIllisible ? null : execution}
        statut={synchroActive ? null : statut}
        journal={journal}
        maintenant={maintenant}
        onPreparer={() => {
          window.location.hash = 'lots';
        }}
      />
      <TableIgnorees collection={collection} />
      <div id="historique" tabIndex={-1} className="focus-visible:shadow-(--halo-focus)">
        <Journal
          idTest="historique"
          titre="Historique"
          illisible={journalIllisible}
          entrees={journal}
          registre={registre}
          retraitDisponible={false}
          ongletPret={false}
          onVider={() => void enregistrerJournal([]).catch(() => undefined)}
        />
      </div>
    </>
  );
};

export default OngletSynchro;
