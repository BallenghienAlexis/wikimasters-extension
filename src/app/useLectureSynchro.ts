import { useCallback, useEffect, useState } from 'react';
import type { EtatOrdonnanceur } from '../lib/ordonnanceur';
import {
  chargerBailSynchro,
  chargerDerniereSynchro,
  chargerEtatSynchro,
  chargerStatutSynchro,
  chargerSyncAuto,
  ecouterSynchroAuto,
} from '../lib/stockage';
import type { StatutSynchroV2 } from '../lib/statutSynchro';
import type { PastilleSynchro } from '../lib/tableauDeBord';

/** Relecture périodique : l’expiration du bail ou de la pause se constate sans événement. */
const RELECTURE_MS = 15_000;

export interface LectureSynchro {
  activee: boolean;
  statut: StatutSynchroV2 | null;
  bail: number | null;
  derniere: number | null;
  etat: EtatOrdonnanceur | null;
  maintenant: number;
}

const LECTURE_INITIALE: LectureSynchro = { activee: true, statut: null, bail: null, derniere: null, etat: null, maintenant: 0 };

/** Pastille D-40 déduite du statut, du bail et de la pause. Une lecture illisible n’empêche pas l’affichage. */
export function pastilleDe(l: LectureSynchro): PastilleSynchro {
  const { activee, statut, bail, etat, maintenant } = l;
  if (!activee) return 'arretee';
  if (statut?.etat === 'en-cours' && bail !== null && bail > maintenant) return 'en-cours';
  if (statut?.etat === 'arret' && statut.raison !== 'manuel') return 'erreur';
  if (statut?.etat === 'arret' || (etat?.arretJusqua ?? 0) > maintenant) return 'arretee';
  return 'a-jour';
}

export function useLectureSynchro(): LectureSynchro {
  const [lecture, setLecture] = useState<LectureSynchro>(LECTURE_INITIALE);
  const relire = useCallback(async (): Promise<void> => {
    const sans = <T,>(p: Promise<T>, defaut: T): Promise<T> => p.catch(() => defaut);
    const [activee, statut, bail, derniere, etat] = await Promise.all([
      sans(chargerSyncAuto(), true),
      sans(chargerStatutSynchro(), null),
      sans(chargerBailSynchro(), null),
      sans(chargerDerniereSynchro(), null),
      sans(chargerEtatSynchro(), null),
    ]);
    setLecture({ activee, statut, bail, derniere, etat, maintenant: Date.now() });
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
  return lecture;
}

