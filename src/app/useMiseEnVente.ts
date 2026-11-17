import { useCallback, useEffect, useState } from 'react';
import {
  chargerEcartesVentes,
  chargerJournal,
  chargerLancementsVentes,
  chargerRelanceVentes,
  chargerStatutRelanceVentes,
  chargerSuiviVentes,
  ecouterEcartesVentes,
  ecouterJournal,
  ecouterLancementsVentes,
  ecouterRelanceVentes,
  ecouterStatutRelanceVentes,
  ecouterSuiviVentes,
  enregistrerEcartesVentes,
  enregistrerRelanceVentes,
  enregistrerStatutRelanceVentes,
  type StatutRelanceVentes,
} from '../lib/stockage';
import { cleVuCarte, clePasserCarte, suiviVide, type LancementVente, type SuiviVentes } from '../lib/ventes';

export interface LotJournal {
  titre: string;
  at: number;
  idLot: string;
}

export interface EtatMiseEnVente {
  suivi: SuiviVentes;
  lancements: LancementVente[];
  lots: LotJournal[];
  ecartes: Record<string, number>;
  relance: boolean;
  statut: StatutRelanceVentes | null;
  /** Horloge de la page, rafraîchie chaque seconde pour les décomptes. */
  maintenant: number;
  erreur: string | null;
  basculerRelance: (actif: boolean) => void;
  reprendre: () => void;
  continuerCarte: (titre: string, relances: number) => void;
  retirerCarte: (titre: string) => void;
  remettreCarte: (titre: string) => void;
}

/** Lecture du suivi des mises en vente et actions de l’onglet : aucune requête réseau, que du stockage local. */
export function useMiseEnVente(): EtatMiseEnVente {
  const [suivi, setSuivi] = useState<SuiviVentes>(suiviVide());
  const [lancements, setLancements] = useState<LancementVente[]>([]);
  const [lots, setLots] = useState<LotJournal[]>([]);
  const [ecartes, setEcartes] = useState<Record<string, number>>({});
  const [relance, setRelance] = useState(false);
  const [statut, setStatut] = useState<StatutRelanceVentes | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    const lire = (): void => {
      void Promise.all([
        chargerSuiviVentes(),
        chargerLancementsVentes(),
        chargerEcartesVentes(),
        chargerRelanceVentes(),
        chargerStatutRelanceVentes(),
        chargerJournal().catch(() => []),
      ])
        .then(([s, l, e, r, st, j]) => {
          if (!actif) return;
          setSuivi(s);
          setLancements(l);
          setEcartes(e);
          setRelance(r);
          setStatut(st);
          setLots(
            j
              .filter((x) => x.type === 'enchere' && x.resultat === 'reussie')
              .map((x) => ({ titre: x.titre, at: Date.parse(x.horodatage), idLot: x.idLot }))
              .filter((x) => Number.isFinite(x.at)),
          );
        })
        .catch(() => {
          if (actif) setErreur('Le suivi des mises en vente n’a pas pu être lu.');
        });
    };
    lire();
    const arrets = [ecouterSuiviVentes(lire), ecouterLancementsVentes(lire), ecouterEcartesVentes(lire), ecouterRelanceVentes(lire), ecouterStatutRelanceVentes(lire), ecouterJournal(lire)];
    const horloge = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => {
      actif = false;
      arrets.forEach((a) => a());
      clearInterval(horloge);
    };
  }, []);

  const echec = useCallback((): void => setErreur('Le réglage n’a pas pu être enregistré.'), []);
  const ecrireEcartes = useCallback(
    (suite: (e: Record<string, number>) => Record<string, number>): void => {
      void chargerEcartesVentes()
        .then((e) => enregistrerEcartesVentes(suite(e)))
        .catch(echec);
    },
    [echec],
  );

  return {
    suivi,
    lancements,
    lots,
    ecartes,
    relance,
    statut,
    maintenant,
    erreur,
    basculerRelance: (actif) => {
      setErreur(null);
      void enregistrerRelanceVentes(actif)
        // Activer ou couper la relance repart d’un état propre : un arrêt ou une pause précédente est levé par le joueur.
        .then(() => enregistrerStatutRelanceVentes({ etat: 'attente', message: actif ? 'Relance activée' : 'Relance désactivée', jusqua: null, echecs: 0, maj: Date.now() }))
        .catch(echec);
    },
    reprendre: () => {
      void enregistrerStatutRelanceVentes({ etat: 'attente', message: 'Relance reprise par le joueur', jusqua: null, echecs: 0, maj: Date.now() }).catch(echec);
    },
    continuerCarte: (titre, relances) => ecrireEcartes((e) => ({ ...e, [cleVuCarte(titre)]: relances })),
    retirerCarte: (titre) => ecrireEcartes((e) => ({ ...e, [clePasserCarte(titre)]: Date.now() })),
    remettreCarte: (titre) =>
      ecrireEcartes((e) => {
        const { [clePasserCarte(titre)]: _retire, ...reste } = e;
        void _retire;
        return reste;
      }),
  };
}
