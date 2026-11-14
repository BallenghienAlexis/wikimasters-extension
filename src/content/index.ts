// Content script : plus de lecture ni de repère sur les pages de WikiMasters (Alexis, 2026-11-14) ; il ne fait que
// démarrer l’exécutant des lots et la synchronisation automatique. Il ne clique sur rien et ne change pas de page.
import { TABLE_CONTRAT } from '../lib/contrat';
import { creerEmetteur } from '../lib/reseau';
import { demarrerExecutant } from './executant';
import { demarrerSynchroAuto } from './synchroAuto';

// Pilotage depuis la page de gestion : aucune requête tant qu'aucune action n'est branchée.
demarrerExecutant({ emettre: creerEmetteur({ table: TABLE_CONTRAT, origineOnglet: location.origin }) });
// Lecture automatique de la collection par l'API du site : activée par défaut, 0 requête si le joueur coupe l'option.
demarrerSynchroAuto();
