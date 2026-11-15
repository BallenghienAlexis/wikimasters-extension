# Retouches — fiabilité des étiquettes (PR #144)

## À reprendre

- `src/app/GestionAmis.tsx:63` : test de rendu vérifiant que les étiquettes de l’extension (« #Chien », « #À classer », « #À échanger … ») ne sont pas proposées aux amis alors qu’une étiquette du joueur l’est.
- `src/lib/themes.ts:320-336` : test figeant le repli du filtre des noms propres quand `normaliser` change la longueur du texte (ligature « œ »).
- Captures de Réglages › Thèmes aux 3 breakpoints, et passage de `npm run test:e2e` en local (le navigateur de la session ne correspond pas à la version de Playwright ; la CI l’exécute).

## À reprendre (PR #146, lecture par le sens)

- `src/app/verifierWikipedia.ts` (`lireEnrichissement`) : couper l’enrichissement Wikidata après 3 échecs d’affilée (5xx, réseau, JSON illisible) jusqu’au rechargement ; aujourd’hui seuls 403 et 429 arrêtent (mineur de `security-reviewer`).
- `src/lib/themes.ts` (motif `informatique`, mot-clé « programm ») : « Programme Apollo » donne #Informatique (Neil Armstrong) ; resserrer le motif (hors périmètre, motif existant).
- `src/app/SynchroAuto.tsx:268` et `src/lib/tableauDeBord.ts:67` : passer `registre` à `calculerEcarts` pour que les étiquettes refusées ne comptent pas non plus comme écarts (déjà fait dans `PanneauApercuLot.tsx`).
- `src/app/pilotageLots.ts` (`retraitsManuels`) : la marque d’un retrait voulu par le joueur vit en mémoire ; perdue si la page est rechargée avant le résultat. Porter l’origine sur l’action (champ facultatif) demande de toucher `messages.ts`.
- `src/lib/themes.ts:124-136` (nouveaux thèmes Pornographie, Sexualité, Drogue, Armes) : ces étiquettes seront posées et visibles des autres joueurs après « Lancer » (l’aperçu les montre). Décision d’Alexis à prendre : les garder, ou les exclure des étiquettes posées sur le site.
- `src/lib/themes.ts` (motif `cafe`, `(?! de )`) : « un café de Colombie » ne donne plus #Boissons ; compromis voulu pour écarter « Café de Flore ». À réévaluer si des cartes de café sont mal classées.

## À reprendre (PR « jamais À classer »)

- Cause probable des cartes sans thème : la vérification Wikipédia/Wikidata ne couvre que les cartes affichées dans la liste (AGENTS.md § Vérification Wikipédia). Étendre à toutes les cartes en arrière-plan attend la décision d’Alexis (carte de décision dans le fil).
- « Attendue, absente du site » pour les « #À échanger <ami> » : ce sont des poses jamais lancées (le lot compare au registre), pas une erreur de calcul ; à confirmer sur le PC d’Alexis (limite de noms du compte, lot non lancé).
- Faux positifs à mesurer avec Wikipédia (Hitler #Littérature, Marcel Rufo #Éducation/#Littérature, Millet #Langue, David Cobb #Écologie) : le réseau du cloud n’atteint pas Wikipédia.

## À reprendre (PR « classement par l’API Claude »)

- `src/app/ClassementIA.tsx` : pas de test de rendu ni de capture aux 3 breakpoints (Réglages › Classement par l’IA) ; le parcours est couvert côté logique (`tests/unit/classification-ia.test.ts`). À faire avec un e2e simulant l’API.
- `src/lib/classificationIA.ts` (`PRIX_ENTREE_MTOK`, `PRIX_SORTIE_MTOK`) : tarifs estimés à confirmer sur la console Anthropic ; l’estimation n’est qu’un ordre de grandeur.
- Entrées de cache vides (« sujet non reconnu ») : aucun bouton pour les reclasser ; à ajouter si Alexis en a besoin.
- Mesure de qualité sur les cas d’Alexis (Novelists, Morcilla, Honda CB 900, Tesla Semi, Software as a service, Hydravion, Hitler, Millet) : à faire une fois la clé saisie, hors du cloud.
- Une carte classée par l’IA avec un thème erroné ne peut pas être corrigée à la main (pas d’édition de thème) ; la retirer du cache = supprimer la clé `classementIA`.

## À reprendre (PR « classement automatique sans clé »)
- Aucun test e2e du bouton d’export ni de l’import de fichier dans Réglages › Classement par l’IA (`ClassementIA.tsx`) : logique couverte en unitaire (`lireImportThemes`, `exporterCartesAClasser`).
- La lecture de fond est testée en unitaire (`creerPlanificateur`, file de fond) et par les e2e SC-011 adaptés ; pas de test de durée sur 2 600 cartes.
- Cartes sans page Wikipédia ni description Wikidata exploitable : restent sans thème (signalées, jamais « À classer »), sauf import ou API.
- Modèle intégré à Chrome (Prompt API) : à étudier seulement si Alexis le demande.
