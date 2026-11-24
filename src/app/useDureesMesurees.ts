import { useEffect } from 'react';
import { definirMesures, mesuresVides } from '../lib/durees';
import { chargerDureesMesurees, ecouterDureesMesurees } from '../lib/stockage';

/**
 * Charge les durées mesurées (clé `dureesMesurees`) et les met à disposition des estimations de temps (`secondesPar`).
 * Illisible ou indisponible : aucune mesure, tarifs par défaut. Aucune requête.
 */
export function useDureesMesurees(): void {
  useEffect(() => {
    let actif = true;
    const relire = (): void => {
      void chargerDureesMesurees()
        .then((m) => {
          if (actif) definirMesures(m);
        })
        .catch(() => {
          if (actif) definirMesures(mesuresVides());
        });
    };
    relire();
    const arreter = ecouterDureesMesurees(relire);
    return () => {
      actif = false;
      arreter();
    };
  }, []);
}
