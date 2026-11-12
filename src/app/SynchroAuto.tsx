import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Collection } from '../lib/collection';
import { calculerEcarts, type EcartCarte } from '../lib/ecarts';
import {
  chargerBailSynchro,
  chargerDerniereSynchro,
  chargerStatutSynchro,
  chargerSyncAuto,
  ecouterSynchroAuto,
  enregistrerArretSynchro,
  enregistrerSyncAuto,
  type StatutSynchro,
} from '../lib/stockage';
import type { CacheWikipedia } from '../lib/wikipedia';
import type { Preferences } from '../lib/tri';

/** Espace insécable : typographie française avant « : » et autour de « h ». */
const NB = ' ';

/** Écarts affichés d’abord, puis ajoutés à chaque « Afficher 50 de plus ». */
const PAS_ECARTS = 50;

/** Relecture du stockage : l’expiration du bail se constate sans événement. */
const RELECTURE_MS = 15_000;

const deux = (n: number): string => String(n).padStart(2, '0');

/** « 16 h 42 », en heure locale. */
const heureFr = (t: number): string => {
  const d = new Date(t);
  return `${deux(d.getHours())}${NB}h${NB}${deux(d.getMinutes())}`;
};

/** « 09/11/2026 à 16 h 42 », en heure locale. */
const dateHeureFr = (t: number): string => {
  const d = new Date(t);
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${heureFr(t)}`;
};

const accorder = (n: number, singulier: string, pluriel: string): string => `${n} ${n > 1 ? pluriel : singulier}`;

export interface EntreeEtat {
  actif: boolean;
  statut: StatutSynchro | null;
  /** Expiration du bail de synchronisation, ou `null`. */
  bail: number | null;
  maintenant: number;
}

/** Une synchro tourne seulement si le bail est tenu : un statut « en cours » resté après la fermeture de l’onglet est périmé. */
export const synchroEnCours = ({ actif, statut, bail, maintenant }: EntreeEtat): boolean =>
  actif && statut?.etat === 'en-cours' && bail !== null && bail > maintenant;

/** Ligne d’état de D-01 : toujours un texte, jamais seulement une couleur. */
export function texteEtatSynchro(entree: EntreeEtat): string {
  if (!entree.actif) return 'Désactivée';
  const { statut } = entree;
  if (statut !== null && synchroEnCours(entree)) {
    if (statut.page === null) return 'En cours';
    return statut.pages === null ? `En cours${NB}: page ${statut.page}` : `En cours${NB}: page ${statut.page} sur ${statut.pages}`;
  }
  if (statut?.etat === 'termine') return `Terminée à ${heureFr(statut.le)}`;
  if (statut?.etat === 'arret') {
    if (statut.raison === 'code-http' && statut.codeHttp !== null) return `Arrêtée${NB}: le site a refusé (${statut.codeHttp})`;
    if (statut.raison === 'manuel') return 'Arrêtée par vous';
    return `Arrêtée${NB}: la lecture a échoué`;
  }
  return 'En attente d’un onglet WikiMasters';
}

/** Dernière synchro terminée : date, puis le détail quand le dernier statut est celui de cette synchro. */
export function texteDerniereSynchro(derniere: number | null, statut: StatutSynchro | null): string {
  if (derniere === null) return 'Aucune synchronisation pour l’instant.';
  const base = `Dernière synchro${NB}: ${dateHeureFr(derniere)}`;
  if (statut?.etat !== 'termine') return base;
  return [
    base,
    `${accorder(statut.ajoutees, 'carte', 'cartes')} ${statut.ajoutees > 1 ? 'ajoutées' : 'ajoutée'}`,
    `${accorder(statut.etiquettes, 'étiquette', 'étiquettes')} ${statut.etiquettes > 1 ? 'lues' : 'lue'}`,
    `${accorder(statut.prix, 'prix', 'prix')} ${statut.prix > 1 ? 'relevés' : 'relevé'}`,
  ].join(' · ');
}

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink px-4';

export interface VueSynchroAutoProps {
  actif: boolean;
  statut: StatutSynchro | null;
  bail: number | null;
  derniere: number | null;
  maintenant: number;
  ecarts: readonly EcartCarte[];
  onBascule: (actif: boolean) => void;
  onArreter: () => void;
  /** Message d’échec d’écriture ou de lecture, affiché tel quel. */
  erreur?: string | null;
}

/** Vue sans accès au stockage : les noms d’étiquettes du site sont toujours rendus comme du texte. */
export const VueSynchroAuto: React.FC<VueSynchroAutoProps> = ({ actif, statut, bail, derniere, maintenant, ecarts, onBascule, onArreter, erreur = null }) => {
  const [limite, setLimite] = useState(PAS_ECARTS);
  const entree: EntreeEtat = { actif, statut, bail, maintenant };
  const enCours = synchroEnCours(entree);

  return (
    <section aria-labelledby="titre-synchro-auto" className="mt-4 rounded border border-line bg-ink-2 p-4" data-testid="synchro-auto">
      <h2 id="titre-synchro-auto" className="font-semibold">
        Synchronisation automatique
      </h2>
      <p className="mt-1 text-sm text-muted">
        Lit votre collection sur WikiMasters pendant qu’un onglet du site est ouvert : une requête toutes les 0,2 à 0,3 s, arrêt immédiat si le site refuse. Rien n’est modifié sur le site.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={actif}
          aria-labelledby="titre-synchro-auto"
          aria-describedby="etat-synchro-auto"
          className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded border border-line bg-ink px-4"
          onClick={() => onBascule(!actif)}
        >
          <span
            aria-hidden="true"
            className={`relative inline-block h-6 w-11 shrink-0 rounded-full border border-line motion-safe:transition-colors ${actif ? 'bg-garder' : 'bg-ink-2'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full motion-safe:transition-all ${actif ? 'left-6 bg-ink' : 'left-0.5 bg-paper'}`}
            />
          </span>
          <span>{actif ? 'Activée' : 'Désactivée'}</span>
        </button>

        {enCours && (
          <button type="button" className={CLASSE_BOUTON} onClick={onArreter}>
            Arrêter
          </button>
        )}
      </div>

      <p id="etat-synchro-auto" aria-live="polite" className="mt-3 font-medium" data-testid="etat-synchro-auto">
        {texteEtatSynchro(entree)}
      </p>
      {enCours && (
        <p aria-hidden="true" className="mt-1 text-muted motion-safe:animate-pulse">
          …
        </p>
      )}
      {erreur !== null && (
        <p role="alert" className="mt-2 font-semibold text-defausser">
          {erreur}
        </p>
      )}

      <p className="mt-2 text-sm" data-testid="derniere-synchro">
        {texteDerniereSynchro(derniere, statut)}
      </p>

      <h3 className="mt-4 font-semibold">Écarts avec le site</h3>
      {ecarts.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Aucun écart.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Étiquettes attendues d’après vos décisions, comparées à celles lues sur le site. Lecture seule : rien n’est posé ni retiré.
          </p>
          <ul className="mt-2 divide-y divide-line border-y border-line" data-testid="ecarts">
            {ecarts.slice(0, limite).map((e) => (
              <li key={e.idCarte} className="py-2 text-sm">
                <p className="break-words font-medium">{e.titre}</p>
                {e.manquantes.length > 0 && (
                  <p className="break-words">
                    <span className="text-muted">Attendue, absente du site{NB}: </span>
                    {e.manquantes.join(', ')}
                  </p>
                )}
                {e.enTrop.length > 0 && (
                  <p className="break-words">
                    <span className="text-muted">Présente sur le site, non attendue{NB}: </span>
                    {e.enTrop.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {ecarts.length > limite && (
            <button type="button" className={`${CLASSE_BOUTON} mt-3`} onClick={() => setLimite(limite + PAS_ECARTS)}>
              Afficher {PAS_ECARTS} de plus ({ecarts.length - limite} restants)
            </button>
          )}
        </>
      )}
    </section>
  );
};

interface Props {
  collection: Collection;
  preferences: Preferences;
  cacheWiki: CacheWikipedia;
}

/** Section « Synchronisation automatique » : lit l’état dans le stockage, écrit seulement la préférence et la demande d’arrêt. */
const SynchroAuto: React.FC<Props> = ({ collection, preferences, cacheWiki }) => {
  const [actif, setActif] = useState(false);
  const [statut, setStatut] = useState<StatutSynchro | null>(null);
  const [bail, setBail] = useState<number | null>(null);
  const [derniere, setDerniere] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async (): Promise<void> => {
    try {
      const [a, s, b, d] = await Promise.all([chargerSyncAuto(), chargerStatutSynchro(), chargerBailSynchro(), chargerDerniereSynchro()]);
      setActif(a);
      setStatut(s);
      setBail(b);
      setDerniere(d);
      setMaintenant(Date.now());
    } catch {
      setErreur('Lecture de l’état de la synchronisation impossible.');
    }
  }, []);

  useEffect(() => {
    const premiere = setTimeout(() => void relire(), 0);
    const minuteur = setInterval(() => void relire(), RELECTURE_MS);
    const retirer = ecouterSynchroAuto(() => void relire());
    return () => {
      clearTimeout(premiere);
      clearInterval(minuteur);
      retirer();
    };
  }, [relire]);

  const ecarts = useMemo(() => calculerEcarts(collection.cartes, { amis: preferences.amis }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cacheWiki` change les thèmes lus par `themesDeCarte`.
    [collection.cartes, preferences.amis, cacheWiki]);

  const basculer = (suivant: boolean): void => {
    setErreur(null);
    setActif(suivant);
    enregistrerSyncAuto(suivant).catch(() => {
      setActif(!suivant);
      setErreur('Enregistrement impossible : la préférence n’a pas été changée.');
    });
  };
  const arreter = (): void => {
    setErreur(null);
    enregistrerArretSynchro(Date.now()).catch(() => setErreur('La demande d’arrêt n’a pas pu être enregistrée.'));
  };

  return (
    <VueSynchroAuto
      actif={actif}
      statut={statut}
      bail={bail}
      derniere={derniere}
      maintenant={maintenant}
      ecarts={ecarts}
      onBascule={basculer}
      onArreter={arreter}
      erreur={erreur}
    />
  );
};

export default SynchroAuto;
