import { useEffect, useState } from 'react';
import type { EtatExecutionV2 } from '../lib/actions';
import { progressionExecution, progressionSynchro, type Barre, type ProgressionSynchro } from '../lib/progression';
import type { StatutSynchroV2 } from '../lib/statutSynchro';
import { chargerBailSynchro, chargerExecution, chargerStatutSynchro, ecouterExecution, ecouterSynchroAuto } from '../lib/stockage';
import { abonnerPause, contexteExecution, enPause } from './pilotageLots';

export interface Activite {
  /** Statut de synchro `en-cours` dont le bail n’a pas expiré, sinon `null`. */
  synchro: StatutSynchroV2 | null;
  /** Exécution `en-cours` (pause comprise), sinon `null`. */
  lots: EtatExecutionV2 | null;
  /** Exécution arrêtée sur erreur en attente de choix, sinon `null`. */
  erreur: EtatExecutionV2 | null;
  /** Le joueur a mis le lot en pause (mémoire de cet onglet seulement). */
  enPause: boolean;
  /** Une exécution stockée `en-cours` tient le bail mais ne tourne pas dans cet onglet : lecture seule. */
  autreOnglet: boolean;
  /** Progression de la synchro, dont le pourcentage ne recule pas dans une même étape (SC-002). */
  progSynchro: ProgressionSynchro | null;
  /** Progression de l’exécution, monotone pour un même `idLot`. */
  progLots: Barre | null;
}

const VIDE: Activite = { synchro: null, lots: null, erreur: null, enPause: false, autreOnglet: false, progSynchro: null, progLots: null };

/**
 * Activité à montrer dans le bandeau (D-21) : relit le stockage à chaque changement du statut de synchro, du bail ou
 * de l’exécution, et à l’expiration du bail. Aucune écriture ; l’état de pause n’existe qu’en mémoire (T-313).
 */
export function useActiviteSynchro(): Activite {
  const [activite, setActivite] = useState<Activite>(VIDE);

  useEffect(() => {
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const relire = async (): Promise<void> => {
      const [statut, bail, execution] = await Promise.all([
        chargerStatutSynchro().catch(() => null),
        chargerBailSynchro().catch(() => null),
        chargerExecution().catch(() => null),
      ]);
      if (!actif) return;
      clearTimeout(minuteur);
      const maintenant = Date.now();
      const synchroVive = statut !== null && statut.etat === 'en-cours' && bail !== null && bail > maintenant;
      if (synchroVive && bail !== null) minuteur = setTimeout(() => void relire(), bail - maintenant + 50);
      // Un lot qui tourne prend le bail de la synchro : bail tenu sans exécution locale = traitement d’un autre onglet.
      const bailTenu = bail !== null && bail > maintenant;
      const enCours = execution?.etat === 'en-cours';
      const local = enCours && contexteExecution().file.etat()?.etat === 'en-cours';
      const lots = enCours ? execution : null;
      const synchro = synchroVive ? statut : null;
      setActivite((avant) => {
        const cleSynchro = (s: StatutSynchroV2 | null): string => (s ? `${s.debut ?? ''}|${s.etape ?? ''}` : '');
        const precSynchro = synchro && cleSynchro(avant.synchro) === cleSynchro(synchro) ? avant.progSynchro : null;
        const precLots = lots && avant.lots?.idLot === lots.idLot ? avant.progLots : null;
        return {
          synchro,
          lots,
          erreur: execution?.etat === 'arretee' && execution.erreur !== null ? execution : null,
          enPause: local ? enPause() : false,
          autreOnglet: enCours && !local && bailTenu,
          progSynchro: synchro ? progressionSynchro(synchro, precSynchro) : null,
          progLots: lots ? progressionExecution(lots, precLots) : null,
        };
      });
    };
    void relire();
    const arrets = [ecouterSynchroAuto(() => void relire()), ecouterExecution(() => void relire()), abonnerPause(() => void relire())];
    return () => {
      actif = false;
      clearTimeout(minuteur);
      arrets.forEach((a) => a());
    };
  }, []);

  return activite;
}
