import React, { useCallback, useEffect, useState } from 'react';
import { chargerSyncAuto, ecouterSynchroAuto, enregistrerSyncAuto } from '../lib/stockage';

/** Réglage « Synchronisation automatique » des Réglages : même préférence (`syncAuto`) que l’interrupteur de l’onglet Synchro. */
const ReglageSynchroAuto: React.FC = () => {
  const [actif, setActif] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async (): Promise<void> => {
    try {
      setActif(await chargerSyncAuto());
    } catch {
      setErreur('Lecture de la préférence impossible.');
    }
  }, []);

  useEffect(() => {
    const premiere = setTimeout(() => void relire(), 0);
    const retirer = ecouterSynchroAuto(() => void relire());
    return () => {
      clearTimeout(premiere);
      retirer();
    };
  }, [relire]);

  const basculer = (suivant: boolean): void => {
    setErreur(null);
    setActif(suivant);
    enregistrerSyncAuto(suivant).catch(() => {
      setActif(!suivant);
      setErreur('Enregistrement impossible : la préférence n’a pas été changée.');
    });
  };

  return (
    <div className="py-2">
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={actif}
          onChange={(e) => basculer(e.target.checked)}
          className="size-5 accent-[var(--color-paper)] focus-visible:shadow-(--halo-focus)"
        />
        <span>Synchronisation automatique</span>
      </label>
      <p className="mt-1 text-sm text-muted">
        Lit votre collection sur WikiMasters pendant qu’un onglet du site est ouvert. Même réglage que l’interrupteur de l’onglet Synchro.
      </p>
      {erreur !== null && (
        <p role="alert" className="mt-2 font-semibold text-defausser">
          {erreur}
        </p>
      )}
    </div>
  );
};

export default ReglageSynchroAuto;
