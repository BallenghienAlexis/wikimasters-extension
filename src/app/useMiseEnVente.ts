import { useCallback, useEffect, useState } from 'react';
import {
  chargerEcartesVentes,
  chargerEtatSuiviVentes,
  chargerJournal,
  chargerLancementsVentes,
  chargerRelanceVentes,
  chargerStatutRelanceVentes,
  chargerSuiviVentes,
  chargerSuiviVentesActif,
  ecouterEcartesVentes,
  ecouterEtatSuiviVentes,
  ecouterJournal,
  ecouterLancementsVentes,
  ecouterRelanceVentes,
  ecouterStatutRelanceVentes,
  ecouterSuiviVentes,
  ecouterSuiviVentesActif,
  enregistrerEcartesVentes,
  enregistrerSignalSuiviVentes,
  enregistrerSuiviVentesActif,
  enregistrerRelanceVentes,
  enregistrerStatutRelanceVentes,
  type EtatSuiviVentes,
  type StatutRelanceVentes,
} from '../lib/stockage';
import { cleVuCarte, clePasserCarte, purgerEcartes, suiviVide, type LancementVente, type SuiviVentes } from '../lib/ventes';

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
  /** Synchro autonome du suivi : interrupteur, état de santé et bouton « Forcer » propres (indépendants de la synchro globale). */
  suiviActif: boolean;
  etatSuivi: EtatSuiviVentes | null;
  basculerSuivi: (actif: boolean) => void;
  forcerSuivi: () => void;
  /** Horloge de la page, rafraîchie chaque seconde pour les décomptes. */
  maintenant: number;
  erreur: string | null;
  basculerRelance: (actif: boolean) => void;
  passerExemplaire: (idExemplaire: string) => void;
  continuerAttendre: (idExemplaire: string, essais: number) => void;
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
  const [suiviActif, setSuiviActif] = useState(true);
  const [etatSuivi, setEtatSuivi] = useState<EtatSuiviVentes | null>(null);
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
        chargerSuiviVentesActif(),
        chargerEtatSuiviVentes(),
        chargerJournal().catch(() => []),
      ])
        .then(([s, l, e, r, st, sa, es, j]) => {
          if (!actif) return;
          setSuivi(s);
          setLancements(l);
          setEcartes(e);
          setRelance(r);
          setStatut(st);
          setSuiviActif(sa);
          setEtatSuivi(es);
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
    const arrets = [ecouterSuiviVentes(lire), ecouterLancementsVentes(lire), ecouterEcartesVentes(lire), ecouterRelanceVentes(lire), ecouterStatutRelanceVentes(lire), ecouterSuiviVentesActif(lire), ecouterEtatSuiviVentes(lire), ecouterJournal(lire)];
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
        .then((e) => enregistrerEcartesVentes(purgerEcartes(suite(e), Date.now())))
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
    suiviActif,
    etatSuivi,
    maintenant,
    erreur,
    basculerSuivi: (actif) => {
      setErreur(null);
      void enregistrerSuiviVentesActif(actif).catch(echec);
    },
    // « Forcer » : simple signal au content script (aucune requête depuis cette page) ; il applique la limite d’une demande par minute.
    forcerSuivi: () => {
      setErreur(null);
      void enregistrerSignalSuiviVentes(Date.now()).catch(echec);
    },
    basculerRelance: (actif) => {
      setErreur(null);
      void enregistrerRelanceVentes(actif)
        // Activer ou couper la relance repart d’un état propre : un arrêt ou une pause précédente est levé par le joueur.
        .then(async () => {
          // Une pause en cours (401, 429, attente après échec) n’est jamais levée par le basculement de l’interrupteur.
          const actuel = await chargerStatutRelanceVentes();
          if (actuel?.etat === 'pause' && actuel.jusqua !== null && actuel.jusqua > Date.now()) return;
          await enregistrerStatutRelanceVentes({ etat: 'attente', message: actif ? 'Relance activée' : 'Relance désactivée', jusqua: null, echecs: 0, maj: Date.now(), carte: null });
        })
        .catch(echec);
    },
    // « Passer cette carte » : l’exemplaire n’est plus retenté avant un jour ; l’avertissement disparaît avec le prochain statut.
    passerExemplaire: (idExemplaire) => {
      ecrireEcartes((e) => ({ ...e, [idExemplaire]: Date.now() + 24 * 3600_000 }));
      // Le statut garde son état et son échéance : « Passer » ne lève jamais une pause (401, 429) en cours.
      void chargerStatutRelanceVentes()
        .then((actuel) => enregistrerStatutRelanceVentes(actuel === null ? { etat: 'attente', message: 'Carte passée par le joueur', jusqua: null, echecs: 0, maj: Date.now(), carte: null } : { ...actuel, message: 'Carte passée par le joueur', maj: Date.now(), carte: null }))
        .catch(echec);
    },
    // « Continuer d’attendre » : masque l’avertissement jusqu’à 5 nouveaux échecs de la même carte.
    continuerAttendre: (idExemplaire, essais) => ecrireEcartes((e) => ({ ...e, [`attend:${idExemplaire}`]: essais })),
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
