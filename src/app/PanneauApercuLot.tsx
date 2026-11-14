import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type { Action, CarteEcartee, FamilleLot, Registre, TypesDisponibles } from '../lib/actions';
import type { Collection } from '../lib/collection';
import { typesDisponibles } from '../lib/contrat';
import { regrouperEtiquettes, type ApercuEtiquettes } from '../lib/apercuEtiquettes';
import { calculerEcarts } from '../lib/ecarts';
import { decouperEnLots } from '../lib/familles';
import { filtrerLotIgnore, type Ignoree } from '../lib/ignorees';
import { chargerExecution, chargerIgnorees, ecouterExecution, enregistrerJournal } from '../lib/stockage';
import { PLAFOND_VALEUR_DEFAUSSE } from '../config/prix';
import { plafondDefausse, preferencesParDefaut, type Preferences } from '../lib/tri';
import EtiquettesPrevues from './EtiquettesPrevues';
import Journal, { type CoupleRetrait } from './Journal';
import BandeauRisque from './BandeauRisque';
import ListeActionsLot from './ListeActionsLot';
import CartesNonIncluses from './CartesNonIncluses';
import ListeEcarts from './ListeEcarts';
import SectionRepliable from './SectionRepliable';
import TableauLots from './TableauLots';
import { useExecution } from './useExecution';
import { actionsRetrait, contexteExecution, lancerLot, nouvelIdLot } from './pilotageLots';
import {
  CADENCE_TEXTE,
  CLASSE_ACTIF,
  CLASSE_BOUTON,
  CLASSE_INACTIF,
  NB,
  SUITE_INTERROMPU,
  TITRE_INTERROMPU,
  actionsDesLotsCoches,
  configDuLot,
  contientAmi,
  detailsDuLot,
  carteTexte,
  libelleType,
  libelleErreurLancement,
  phraseProgression,
  pourcentage,
  texteEnCours,
  texteFin,
  lignesNonIncluses,
  pageActions,
  preparerLot,
  raisonDesactivation,
  regrouperEcartees,
  separerDisponibles,
  texteActionsEcartees,
  texteDureeLots,
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

const Avertissement: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded border border-vendre p-3 text-sm" data-testid="avertissement">
    <span aria-hidden="true">⚠ </span>
    {children}
  </p>
);

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
  // Ignorées figées avec le lot ; familles décochées (tout est coché par défaut, SC-015).
  const [ignorees, setIgnorees] = useState<Ignoree[]>([]);
  const [decochees, setDecochees] = useState<ReadonlySet<FamilleLot>>(new Set());
  const [pauseJusqua, setPauseJusqua] = useState<number | null>(null);
  // Une erreur détaillée est stockée : le panneau d’erreur de l’onglet Synchro existe (sinon pas de lien).
  const [erreurStockee, setErreurStockee] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let actif = true;
    const lire = (): void => {
      chargerExecution()
        .then((e) => {
          if (!actif) return;
          setPauseJusqua(e?.pauseJusqua ?? null);
          setErreurStockee(e?.erreur != null);
        })
        .catch(() => undefined);
    };
    lire();
    const arreter = ecouterExecution(lire);
    return () => {
      actif = false;
      arreter();
    };
  }, []);
  const figer = (r: Registre | null, listeIgnorees: Ignoree[]): void => {
    setIgnorees(listeIgnorees);
    setDecochees(new Set());
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
  const ouvrir = (): void => {
    chargerIgnorees()
      .catch(() => [] as Ignoree[])
      .then((i) => figer(registreIllisible ? null : registreCourant, i));
  };
  const reessayer = async (): Promise<void> => {
    const r = onReessayer ? await onReessayer() : registreIllisible ? null : registreCourant;
    figer(r, await chargerIgnorees().catch(() => [] as Ignoree[]));
    setFocusTitre((k) => k + 1);
  };

  const lot = etat && 'lot' in etat ? etat.lot : null;
  const filtre = useMemo(() => (lot ? filtrerLotIgnore(lot.actions, ignorees) : null), [lot, ignorees]);
  const separes = useMemo(() => (filtre ? separerDisponibles(filtre.actions, dispo) : null), [filtre, dispo]);
  const lotsAffiches = useMemo(() => decouperEnLots(separes?.disponibles ?? []), [separes]);
  const cochees = useMemo<ReadonlySet<FamilleLot>>(
    () => new Set(lotsAffiches.map((l) => l.famille).filter((f) => !decochees.has(f))),
    [lotsAffiches, decochees],
  );
  const actionsCochees = useMemo(() => actionsDesLotsCoches(separes?.disponibles ?? [], cochees), [separes, cochees]);
  const lignesLots = useMemo(() => lotsAffiches.map((l, i) => ({ famille: l.famille, nbActions: l.actions.length, ordre: i + 1 })), [lotsAffiches]);
  const detailsCochees = useMemo(() => detailsDuLot(actionsCochees, cartes), [actionsCochees, cartes]);
  const pageCochees = useMemo(() => pageActions(actionsCochees), [actionsCochees]);
  const ecartsSite = useMemo(() => calculerEcarts(collection.cartes, { amis: preferences.amis }), [collection.cartes, preferences.amis]);
  const detailsEcartees = useMemo(() => detailsDuLot((filtre?.ecartees ?? []).map((e) => e.action), cartes), [filtre, cartes]);
  const basculerLot = (f: FamilleLot): void =>
    setDecochees((d) => {
      const suite = new Set(d);
      if (suite.has(f)) suite.delete(f);
      else suite.add(f);
      return suite;
    });
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
        collection.cartes.filter((c) => c.statut === 'en-vente').length + (filtre?.actions.filter((a) => a.type === 'enchere').length ?? 0),
      max: CONFIG_PRIX.maxVentesSimultanees,
    }),
    [collection.cartes, filtre],
  );

  const n = separes?.disponibles.length ?? 0;
  const avecIndisponibles = lignes.some((l) => l.raison === 'action-non-disponible');
  const afficherLancer = n > 0 || avecIndisponibles;
  const enCours = exec?.etat.etat === 'en-cours' || (enCoursStocke === null ? executionEnCours : enCoursStocke);
  const nbOngletsReel = ongletsLive ?? nbOnglets;
  const nCochees = actionsCochees.length;
  const raison = raisonDesactivation({
    nbOnglets: nbOngletsReel,
    executionEnCours: enCours,
    executionIllisible,
    nbDisponibles: nCochees,
    pauseJusqua,
    maintenant,
    nbLotsCoches: lotsAffiches.length > 0 ? cochees.size : undefined,
  });
  const plafond = plafondDefausse(preferences);

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

  const enCoursExec = exec?.etat.etat === 'en-cours';
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
      <BandeauRisque avertirAmis={lot !== null && contientAmi(actionsCochees)} />

      {zoneVisible && (
        <section
          data-testid="zone-execution"
          aria-labelledby="titre-execution"
          className="mt-4 rounded border border-line border-l-4 border-l-paper bg-ink-2 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && enCoursExec) {
              e.preventDefault();
              arreter();
            }
          }}
        >
          <h2 id="titre-execution" ref={titreExecRef} tabIndex={-1} className="font-semibold">
            Exécution du lot
          </h2>
          {enCoursExec && exec && (
            <>
              <p className="mt-2 font-semibold">{texteEnCours(exec.etat.traitees, exec.etat.total, exec.bilan.erreurs)}</p>
              <div className="mt-2 h-2 rounded bg-line">
                <div
                  role="progressbar"
                  aria-label="Progression du lot"
                  aria-valuemin={0}
                  aria-valuemax={exec.etat.total}
                  aria-valuenow={exec.etat.traitees}
                  className="h-2 rounded bg-paper"
                  style={{ width: `${pourcentage(exec.etat.traitees, exec.etat.total)}%` }}
                />
              </div>
              <button ref={arreterRef} type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-muted font-semibold`} onClick={arreter}>
                Arrêter
              </button>
              <p className="mt-2 text-sm text-muted">Échap{NB}: arrêter le lot</p>
            </>
          )}
          <div role="status" aria-live="polite" aria-atomic="true" className="mt-2">
            {enCoursExec && exec && <p className="text-sm text-muted">{phraseProgression(exec.etat.traitees, exec.etat.total, exec.bilan.erreurs)}</p>}
            {exec && exec.etat.etat === 'terminee' && (
              <p>
                <span aria-hidden="true">✓ </span>
                <span className="font-semibold text-garder">{texteFin(exec.etat, exec.bilan, exec.deconnecte).titre}</span>
                {NB}: {texteFin(exec.etat, exec.bilan, exec.deconnecte).detail}
              </p>
            )}
            {exec && exec.etat.etat === 'arretee' && (
              <>
                <p className="font-semibold text-defausser">
                  <span aria-hidden="true">✕ </span>
                  {texteFin(exec.etat, exec.bilan, exec.deconnecte).titre}
                </p>
                <p className="mt-1">{texteFin(exec.etat, exec.bilan, exec.deconnecte).detail}</p>
                {exec.bilan.dernierInconnu && <p className="mt-1 font-semibold text-vendre">Résultat inconnu, à vérifier sur le site.</p>}
                {erreurStockee && (
                  <p className="mt-1">
                    Le détail de l’erreur et les choix sont dans l’onglet{' '}
                    <a href="#synchro" className="underline focus-visible:shadow-(--halo-focus)">
                      Synchro
                    </a>
                    .
                  </p>
                )}
              </>
            )}
            {!exec && interrompu && (
              <p>
                <span className="font-semibold text-defausser">{TITRE_INTERROMPU}</span>
                {SUITE_INTERROMPU}
              </p>
            )}
          </div>
          {!enCoursExec && (
            <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-muted`} onClick={fermerZone}>
              Fermer
            </button>
          )}
        </section>
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
            <p className="mt-2 text-sm" data-testid="resume-lots">
              {lotsAffiches.length > 0 ? `${cochees.size} sur ${lotsAffiches.length} ${lotsAffiches.length > 1 ? 'lots cochés' : 'lot coché'}` : 'Aucun lot'}
              {filtre && filtre.ecartees.length > 0 && ` · ${texteActionsEcartees(filtre.ecartees.length)}`}
            </p>
            <p className="mt-1 text-sm" data-testid="duree-lots">
              {texteDureeLots(nCochees)}
            </p>

            {n === 0 && <p className="mt-2 text-sm text-muted">{texteLotVide(avecIndisponibles)}</p>}
            <TableauLots lots={lignesLots} cochees={cochees} onBasculer={basculerLot} />
            {n > 0 && (
              <div className="mt-3">
                <SectionRepliable id="apercu-actions" titre="Aperçu des actions" resume={`${nCochees} ${nCochees > 1 ? 'actions' : 'action'}`}>
                  {nCochees === 0 ? (
                    <p className="text-sm text-muted">Aucune action : aucun lot n’est coché.</p>
                  ) : (
                    <ListeActionsLot disponibles={actionsCochees} n={nCochees} page={pageCochees} details={detailsCochees} cartes={cartes} />
                  )}
                </SectionRepliable>
              </div>
            )}

            {filtre && filtre.ecartees.length > 0 && (
              <section aria-labelledby="titre-ecartees" className="mt-4" data-testid="actions-ecartees">
                <h3 id="titre-ecartees" className="font-semibold">
                  Actions écartées
                </h3>
                <ul className="mt-1 text-sm">
                  {filtre.ecartees.slice(0, 50).map((e, i) => (
                    <li key={i} className="break-words py-1">
                      {carteTexte(e.action.idCarte, cartes)}
                      {NB}: {libelleType(e.action.type)}
                      {detailsEcartees[i] ? ` (${detailsEcartees[i]})` : ''} · <span className="text-muted">{e.raison}</span>
                    </li>
                  ))}
                </ul>
                {filtre.ecartees.length > 50 && (
                  <p className="text-sm text-muted">… et {filtre.ecartees.length - 50} autres.</p>
                )}
              </section>
            )}

            {apercuEtiquettes && <EtiquettesPrevues apercu={apercuEtiquettes} cartes={cartes} />}

            <ListeEcarts ecarts={ecartsSite} />

            <div className="mt-4 grid gap-2">
              {actionsCochees.some((a) => a.type === 'creation-etiquette' || a.type === 'pose-etiquette' || a.type === 'retrait-etiquette') && (
                <Avertissement>Les étiquettes posées sont visibles des autres joueurs.</Avertissement>
              )}
              {actionsCochees.some((a) => a.type === 'defausse') && (
                <Avertissement>Une défausse est définitive : la carte ne peut pas être récupérée.</Avertissement>
              )}
              {plafond > PLAFOND_VALEUR_DEFAUSSE && (
                <Avertissement>
                  Le plafond de défausse est réglé à {plafond}, au-dessus de {PLAFOND_VALEUR_DEFAUSSE} : des cartes de valeur plus élevée peuvent être défaussées.
                </Avertissement>
              )}
            </div>

            {lignes.length > 0 && <CartesNonIncluses lignes={lignes} groupees={groupees} places={places} cartes={cartes} />}

            <p className="mt-3 text-sm text-muted">{CADENCE_TEXTE}</p>

            <div
              data-testid="barre-lancer"
              className="sticky bottom-0 z-10 -mx-4 mt-3 border-t border-line bg-ink-2 px-4 py-3 min-[600px]:static min-[600px]:mx-0 min-[600px]:border-t-0 min-[600px]:bg-transparent min-[600px]:px-0"
            >
              <div className="flex flex-col gap-2 md:flex-row">
                {afficherLancer && (
                  <button
                    type="button"
                    aria-disabled={raison !== null}
                    aria-describedby={raison !== null ? 'raison-lancer' : undefined}
                    className={`${CLASSE_BOUTON} font-semibold ${raison !== null ? CLASSE_INACTIF : `${CLASSE_ACTIF} border-paper`}`}
                    onClick={() => {
                      if (raison === null) lancerDepuisApercu(actionsCochees);
                    }}
                  >
                    {nCochees === 0 ? 'Lancer' : nCochees > 1 ? `Lancer les ${nCochees} actions` : 'Lancer l’action'}
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
            </div>
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
