# Spec — Synchro entre PC par dossier partagé

- **Feature** : `synchro-pc` · **Auteur** : fil « Explorer une synchro automatique entre PC » · **Date** : 2026-11-24
- **Besoin d'origine** : « trouve peut-être un autre moyen de synchro entre plusieurs PC (via le navigateur ou autre) pour que les différents PC soient toujours synchronisés entre eux » (Alexis, 2026-11-24). Choix : dossier Google Drive pour ordinateur, `G:\Mon Drive\WM Collection sync`.
- **Validation** : voir `STATUS.md` (gate humain). Aucun code avant validation.

## 1. Goals
- G1 — Les PC d'Alexis restent synchronisés sans export ni import manuel.
- G2 — Aucune requête réseau, aucune permission, aucun serveur : l'extension lit et écrit seulement des fichiers locaux d'un dossier choisi par Alexis, que Google Drive pour ordinateur copie d'un PC à l'autre.
- G3 — Même format que la sauvegarde complète (`src/lib/sauvegarde.ts`, champ `synchro` de `sauvegardeSynchro.ts`), pour rester compatible avec les fils sur l'import entre PC (horodatages, étiquettes) et sur l'export enrichi.

## 2. Scope
**Inclus**
- Réglages › « Synchro entre PC » : choix du dossier une fois par PC (File System Access API, `showDirectoryPicker`), poignée gardée dans IndexedDB de la page de gestion, nom du PC modifiable (défaut généré, sans donnée personnelle).
- **Un fichier par PC** : `wm-sync-<pc>.json` (instantané versionné, mêmes règles de liste blanche que la sauvegarde : jamais de secret, de jeton ni d'identifiant d'exemplaire). Un PC n'écrit que son fichier, donc aucun conflit de fichier côté Drive.
- **Écriture** : après une synchro terminée ou un changement local, au plus une fois par minute, depuis la page de gestion ouverte.
- **Lecture et fusion** : à l'ouverture de la page et toutes les 5 minutes, lecture des fichiers des autres PC, fusion **champ par champ, le plus récent gagne** (horodatages posés par le fil « import entre PC »). Fichier plus ancien que le local, illisible ou d'une version de format inconnue : ignoré et signalé, jamais d'écrasement.
- État visible : dernier envoi, dernière lecture, PC vus, erreurs. Autorisation du dossier à redonner d'un clic quand Chrome la redemande.

**Exclu**
- Toute requête vers Google, tout jeton, toute API Drive (option B écartée pour l'instant).
- Écrire sur le site à la place du joueur (rien ne change côté WikiMasters).
- Synchro en l'absence de page de gestion ouverte (le service worker ne peut pas redemander l'autorisation).

## 3. Success Criteria
| ID | Critère | Vérifiable par |
|---|---|---|
| SC-001 | Deux instantanés de PC différents fusionnés donnent, pour chaque champ, la valeur la plus récente, quel que soit l'ordre de lecture (idempotent, commutatif). | unitaire |
| SC-002 | Un fichier illisible, tronqué ou d'une version inconnue ne modifie rien et produit un message lisible. Un fichier plus ancien que ma dernière modification saisie ne remplace aucune carte et n'en ajoute aucune (une carte vendue ou défaussée ici ne ressuscite pas) ; seuls thèmes, amis et ventes sont réunis. | unitaire |
| SC-003 | Le fichier écrit ne contient aucun jeton, cookie, identifiant d'exemplaire ni clé API ; il passe la même validation stricte que la sauvegarde. | unitaire |
| SC-004 | Un PC n'écrit jamais que `wm-<son nom>.json` ; une écriture se fait par fichier temporaire puis remplacement, pour ne jamais laisser un fichier à moitié écrit. | unitaire |
| SC-005 | Écritures espacées d'une minute au moins, lectures toutes les 5 minutes au plus ; aucune requête réseau (test de lint réseau inchangé). | unitaire |
| SC-006 | Autorisation du dossier retirée : la page affiche un bouton « Autoriser à nouveau » et rien ne casse. | e2e |
| SC-007 | Navigable au clavier, contrastes AA, section repliable comme les autres réglages. | e2e / capture |

## 4. Constraints
- **Rétrocompatibilité** : une clé de stockage ajoutée (`synchroPc`, validée à la lecture, sans migration) et la poignée du dossier en IndexedDB ; format de sauvegarde inchangé.
- **Performance** : instantané non compressé (la compression gzip est reportée, voir `retouches.md`).
- **Cadre WikiMasters** : aucune requête ni écriture sur le site ; les données restent dans le Drive d'Alexis (tiers qu'il a lui-même choisi). À noter dans `AGENTS.md` (nouvelle section) à la mise en œuvre, avec la décision datée d'Alexis.
- **Confidentialité** : le dossier contient la collection d'Alexis (titres, notes, amis, valeurs) ; il ne doit être partagé avec personne : quiconque peut y écrire peut déposer un fichier valide et modifier ses réglages (thèmes, amis, plafond).

## 5. Non-Goals
- Synchro en temps réel à la seconde ; synchro sans Drive pour ordinateur ; support d'autres navigateurs.

## Visuels
Section Réglages : `[Choisir le dossier]  Dossier : WM Collection sync  ·  Ce PC : <nom>  ·  Dernier envoi : 14:12  ·  Dernière lecture : 14:15  ·  PC vus : 2`.

## Hypothèses
- Chrome accepte le lecteur `G:` de Google Drive pour ordinateur dans `showDirectoryPicker` (à tester sur le PC d'Alexis en premier : sinon repli sur un dossier miroir ou option B).
- Le dossier est réglé en « disponible hors connexion » sur chaque PC.
- Les horodatages par champ viennent du fil « import entre PC » ; en attendant, la règle « le plus récent gagne » se décide par fichier : le fichier d'un autre PC l'emporte s'il est plus récent que la dernière modification saisie sur ce PC (`modifieLe`, détectée par changement des champs saisis). Limite : effacer une édition ne se propage pas (la carte redevient « vierge » et est recomplétée).
- Nom de PC par défaut : `pc-` + 4 caractères aléatoires.
