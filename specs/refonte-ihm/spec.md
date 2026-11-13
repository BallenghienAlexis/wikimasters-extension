# Spec — Refonte de l’interface de gestion

- **Feature** : `refonte-ihm` · **Date** : 2026-11-13
- **Besoin d’origine** (Alexis) : « plus de détail, une meilleure lisibilité, une meilleure organisation ; des dashboards complets et simples à comprendre sur les différentes données ; le détail complet de la synchro avec une barre de progression ; le détail des tâches en cours et à réaliser ; en cas d’erreur, voir sur quelle action, avec le détail complet, et choisir de sauter pour la prochaine synchro ou le prochain lot. Commence par le design. »
- **Validation** : voir `STATUS.md`. **Aucun code d’interface avant validation du design.**

## 0. État des lieux
`collection.html` est une page unique (`src/app/App.tsx`, 403 lignes) qui empile ~10 sections : Sauvegarde, Assistant de tri, File de vente, Plafond de défausse, Synchro auto, Étiquettes préexistantes, Vérification Wikipédia, **Synchronisation (1 123 lignes : aperçu, exécution, journal)**, puis la liste des cartes. Constats :
- Aucune vue d’ensemble : pas de chiffres clés ni de répartition des décisions ; l’information est dans la liste.
- Deux synchros différentes (lecture automatique `SynchroAuto`, écriture `Synchronisation`) aux états séparés ; l’avancement de la lecture existe (`StatutSynchro` : page / pages, ajoutées, étiquettes, prix) mais n’est pas montré en barre ; celui du lot d’écriture est un compteur.
- Ni « à venir » ni durée restante cohérente ; le journal liste le passé seulement (`Journal.tsx`).
- Une erreur arrête le lot avec un message (raison : `manuel | echecs | code-http | resultat | ecriture | transport | verification`) ; l’utilisateur ne peut que relancer ou arrêter. Les 403/404 par carte sont absorbés en silence.
- Tout est sur une page très longue, y compris les réglages rares.

## 1. Goals
- G1 — Un **tableau de bord** lisible en 5 secondes : cartes, valeur, décisions, enchères, écarts avec le site, santé de la synchro.
- G2 — Un **centre de synchro** : étape en cours, barre de progression globale et par étape, durée restante estimée, tâches en cours / à venir / terminées.
- G3 — Une **erreur par action** : quelle action, quelle carte, quel lot, code et cause, ce qui est déjà fait, et un choix : réessayer, sauter l’action, sauter le lot, ignorer jusqu’à la prochaine synchro, arrêter.
- G4 — Mieux organiser : sections par usage (suivre, décider, régler), réglages rares repliés.

## 2. Scope
**Inclus** : navigation, dashboards (données déjà stockées), page Synchro, panneau d’erreur et « actions ignorées », historique filtrable, responsive 375 / 768 / 1280, thèmes clair/sombre existants.
**Exclu** : tout changement des règles de cadence, des routes, des garde-fous ; tout nouvel appel réseau ; l’assistant de tri (déplacé tel quel) ; de nouvelles couleurs.

## 3. Success Criteria
| ID | Critère | Vérifiable par |
|---|---|---|
| SC-001 | Le tableau de bord affiche : nb d’exemplaires et de titres, valeur estimée (et part de titres sans prix), répartition garder/échanger/vendre/défausser/à trier, places d’enchères, nb d’écarts, état et âge de la dernière synchro, calculés depuis les données locales | unitaire + e2e |
| SC-002 | Pendant une synchro ou un lot, une barre `role="progressbar"` (valeurs now/min/max, texte « N / M · P % ») montre l’avancement global et par étape | e2e |
| SC-003 | La page Synchro liste les tâches **en cours**, **à venir** (au moins par lot et par type, avec leur nombre) et **terminées** | e2e |
| SC-004 | Sur erreur, le panneau indique action, carte, lot, rang (37 / 120), code HTTP ou cause, heure, nombre d’actions déjà réussies, et prochaine reprise possible | unitaire + e2e |
| SC-005 | « Sauter cette action » et « Sauter ce lot » marquent les actions « passées » sans requête ; la file continue | unitaire + e2e |
| SC-006 | « Ignorer jusqu’à la prochaine synchro » persiste l’action dans une liste d’ignorées, exclue des aperçus jusqu’à la fin de la prochaine synchro complète, avec « Reprendre » | unitaire + e2e |
| SC-007 | Aucun secret ni corps de réponse du site affiché ou stocké ; le détail d’erreur vient d’une liste fermée de champs | unitaire |
| SC-008 | Navigation clavier complète, cibles ≥ 44 px, contrastes AA, progression et statuts jamais portés par la seule couleur | e2e + revue |
| SC-009 | Aucun débordement horizontal à 375 / 768 / 1280, en clair et en sombre | captures |
| SC-010 | Aucune régression : les e2e existants (synchro, écriture, sauvegarde, plafond…) passent, adaptés aux nouveaux emplacements | e2e |

## 4. Constraints
- **Cadre WikiMasters** inchangé (AGENTS.md) : la refonte n’ajoute aucune requête ni aucune action sur le site. « Sauter » et « ignorer » sont locaux.
- **Stockage** : nouvelle clé `ignorees` (liste fermée : type, idCarte, portée, date) et enrichissement du journal / état de lot (rang, total, lot) ; tout changement du schéma fournit une migration.
- Textes en français, typographie française ; couleurs via tokens.

## 5. Non-Goals
Refonte du modèle de données, nouvelles automatisations, notifications système.

## Visuels
`wireframes/index.html` (sélecteur de variante, largeur, thème) ; variantes 1 à 3 ; captures dans `captures/`.

## Hypothèses (à contredire si faux)
- H1 — La valeur estimée = somme des valeurs marchandes connues × quantité.
- H2 — « Lot » = un groupe d’actions de même type d’un même run (lot 2 / 4 : étiquettes).
- H3 — « Prochaine synchro » = prochaine lecture complète réussie ; les ignorées sont alors réévaluées.
- H4 — Durée restante = actions restantes × (0,2 s + 0,05 s moyen) / concurrence ; affichée « environ ».
- H5 — Une action sautée par 403 par carte (déjà absorbée) apparaît dans l’historique comme « passée : exemplaire indisponible ».
