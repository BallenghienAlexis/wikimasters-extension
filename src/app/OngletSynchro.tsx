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
} from '../lib/stockage';
import { progression, texteProgression } from '../lib/synchro';
import PastilleStatut, { type EtatSynchro } from './PastilleStatut';
import FraicheurPrix from './FraicheurPrix';
import ListeTaches from './ListeTaches';
import ProgressionSynchro from './ProgressionSynchro';
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
  journal: EntreeJournal[];
  etat: EtatOrdonnanceur | null;
  maintenant: number;
}

const LECTURE_INITIALE: Lecture = { statut: null, bail: null, execution: null, journal: [], etat: null, maintenant: 0 };

/** Lecture du stockage de l’onglet : un échec de lecture donne une valeur vide, jamais une erreur. */
function useLecture(): Lecture {
  const [lecture, setLecture] = useState<Lecture>(LECTURE_INITIALE);
  const relire = useCallback(async (): Promise<void> => {
    const sans = <T,>(p: Promise<T>, defaut: T): Promise<T> => p.catch(() => defaut);
    const [statut, bail, execution, journal, etat] = await Promise.all([
      sans(chargerStatutSynchro(), null),
      sans(chargerBailSynchro(), null),
      sans(chargerExecution(), null),
      sans(chargerJournal(), [] as EntreeJournal[]),
      sans(chargerEtatSynchro(), null),
    ]);
    setLecture({ statut, bail, execution, journal, etat, maintenant: Date.now() });
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
  const { synchro, collection, preferences, cacheWiki } = donnees;
  const { statut, bail, execution, journal, etat, maintenant } = useLecture();
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
      {/* Emplacement réservé à T-307 (panneau d’erreur, ignorées, historique filtrable). */}
      <div id="historique" tabIndex={-1} />
    </>
  );
};

export default OngletSynchro;
