import { useEffect, useState } from 'react';
import type { EvenementVente } from '../lib/affluence';
import { compterParJour, evenementsActivite, fusionnerActiviteJours, type ActiviteJours } from '../lib/graphiquesTableauDeBord';
import {
  chargerActiviteQuotidienne,
  chargerEvenementsAffluence,
  chargerJournal,
  chargerLancementsVentes,
  chargerResultatsVentes,
  ecouterActiviteQuotidienne,
  ecouterJournal,
  ecouterLancementsVentes,
  ecouterSuiviVentes,
  enregistrerActiviteQuotidienne,
} from '../lib/stockage';

export interface DonneesGraphiques {
  activite: ActiviteJours;
  /** Évènements d’affluence (enchères terminées, ventes notées) : source du profil de la semaine. */
  affluence: EvenementVente[];
  prete: boolean;
}

const egales = (a: ActiviteJours, b: ActiviteJours): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lit les données des graphiques du Tableau de bord (stockage local seulement, aucune requête) : l’activité par jour est
 * recalculée d’après le journal, les relances et les enchères terminées, puis fusionnée (le plus grand compte par jour) avec
 * celle déjà gardée, qui survit au plafond du journal et voyage dans la sauvegarde. Une lecture impossible laisse l’existant.
 */
export function useDonneesGraphiques(): DonneesGraphiques {
  const [etat, setEtat] = useState<DonneesGraphiques>({ activite: {}, affluence: [], prete: false });

  useEffect(() => {
    let vivant = true;
    const relire = async (): Promise<void> => {
      const [journal, lancements, resultats, gardee, affluence] = await Promise.all([
        chargerJournal().catch(() => []),
        chargerLancementsVentes().catch(() => []),
        chargerResultatsVentes().catch(() => []),
        chargerActiviteQuotidienne().catch(() => ({})),
        chargerEvenementsAffluence().catch(() => []),
      ]);
      const activite = fusionnerActiviteJours(gardee, compterParJour(evenementsActivite(journal, lancements, resultats)));
      if (!egales(activite, gardee)) await enregistrerActiviteQuotidienne(activite).catch(() => undefined);
      if (vivant) setEtat({ activite, affluence, prete: true });
    };
    const lancer = (): void => void relire().catch(() => undefined);
    lancer();
    const arrets = [ecouterJournal(lancer), ecouterLancementsVentes(lancer), ecouterSuiviVentes(lancer), ecouterActiviteQuotidienne(lancer)];
    return () => {
      vivant = false;
      arrets.forEach((a) => a());
    };
  }, []);

  return etat;
}
