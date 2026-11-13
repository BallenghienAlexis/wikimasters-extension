import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type { Action, CarteEcartee, Registre, TypesDisponibles } from '../lib/actions';
import type { Collection } from '../lib/collection';
import { typesDisponibles } from '../lib/contrat';
import { regrouperEtiquettes, type ApercuEtiquettes } from '../lib/apercuEtiquettes';
import { enregistrerJournal } from '../lib/stockage';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import EtiquettesPrevues from './EtiquettesPrevues';
import Journal, { type CoupleRetrait } from './Journal';
import BandeauRisque from './BandeauRisque';
import ZoneExecution from './ZoneExecution';
import ListeActionsLot from './ListeActionsLot';
import CartesNonIncluses from './CartesNonIncluses';
import { useExecution } from './useExecution';
import { actionsRetrait, contexteExecution, lancerLot, nouvelIdLot } from './pilotageLots';
import {
  CADENCE_TEXTE,
  CLASSE_ACTIF,
  CLASSE_BOUTON,
  CLASSE_INACTIF,
  NB,
  configDuLot,
  contientAmi,
  detailsDuLot,
  libelleErreurLancement,
  lignesNonIncluses,
  pageActions,
  preparerLot,
  raisonDesactivation,
  regrouperEcartees,
  separerDisponibles,
  texteLotVide,
  titreApercu,
  type Places,
  type ResultatLot,
} from './apercuLot';

interface Props {
  collection: Collection;
  registre: Registre;
  /** Préférences (amis et thèmes) : figées à l’ouverture de l’aperçu pour les étiquettes d’échange. */
  preferences?: Preferences;
  /** La page lit encore le registre et l’état d’exécution : l’aperçu n’est pas proposé (D-18, « Calcul du lot… »). */
  chargement?: boolean;
  /** Le registre n’a pas pu être lu : aucun lot ne peut être préparé. */
  registreIllisible?: boolean;
  /** L’état de l’exécution n’a pas pu être lu : « Lancer » reste désactivé. */
  executionIllisible?: boolean;
  /** Nombre d’onglets WikiMasters ouverts (comptés par la page d’exécution, T-017). */
  nbOnglets: number;
  executionEnCours: boolean;
  /** Types d’action dont l’entrée existe dans la table du contrat. */
  disponibles?: TypesDisponibles;
  /** Relit vraiment le stockage ; renvoie le registre, ou `null` s’il reste illisible. */
  onReessayer?: () => Promise<Registre | null>;
  /** Appelé par « Lancer » (câblé en T-017). */
  onLancer?: (actions: Action[]) => void;
}

const PanneauApercuLot: React.FC<Props> = ({
  collection,
  registre,
  preferences = preferencesParDefaut(),
  chargement = false,
  registreIllisible = false,
  executionIllisible = false,
  nbOnglets,
  executionEnCours,
  disponibles,
  onReessayer,
  onLancer,
}) => {
  // Lot figé au clic sur « Voir l’aperçu du lot » ou « Réessayer » : aucun recalcul ensuite.
  const [etat, setEtat] = useState<ResultatLot | null>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const ouvrirRef = useRef<HTMLButtonElement>(null);
  const dejaOuvert = useRef(false);

  const {
    exec,
    setExec,
    interrompu,
    setInterrompu,
    fermee,
    setFermee,
    ongletsLive,
    enCoursStocke,
    ventesSiteLues,
    entrees,
    setEntrees,
    journalIllisible,
    setJournalIllisible,
    registreMaj,
  } = useExecution();
  const [erreurLancement, setErreurLancement] = useState<string | null>(null);
  const arreterRef = useRef<HTMLButtonElement>(null);
  const titreExecRef = useRef<HTMLHeadingElement>(null);

  const registreCourant = registreMaj ?? registre;

  const dispo = useMemo(() => disponibles ?? typesDisponibles(), [disponibles]);
  const cartes = useMemo(() => new Map(collection.cartes.map((c) => [c.id, c])), [collection.cartes]);

  const [focusTitre, setFocusTitre] = useState(0);
  // Après un « Réessayer », le bloc d’erreur disparaît : le focus revient sur le titre (D-35, D-37).
  useEffect(() => {
    if (focusTitre > 0) titreRef.current?.focus();
  }, [focusTitre]);

  const ouvert = etat !== null;
  useEffect(() => {
    if (ouvert) {
      titreRef.current?.focus();
      dejaOuvert.current = true;
    } else if (dejaOuvert.current) {
      ouvrirRef.current?.focus();
    }
  }, [ouvert]);

  // Aperçu des étiquettes, figé avec le lot : mêmes collection, registre et préférences (H24).
  const [apercuEtiquettes, setApercuEtiquettes] = useState<ApercuEtiquettes | null>(null);
  const figer = (r: Registre | null): void => {
    const config = configDuLot(preferences, ventesSiteLues);
    setEtat(preparerLot(collection, r, dispo, config));
    let apercu: ApercuEtiquettes | null = null;
    if (r !== null) {
      try {
        apercu = regrouperEtiquettes(collection, r, config);
      } catch {
        apercu = null;
      }
    }
    setApercuEtiquettes(apercu);
  };
  const ouvrir = (): void => figer(registreIllisible ? null : registreCourant);
  const reessayer = async (): Promise<void> => {
    const r = onReessayer ? await onReessayer() : registreIllisible ? null : registreCourant;
    figer(r);
    setFocusTitre((k) => k + 1);
  };

  const lot = etat && 'lot' in etat ? etat.lot : null;
  const separes = useMemo(() => (lot ? separerDisponibles(lot.actions, dispo) : null), [lot, dispo]);
  const details = useMemo(() => (separes ? detailsDuLot(separes.disponibles, cartes) : []), [separes, cartes]);
  const page = useMemo(() => pageActions(separes?.disponibles ?? []), [separes]);
  const lignes = useMemo(() => {
    if (!lot || !separes) return [];
    // Les actions « non disponibles » sont listées avec les cartes non incluses (D-17).
    const indispo: CarteEcartee[] = separes.indisponibles.map((a) => ({
      idCarte: a.idCarte,
      titre: cartes.get(a.idCarte)?.titre ?? a.idCarte,
      raison: 'action-non-disponible',
    }));
    return lignesNonIncluses([...lot.ecartees, ...indispo], lot.obsoletes);
  }, [lot, separes, cartes]);
  const groupees = useMemo(() => regrouperEcartees(lignes), [lignes]);
  // Places d’enchère : exemplaires déjà en vente + enchères de ce lot, sur le maximum (D-17).
  const places = useMemo<Places>(
    () => ({
      occupees:
        collection.cartes.filter((c) => c.statut === 'en-vente').length + (lot?.actions.filter((a) => a.type === 'enchere').length ?? 0),
      max: CONFIG_PRIX.maxVentesSimultanees,
    }),
    [collection.cartes, lot],
  );

  const n = separes?.disponibles.length ?? 0;
  const avecIndisponibles = lignes.some((l) => l.raison === 'action-non-disponible');
  const afficherLancer = n > 0 || avecIndisponibles;
  const enCours = exec?.etat.etat === 'en-cours' || (enCoursStocke === null ? executionEnCours : enCoursStocke);
  const nbOngletsReel = ongletsLive ?? nbOnglets;
  const raison = raisonDesactivation({ nbOnglets: nbOngletsReel, executionEnCours: enCours, executionIllisible, nbDisponibles: n });

  const phase = exec?.etat.etat ?? null;
  useEffect(() => {
    if (phase === 'en-cours') arreterRef.current?.focus();
    else if (phase !== null) titreExecRef.current?.focus();
  }, [phase]);

  const lancer = (actions: Action[], idLot: string): void => {
    setErreurLancement(null);
    setInterrompu(false);
    setFermee(false);
    lancerLot(actions, idLot).catch((e: unknown) =>
      setErreurLancement(libelleErreurLancement(e)),
    );
  };
  const lancerDepuisApercu = (actions: Action[]): void => (onLancer ?? ((a: Action[]) => lancer(a, nouvelIdLot('lot'))))(actions);

  const arreter = (): void => {
    contexteExecution().file.arreter();
    setTimeout(() => titreExecRef.current?.focus(), 0);
  };

  const retirer = (couple: CoupleRetrait): void => {
    const actions = actionsRetrait(couple, collection, registreCourant, dispo.has('retrait-etiquette'));
    if (actions.length === 0) return;
    const ctx = contexteExecution();
    if (ctx.file.etat()?.etat === 'en-cours' && ctx.file.ajouter(actions)) return;
    lancer(actions, nouvelIdLot('retrait'));
  };

  const vider = (): void => {
    enregistrerJournal([])
      .then(() => setEntrees([]))
      .catch(() => setJournalIllisible(true));
  };

  const zoneVisible = (exec !== null || interrompu) && !fermee;
  const fermerZone = (): void => {
    setFermee(true);
    setExec(null);
    setInterrompu(false);
    setEtat(null);
  };
  const classeSecondaire = `${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`;

  return (
    <div data-testid="synchronisation">
      <BandeauRisque avertirAmis={lot !== null && contientAmi(lot.actions)} />

      {zoneVisible && (
        <ZoneExecution
          exec={exec}
          interrompu={interrompu}
          titreRef={titreExecRef}
          arreterRef={arreterRef}
          onArreter={arreter}
          onFermer={fermerZone}
        />
      )}

      <section aria-labelledby="titre-synchro" hidden={zoneVisible} className="mt-4 rounded border border-line bg-ink-2 p-4">
        <h2 id="titre-synchro" ref={titreRef} tabIndex={-1} className="font-semibold" data-testid="titre-apercu">
          {lot ? titreApercu(n) : 'Synchronisation avec WikiMasters'}
        </h2>

        {!ouvert && chargement ? (
          <p className="mt-2 text-sm text-muted" aria-busy="true">
            Calcul du lot…
          </p>
        ) : !ouvert ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Voyez d’abord ce qui serait envoyé au site. Rien n’est envoyé tant que vous n’avez pas lancé le lot.
            </p>
            <button
              ref={ouvrirRef}
              type="button"
              className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-paper font-semibold`}
              onClick={ouvrir}
            >
              Voir l’aperçu du lot
            </button>
          </>
        ) : !lot || !separes ? (
          <>
            <p className="mt-2 break-words font-semibold text-defausser" role="alert">
              Le lot n’a pas pu être préparé{NB}: {etat && 'erreur' in etat ? etat.erreur : ''}.
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <button type="button" className={classeSecondaire} onClick={() => void reessayer()}>
                Réessayer
              </button>
              <button type="button" className={classeSecondaire} onClick={() => setEtat(null)}>
                Fermer
              </button>
            </div>
          </>
        ) : (
          <>
            {n === 0 ? (
              <p className="mt-2 text-sm text-muted">{texteLotVide(avecIndisponibles)}</p>
            ) : (
              <ListeActionsLot disponibles={separes.disponibles} n={n} page={page} details={details} cartes={cartes} />
            )}

            {apercuEtiquettes && <EtiquettesPrevues apercu={apercuEtiquettes} cartes={cartes} />}

            {lignes.length > 0 && <CartesNonIncluses lignes={lignes} groupees={groupees} places={places} cartes={cartes} />}

            <p className="mt-3 text-sm text-muted">{CADENCE_TEXTE}</p>

            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              {afficherLancer && (
                <button
                  type="button"
                  aria-disabled={raison !== null}
                  aria-describedby={raison !== null ? 'raison-lancer' : undefined}
                  className={`${CLASSE_BOUTON} font-semibold ${raison !== null ? CLASSE_INACTIF : `${CLASSE_ACTIF} border-paper`}`}
                  onClick={() => {
                    if (raison === null) lancerDepuisApercu(separes.disponibles);
                  }}
                >
                  {n === 0 ? 'Lancer' : n > 1 ? `Lancer les ${n} actions` : 'Lancer l’action'}
                </button>
              )}
              <button type="button" className={classeSecondaire} onClick={() => setEtat(null)}>
                {afficherLancer ? 'Annuler' : 'Fermer'}
              </button>
            </div>
            {afficherLancer && raison !== null && (
              <p id="raison-lancer" className="mt-2 text-sm text-muted">
                {raison}
              </p>
            )}
          </>
        )}
      </section>

      {erreurLancement !== null && (
        <p role="alert" className="mt-4 break-words font-semibold text-defausser">
          Lancement impossible{NB}: {erreurLancement}
        </p>
      )}

      <Journal
        entrees={entrees}
        registre={registreCourant}
        retraitDisponible={dispo.has('retrait-etiquette')}
        ongletPret={nbOngletsReel === 1}
        illisible={journalIllisible}
        onRetirer={retirer}
        onVider={vider}
      />
    </div>
  );
};

export default PanneauApercuLot;
