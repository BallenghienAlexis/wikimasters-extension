import { useCallback, useEffect, useState } from 'react';
import { chargerSyncAuto, ecouterSynchroAuto, enregistrerSyncAuto } from '../lib/stockage';

export interface EtatSyncAuto {
  /** `null` tant que la préférence n’est pas lue, ou si la lecture a échoué (la valeur par défaut est « activée », pas « coupée »). */
  actif: boolean | null;
  erreur: string | null;
  basculer: (suivant: boolean) => void;
}

/** Préférence « Synchronisation automatique » (`syncAuto`) : lecture, écoute des autres onglets et de l’onglet Synchro, écriture avec retour arrière. */
export function useSyncAuto(): EtatSyncAuto {
  const [actif, setActif] = useState<boolean | null>(null);
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

  const basculer = useCallback((suivant: boolean): void => {
    setErreur(null);
    setActif(suivant);
    enregistrerSyncAuto(suivant).catch(() => {
      setActif(!suivant);
      setErreur('Enregistrement impossible : la préférence n’a pas été changée.');
    });
  }, []);

  return { actif, erreur, basculer };
}
