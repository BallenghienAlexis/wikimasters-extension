// Content script : plus de lecture ni de repère sur les pages de WikiMasters (Alexis, 2026-11-14) ; il ne fait que
// démarrer l’exécutant des lots, la synchronisation automatique et le suivi des mises en vente (2026-11-17).
// Il ne clique sur rien et ne change pas de page.
import { CONFIG_AFFLUENCE } from '../config/affluence';
import { TABLE_CONTRAT } from '../lib/contrat';
import { gigueAleatoire } from '../lib/gigue';
import { creerEmetteur } from '../lib/reseau';
import { creerVerrouRequete } from '../lib/verrouRequete';
import { INTERVALLE_MS } from '../lib/file';
import {
  ajouterLancementVente,
  chargerBailSuivi,
  chargerEtatSuiviVentes,
  chargerSuiviVentesActif,
  chargerVerrouRequete,
  ecouterSignalSuiviVentes,
  enregistrerBailSuivi,
  enregistrerEtatSuiviVentes,
  enregistrerVerrouRequete,
  chargerCollection,
  chargerEcartesVentes,
  chargerEvenementsAffluence,
  chargerExecution,
  chargerEtatSynchro,
  chargerLancementsVentes,
  chargerPreferences,
  chargerRelanceVentes,
  chargerStatutRelanceVentes,
  chargerSuiviVentes,
  enregistrerEcartesVentes,
  enregistrerEtatSynchro,
  enregistrerStatutRelanceVentes,
  enregistrerSuiviVentes,
} from '../lib/stockage';
import { demarrerExecutant } from './executant';
import { demarrerSynchroAuto, horlogeReelle, transportSite } from './synchroAuto';
import { creerSuiviVentes, demarrerSuiviVentes } from './suiviVentes';

// Verrou de requête : une seule requête en vol vers le site entre la synchro globale (lectures) et le suivi des ventes,
// 0,2 s plus gigue entre deux débuts. Tenu le temps d’une requête seulement : aucun des deux n’attend la fin de l’autre.
const verrou = creerVerrouRequete({
  now: () => Date.now(),
  attendre: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  gigue: gigueAleatoire,
  intervalle: INTERVALLE_MS,
  lire: chargerVerrouRequete,
  ecrire: enregistrerVerrouRequete,
  identifiant: () => Math.random().toString(36).slice(2, 12),
});
const emettre = creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: location.origin });

// Pilotage depuis la page de gestion : aucune requête tant qu'aucune action n'est branchée.
demarrerExecutant({ emettre });
// Lecture automatique de la collection par l'API du site : activée par défaut, 0 requête si le joueur coupe l'option.
// Le suivi est créé d’abord : la synchro lui confie la réponse du listing du marché qu’elle relève déjà.
const suivi = creerSuiviVentes({
  horloge: horlogeReelle,
  gigue: gigueAleatoire,
  transport: transportSite,
  emettre,
  visible: () => document.visibilityState === 'visible',
  actif: chargerSuiviVentesActif,
  verrou,
  chargerEtatSuivi: chargerEtatSuiviVentes,
  enregistrerEtatSuivi: enregistrerEtatSuiviVentes,
  lotEnCours: async () => (await chargerExecution().catch(() => null))?.etat === 'en-cours',
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
  chargerEvenementsAffluence,
  enregistrerEcartes: enregistrerEcartesVentes,
  pauseLots: async () => (await chargerExecution().catch(() => null))?.pauseJusqua ?? null,
  chargerEtat: chargerEtatSynchro,
  enregistrerEtat: enregistrerEtatSynchro,
  bail: { lire: chargerBailSuivi, ecrire: enregistrerBailSuivi },
});
// Synchro globale : activée par défaut, 0 requête si le joueur coupe l'option. Le suivi des ventes a son propre interrupteur.
demarrerSynchroAuto({ surReponseMarche: suivi.integrer, transport: (chemin) => verrou(() => transportSite(chemin)) });
// Suivi des mises en vente (lecture toutes les 5 min, puis 10 s dans la dernière minute) et relance automatique si activée.
demarrerSuiviVentes({
  suivi,
  visible: () => document.visibilityState === 'visible',
  ecouterVisibilite: (rappel) => {
    document.addEventListener('visibilitychange', rappel);
    return () => document.removeEventListener('visibilitychange', rappel);
  },
});
// Bouton « Forcer » du suivi (onglet Mise en vente) : un passage tout de suite, même si l’onglet WikiMasters est en arrière-plan.
ecouterSignalSuiviVentes(() => void suivi.forcer().catch(() => undefined));
