// Content script : plus de lecture ni de repère sur les pages de WikiMasters (Alexis, 2026-11-14) ; il ne fait que
// démarrer l’exécutant des lots, la synchronisation automatique et le suivi des mises en vente (2026-11-17).
// Il ne clique sur rien et ne change pas de page.
import { CONFIG_AFFLUENCE } from '../config/affluence';
import { TABLE_CONTRAT } from '../lib/contrat';
import { gigueAleatoire } from '../lib/gigue';
import { creerEmetteur } from '../lib/reseau';
import {
  ajouterLancementVente,
  chargerBailSynchro,
  chargerCollection,
  chargerEcartesVentes,
  chargerEtatSynchro,
  chargerLancementsVentes,
  chargerPreferences,
  chargerRelanceVentes,
  chargerStatutRelanceVentes,
  chargerSuiviVentes,
  enregistrerBailSynchro,
  enregistrerEcartesVentes,
  enregistrerEtatSynchro,
  enregistrerStatutRelanceVentes,
  enregistrerSuiviVentes,
} from '../lib/stockage';
import { demarrerExecutant } from './executant';
import { demarrerSynchroAuto, horlogeReelle, transportSite } from './synchroAuto';
import { creerSuiviVentes, demarrerSuiviVentes } from './suiviVentes';

const emettre = creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: location.origin });

// Pilotage depuis la page de gestion : aucune requête tant qu'aucune action n'est branchée.
demarrerExecutant({ emettre });
// Lecture automatique de la collection par l'API du site : activée par défaut, 0 requête si le joueur coupe l'option.
demarrerSynchroAuto();
// Suivi des mises en vente (lecture toutes les 5 min, puis 10 s dans la dernière minute) et relance automatique si activée.
demarrerSuiviVentes({
  suivi: creerSuiviVentes({
    horloge: horlogeReelle,
    gigue: gigueAleatoire,
    transport: transportSite,
    emettre,
    visible: () => document.visibilityState === 'visible',
    route: CONFIG_AFFLUENCE.routeMarche,
    relanceActive: chargerRelanceVentes,
    chargerSuivi: chargerSuiviVentes,
    enregistrerSuivi: enregistrerSuiviVentes,
    chargerStatut: chargerStatutRelanceVentes,
    enregistrerStatut: enregistrerStatutRelanceVentes,
    chargerCollection,
    chargerPreferences,
    chargerLancements: chargerLancementsVentes,
    ajouterLancement: ajouterLancementVente,
    chargerEcartes: chargerEcartesVentes,
    enregistrerEcartes: enregistrerEcartesVentes,
    chargerEtat: chargerEtatSynchro,
    enregistrerEtat: enregistrerEtatSynchro,
    bail: { lire: chargerBailSynchro, ecrire: enregistrerBailSynchro },
  }),
  visible: () => document.visibilityState === 'visible',
  ecouterVisibilite: (rappel) => {
    document.addEventListener('visibilitychange', rappel);
    return () => document.removeEventListener('visibilitychange', rappel);
  },
});
