import React, { useEffect, useRef, useState } from 'react';
import type { EntreeJournal, EtatExecutionV2 } from '../lib/actions';
import { familleDe } from '../lib/familles';
import { enregistrerExecution } from '../lib/stockage';
import type { RaisonArret } from '../lib/file';
import { choixPanneau, heureReprise, pauseActive, resultatInconnu, type EtatChoix } from '../lib/reprise';
import type { StatutSynchroV2 } from '../lib/statutSynchro';
import { libelleCause, libelleFamille } from './apercuLot';
import { libelleType } from './Journal';
import { arreterTout, ignorer, reessayer, restantes, sauterAction, sauterLot } from './pilotageLots';
import { LIBELLES_ETAPE } from './ProgressionSynchro';

/** Erreur à afficher : exécution arrêtée avec son contexte, ou arrêt de la synchro autre que « manuel ». */
export function erreurAffichable(execution: EtatExecutionV2 | null, statut: StatutSynchroV2 | null): 'execution' | 'synchro' | null {
  if (execution !== null && execution.etat === 'arretee' && execution.erreur !== null) return 'execution';
  if (statut !== null && statut.etat === 'arret' && statut.raison !== 'manuel') return 'synchro';
  return null;
}

/** Libellé fixe de la réponse du site : jamais son texte (SC-007). */
const LIBELLES_CODE: Record<number, string> = {
  401: 'session refusée',
  403: 'accès refusé',
  404: 'introuvable',
  409: 'conflit',
  429: 'trop de requêtes',
};
export const libelleReponse = (code: number | null): string =>
  code === null ? 'aucune réponse exploitable' : `${code} · ${LIBELLES_CODE[code] ?? (code >= 500 ? 'erreur du site' : 'réponse inattendue')}`;

/** Dernière erreur pour laquelle un saut a déjà été fait pendant la pause : un seul saut, la reprise est différée. */
let sauteEnPause: string | null = null;
/** Une action du panneau est en cours (un seul clic à la fois, tous onglets de la page confondus). */
let actionEnCours = false;

/** Réserve le droit d’agir : faux si une autre action du panneau est déjà en cours. */
function reserverAction(): boolean {
  if (actionEnCours) return false;
  actionEnCours = true;
  return true;
}
const libererAction = (): void => {
  actionEnCours = false;
};
const noterSaut = (cle: string): void => {
  sauteEnPause = cle;
};

const MESSAGES_FIXES = ['Reprise possible à', 'Résultat inconnu', 'L’état de l’exécution est illisible', 'Aucune action à', 'Une exécution est déjà en cours', 'Un seul onglet', 'Onglet WikiMasters', 'Une synchronisation'];
/** Texte d’une erreur de lancement : seulement les phrases fixes de l’extension, jamais un texte venu d’ailleurs. */
const messageDe = (e: unknown, defaut: string): string =>
  e instanceof Error && MESSAGES_FIXES.some((m) => e.message.startsWith(m)) ? e.message : defaut;

const CLASSE = 'inline-flex min-h-11 w-full items-center justify-center rounded border px-4 focus-visible:shadow-(--halo-focus) md:w-auto';
const CLASSE_ACTIF = 'cursor-pointer bg-ink text-paper hover:bg-line active:bg-line';
const CLASSE_INACTIF = 'cursor-not-allowed bg-ink border-muted text-muted';

interface Props {
  execution: EtatExecutionV2 | null;
  statut: StatutSynchroV2 | null;
  journal: readonly EntreeJournal[];
  maintenant: number;
  /** Appelé par « Préparer un nouveau lot » : ouvre l’onglet Lots. */
  onPreparer: () => void;
}

const Ligne: React.FC<{ intitule: string; children: React.ReactNode }> = ({ intitule, children }) => (
  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
    <dt className="font-semibold">{intitule}</dt>{' '}
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);

const plurielAutres = (n: number): string => (n === 0 ? 'aucun' : `${n} ${n > 1 ? 'autres échecs' : 'autre échec'}`);

/** Panneau d’erreur (D-30, D-33) : détail en champs fermés, cinq choix, ou détail seul après un rechargement. */
const PanneauErreur: React.FC<Props> = ({ execution, statut, journal, maintenant, onPreparer }) => {
  const genre = erreurAffichable(execution, statut);
  const titre = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, rafraichir] = useState(0);
  const erreur = genre === 'execution' ? (execution?.erreur ?? null) : null;
  const cleErreur = genre === 'execution' && execution !== null && erreur !== null ? `${execution.idLot}|${erreur.le}` : `synchro|${statut?.le ?? 0}`;

  // Le focus va sur le titre à l’apparition, ou quand une nouvelle erreur s’affiche (le panneau n’existe que dans l’onglet Synchro).
  useEffect(() => {
    titre.current?.focus();
  }, [cleErreur]);

  if (genre === null) return null;

  if (genre === 'synchro' && statut !== null) {
    return (
      <section role="alert" aria-labelledby="titre-panneau-erreur" data-testid="panneau-erreur" className="mt-4 rounded border border-line border-l-[6px] border-l-defausser bg-ink-2 p-4">
        <h3 id="titre-panneau-erreur" ref={titre} tabIndex={-1} className="font-semibold">
          <span aria-hidden="true">✕ </span>Arrêt de la synchronisation
        </h3>
        <dl className="mt-3 grid gap-2">
          <Ligne intitule="Étape">{statut.etape === null ? '—' : LIBELLES_ETAPE[statut.etape]}</Ligne>
          <Ligne intitule="Page">{statut.page !== null && statut.pages !== null ? `${statut.page} / ${statut.pages}` : '—'}</Ligne>
          <Ligne intitule="Réponse du site">{libelleReponse(statut.codeHttp)}</Ligne>
          <Ligne intitule="Cause probable">{libelleCause((statut.raison ?? 'code-http') as RaisonArret, statut.codeHttp)}</Ligne>
          <Ligne intitule="Heure">{heureReprise(statut.le)}</Ligne>
          <Ligne intitule="Déjà fait">
            {statut.ajoutees} {statut.ajoutees > 1 ? 'cartes ajoutées' : 'carte ajoutée'} · {statut.prix} {statut.prix > 1 ? 'prix relevés' : 'prix relevé'}
          </Ligne>
        </dl>
      </section>
    );
  }

  if (execution === null || erreur === null) return null;

  const pauseJusqua = execution.pauseJusqua;
  const enPause = pauseActive(pauseJusqua, maintenant);
  const reste = restantes();
  const aSaute = sauteEnPause === cleErreur;
  const repriseImpossible = reste.length === 0 && !(aSaute && enPause);
  const parametre = erreur.parametre;
  const choix = choixPanneau({
    pauseJusqua,
    maintenant,
    repriseImpossible,
    resultatInconnu: resultatInconnu(journal, { type: erreur.type, parametre, idCarte: erreur.idCarte }, execution.idLot),
  });
  const nbLot = reste.filter((a) => familleDe(a) === erreur.famille).length;
  const raisonSaut = aSaute ? 'Une action a déjà été sautée pendant la pause : la reprise est différée.' : null;

  const executer = async (f: () => Promise<void>, apresSaut: boolean, defaut = 'L’action n’a pas pu être lancée.'): Promise<void> => {
    if (!reserverAction()) return;
    setMessage(null);
    try {
      await f();
      if (apresSaut && enPause) noterSaut(cleErreur);
    } catch (e) {
      setMessage(messageDe(e, defaut));
    } finally {
      libererAction();
      rafraichir((n) => n + 1);
    }
  };
  const fermer = (): void => {
    enregistrerExecution({ ...execution, erreur: null }).catch(() => setMessage('Écriture impossible : le panneau n’a pas pu être fermé.'));
  };

  const bouton = (id: string, libelle: string, etat: EtatChoix, surclic: () => void, style: string, raisonSupp: string | null = null): React.ReactNode => {
    if (!etat.visible) return null;
    const raison = etat.raison ?? raisonSupp;
    const desactive = !etat.actif || raisonSupp !== null;
    const idRaison = `raison-${id}`;
    return (
      <div key={id} className="flex flex-col gap-1">
        <button
          type="button"
          aria-disabled={desactive ? 'true' : undefined}
          aria-describedby={desactive && raison !== null ? idRaison : undefined}
          className={`${CLASSE} ${desactive ? CLASSE_INACTIF : `${CLASSE_ACTIF} ${style}`}`}
          onClick={() => {
            if (!desactive) surclic();
          }}
        >
          {libelle}
        </button>
        {desactive && raison !== null && (
          <span id={idRaison} className="text-sm text-muted">
            {raison}
          </span>
        )}
      </div>
    );
  };
  const saut = (etat: EtatChoix): EtatChoix => (raisonSaut !== null ? { ...etat, actif: false, raison: raisonSaut } : etat);

  return (
    <section role="alert" aria-labelledby="titre-panneau-erreur" data-testid="panneau-erreur" className="mt-4 rounded border border-line border-l-[6px] border-l-defausser bg-ink-2 p-4">
      <h3 id="titre-panneau-erreur" ref={titre} tabIndex={-1} className="font-semibold">
        <span aria-hidden="true">✕ </span>Erreur d’exécution
      </h3>
      <p className="mt-1 text-sm">Sauter n’envoie rien au site.</p>
      <dl className="mt-3 grid gap-2">
        <Ligne intitule="Action">
          {libelleType(erreur.type)}
          {parametre !== null && ` ${erreur.type === 'enchere' ? `à ${parametre}` : parametre}`}
        </Ligne>
        <Ligne intitule="Carte">{erreur.titre}</Ligne>
        <Ligne intitule="Lot">
          Lot {erreur.indexLot} / {erreur.nbLots} · {libelleFamille(erreur.famille)}
        </Ligne>
        <Ligne intitule="Rang">
          {erreur.rang} / {erreur.totalLot}
        </Ligne>
        <Ligne intitule="Réponse du site">{libelleReponse(erreur.codeHttp)}</Ligne>
        <Ligne intitule="Cause probable">{libelleCause(erreur.cause as RaisonArret, erreur.codeHttp)}</Ligne>
        <Ligne intitule="Heure">{heureReprise(erreur.le)}</Ligne>
        <Ligne intitule="Déjà fait">
          {erreur.reussies} {erreur.reussies > 1 ? 'réussies' : 'réussie'}
        </Ligne>
        <Ligne intitule="Autres échecs en vol">{plurielAutres(erreur.autresEchecsEnVol)}</Ligne>
        <Ligne intitule="Reprise possible">
          {enPause && pauseJusqua !== null ? `à ${heureReprise(pauseJusqua)}` : repriseImpossible ? 'non, la page a été rechargée' : 'oui, tout de suite'}
        </Ligne>
      </dl>
      {repriseImpossible && (
        <p className="mt-2 text-sm text-muted">L’exécution ne peut pas reprendre après un rechargement : préparez un nouveau lot.</p>
      )}

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start">
        {bouton('reessayer', 'Réessayer cette action', choix.reessayer, () => void executer(reessayer, false), 'border-paper font-semibold')}
        {bouton('sauter-action', 'Sauter cette action', saut(choix.sauterAction), () => void executer(sauterAction, true), 'border-muted')}
        {bouton('sauter-lot', `Sauter ce lot (${nbLot} ${nbLot > 1 ? 'actions' : 'action'})`, saut(choix.sauterLot), () => void executer(sauterLot, true), 'border-muted')}
        {bouton('ignorer', 'Ignorer jusqu’à la prochaine synchro', saut(choix.ignorer), () => void executer(ignorer, true, 'Écriture impossible : rien n’a été ignoré.'), 'border-muted')}
        {bouton('arreter', 'Arrêter tout', choix.arreterTout, () => void executer(async () => arreterTout(), false), 'border-defausser text-defausser')}
        {bouton('preparer', 'Préparer un nouveau lot', choix.preparerNouveauLot, () => {
          fermer();
          onPreparer();
        }, 'border-paper font-semibold')}
        {bouton('fermer', 'Fermer', choix.fermer, fermer, 'border-muted')}
      </div>
      {message !== null && (
        <p role="alert" className="mt-3 break-words font-semibold text-defausser">
          {message}
        </p>
      )}
    </section>
  );
};

export default PanneauErreur;
