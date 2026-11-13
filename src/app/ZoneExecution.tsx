import React from 'react';
import type { EtatExec } from './useExecution';
import {
  CLASSE_ACTIF,
  CLASSE_BOUTON,
  NB,
  SUITE_INTERROMPU,
  TITRE_INTERROMPU,
  phraseProgression,
  pourcentage,
  texteEnCours,
  texteFin,
} from './apercuLot';

interface PropsZone {
  exec: EtatExec | null;
  interrompu: boolean;
  titreRef: React.RefObject<HTMLHeadingElement | null>;
  arreterRef: React.RefObject<HTMLButtonElement | null>;
  onArreter: () => void;
  onFermer: () => void;
}

/** Zone d’exécution (D-19 à D-23) : progression, arrêt, états de fin. Aucune animation (D-39). */
const ZoneExecution: React.FC<PropsZone> = ({ exec, interrompu, titreRef, arreterRef, onArreter, onFermer }) => {
  const enCours = exec?.etat.etat === 'en-cours';
  const termine = exec?.etat.etat === 'terminee';
  const fin = exec && !enCours ? texteFin(exec.etat, exec.bilan, exec.deconnecte) : null;
  const bordure = enCours ? 'border-l-paper' : termine ? 'border-l-garder' : 'border-l-defausser';
  const traitees = exec?.etat.traitees ?? 0;
  const total = exec?.etat.total ?? 0;
  const erreurs = exec?.bilan.erreurs ?? 0;
  return (
    <section
      aria-labelledby="titre-execution"
      className={`mt-4 rounded border border-line border-l-4 ${bordure} bg-ink-2 p-4`}
      data-testid="zone-execution"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && enCours) {
          e.preventDefault();
          onArreter();
        }
      }}
    >
      <h2 id="titre-execution" ref={titreRef} tabIndex={-1} className="font-semibold">
        Exécution du lot
      </h2>

      {enCours && (
        <>
          <p className="mt-2 font-semibold">
            {texteEnCours(traitees, total, erreurs)}
          </p>
          <div className="mt-2 h-2 rounded bg-line">
            <div
              role="progressbar"
              aria-label="Progression du lot"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={traitees}
              className="h-2 rounded bg-paper"
              style={{ width: `${pourcentage(traitees, total)}%` }}
            />
          </div>
          <button
            ref={arreterRef}
            type="button"
            className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-muted font-semibold`}
            onClick={onArreter}
          >
            Arrêter
          </button>
          <p className="mt-2 text-sm text-muted">Échap{NB}: arrêter le lot</p>
        </>
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="mt-2">
        {enCours && exec && <p className="text-sm text-muted">{phraseProgression(traitees, total, erreurs)}</p>}
        {fin && (
          <>
            {termine ? (
              <p>
                <span className="font-semibold text-garder">{fin.titre}</span>
                {fin.detail && `${NB}: ${fin.detail}`}
              </p>
            ) : (
              <>
                <p className="font-semibold text-defausser">{fin.titre}</p>
                {fin.detail && <p className="mt-1">{fin.detail}</p>}
              </>
            )}
            {!termine && exec?.bilan.dernierInconnu && (
              <p className="mt-1 font-semibold text-vendre">Résultat inconnu, à vérifier sur le site.</p>
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

      {!enCours && (
        <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-muted`} onClick={onFermer}>
          Fermer
        </button>
      )}
    </section>
  );
};

export default ZoneExecution;
