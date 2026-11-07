# Design — Synchronisation complète (aperçu du lot, exécution, défausse, journal)

Contrat visuel. Chaque règle a un identifiant `D-xx` cité par les tâches, la revue et la vérification.

Sources : `spec.refined.md` (SC-008, 009, 012, 016, 020, 021 surtout), wireframe retenu `wireframes/variante-1.html` avec les écarts listés dans la spec (§ Visuels), `src/styles/tokens.css`, `src/app/FileVente.tsx` (conventions existantes : `rounded border border-line bg-ink-2 p-4`, `min-h-11`, titre `h2 font-semibold`).

Périmètre : ce document ne fixe que le rendu. Il ne nomme aucun point d'accès ni format de requête du site (voir `contrat-api.md`, à écrire par Alexis). Les libellés d'action viennent de la spec.

## Tokens

### Décision générale
| Règle | Énoncé |
|---|---|
| D-01 | **Aucun token n'est ajouté, modifié ni renommé.** `src/styles/tokens.css` n'est pas touché par cette feature. Les 9 tokens existants suffisent : fonds `ink` / `ink-2`, texte `paper` / `muted`, filet `line`, statuts `garder` / `echanger` / `vendre` / `defausser`. Toute couleur en dur (`#…`, `rgb(…)`) est interdite dans les composants. |
| D-02 | Aucune nouvelle ombre, aucun nouveau rayon, aucune nouvelle police. Rayon : `rounded` (comme `FileVente`). Pas de `shadow-*` : la séparation passe par les filets et les bordures. Polices : `font-sans` système (CSP). |

### Rôle de chaque token dans cette feature
| Token CSS | Utilitaires | Sombre | Clair | Usage dans la feature | Règle |
|---|---|---|---|---|---|
| `--color-ink` | `bg-ink` | #13110f | #fbf8f2 | Fond de page ; fond des boutons secondaires ; voile du dialogue (`bg-ink/80`, sans texte dessus) | D-03 |
| `--color-ink-2` | `bg-ink-2` | #1c1916 | #f1ece2 | Fond des sections (risque, aperçu, exécution, journal) et du dialogue | D-03 |
| `--color-paper` | `text-paper`, `border-paper`, `bg-paper` | #ede8df | #1b1815 | Texte courant ; bordure du bouton principal et du dialogue ; remplissage de la barre de progression | D-03 |
| `--color-muted` | `text-muted`, `border-muted` | #a39c91 | #635c52 | Texte secondaire (détail, horodatage, « Non annulable… », cartes écartées) ; bordure des boutons secondaires | D-04 |
| `--color-line` | `border-line`, `bg-line` | #3a352f | #d8d1c4 | Filets décoratifs entre lignes, bordure des sections, piste de la barre, fond de survol des boutons. **Jamais** seul pour délimiter un bouton (1,29:1 en clair) | D-04 |
| `--color-garder` | `text-garder` | #52d69a | #0f6b45 | Résultat « réussie », lot terminé | D-05 |
| `--color-echanger` | `text-echanger` | #7ba4ff | #1f4fb8 | Type d'action « Étiquette » (pose, retrait, création) | D-05 |
| `--color-vendre` | `text-vendre` | #f4c356 | #8a5a00 | Type d'action « Mettre aux enchères » ; résultat « résultat inconnu » ; avertissement de visibilité des étiquettes | D-05 |
| `--color-defausser` | `text-defausser`, `border-defausser` | #ff9a8b | #a8321f | Bandeau de risque (barre gauche 4 px et titre) ; type « Défausser » ; résultat « échouée » et cause d'arrêt ; bouton « Défausser cette carte » | D-05 |

| Règle | Énoncé |
|---|---|
| D-03 | Les fonds se posent par rôle (`bg-ink`, `bg-ink-2`) ; les composants ne changent pas de classe d'un thème à l'autre. |
| D-04 | Bordures : section = `border-line` (décoratif, comme `FileVente`). Bouton secondaire, bouton désactivé = `border-muted` ; bouton principal et dialogue = `border-paper` (≥ 3:1, voir tableau d'accessibilité). C'est le seul écart avec `CLASSE_BOUTON` de `FileVente` (qui utilise `border-line`) : il ne vaut que pour les nouveaux boutons, `FileVente` n'est pas modifié ici. |
| D-05 | **La couleur ne porte jamais seule une information.** Chaque type d'action et chaque résultat s'écrit en toutes lettres (« Mettre aux enchères », « Étiquette », « Défausser », « réussie », « échouée », « passée », « interrompue », « résultat inconnu ») en `font-semibold` ; la couleur ne fait que renforcer. Le bandeau de risque porte le préfixe textuel « ! ». |

Typographie et espacements (uniquement ce qui est utilisé) :
| Élément | Classes | Règle |
|---|---|---|
| Titre de section (`h2`) | `font-semibold` (16 px, comme `FileVente`) | D-06 |
| Titre du dialogue (`h2`) | `text-lg font-semibold` | D-06 |
| Lignes d'aperçu et de journal | `text-sm` (14 px) ; jamais sous 14 px | D-06 |
| Espacements | sections `mt-4 p-4` ; écart des groupes de boutons `gap-2` ; lignes `py-2` | D-06 |

## Thèmes
- D-07 — Mécanisme existant, inchangé : `prefers-color-scheme` redéfinit les variables sous `@media (prefers-color-scheme: dark)` dans `tokens.css`. Pas de sélecteur manuel, pas de classes `dark:`. La feature n'ajoute aucune règle de thème.
- D-08 — Impact : les deux thèmes sont touchés à l'identique (mêmes classes, valeurs redéfinies). Les captures de SC-021 sont faites dans les deux thèmes (émulation `colorScheme` Playwright) à 375, 768 et 1280 px, soit 6 captures par état : aperçu, exécution en cours, dialogue de défausse, journal.
- D-09 — Aucun élément hors tokens : pas d'image, pas de SVG, pas d'icône. Le point d'exclamation du bandeau est un caractère « ! » en `aria-hidden="true"` (le titre « Action sur le site à votre place » porte le sens).

## Composants

Emplacement : une section « Synchronisation avec WikiMasters » dans `collection.html`, après `FileVente`, dans le conteneur existant. Ordre fixe dans le document (SC-008 : le rappel du risque précède « Lancer ») : 1. Bandeau de risque, 2. Aperçu du lot (remplacé par la zone d'exécution une fois lancé), 3. Journal. Dialogues en surimpression.

| Composant | États (repos / survol / focus / actif / désactivé) | Variantes | Règle |
|---|---|---|---|
| Bouton | Repos : `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border border-muted bg-ink px-4 text-paper`. Survol : `hover:bg-line`. Focus : `:focus-visible` global (2 px `paper`, décalage 2 px), jamais supprimé. Actif : `active:bg-line`. Désactivé : D-12 | principal, destructeur, secondaire | D-10 à D-12 |
| Bandeau de risque | Statique | une seule | D-13 |
| Aperçu du lot | Calcul, plein, vide, lancement désactivé, erreur | avec / sans cartes écartées | D-14 à D-18 |
| Zone d'exécution | En cours, attente de confirmation, arrêtée, terminée, interrompue | — | D-19 à D-23 |
| Dialogue de défausse | Ouvert (focus sur « Passer ») | — | D-24 à D-27 |
| Journal | Vide, liste, liste longue, entrée « en cours », illisible | — | D-28 à D-31 |
| Dialogue « Vider » | Ouvert (focus sur « Annuler ») | — | D-32 |

### Boutons
- D-10 — Trois variantes, toutes d'au moins 44 × 44 px :
  - **Principal** (« Lancer les N actions », « Passer » dans le dialogue de défausse, « Annuler » dans le dialogue « Vider ») : base + `border-paper font-semibold`.
  - **Destructeur** (« Défausser cette carte », « Vider » dans son dialogue) : base + `border-defausser text-defausser font-semibold`. Jamais le bouton par défaut ni le premier focalisé.
  - **Secondaire** (« Annuler », « Fermer », « Arrêter », « Arrêter le lot », « Retirer l’étiquette », « Vider », « Réessayer », « Afficher 50 de plus ») : base seule. « Arrêter » et « Arrêter le lot » sont en plus `font-semibold`, pour rester repérables en urgence.
- D-11 — Survol et actif sans nouvelle couleur : `hover:bg-line` et `active:bg-line` pour les boutons principal et secondaire, texte `paper` (jamais `muted`, voir D-34). Le bouton destructeur fait exception : voir D-44. Un bouton désactivé n'a pas d'état de survol.
- D-12 — Désactivé : `aria-disabled="true"` (et non l'attribut `disabled`, pour que le bouton reste atteignable au clavier et que sa raison soit lue). Le clic est ignoré. Apparence : `border-dashed text-muted cursor-not-allowed`, **sans** `opacity-*`. La raison est un texte visible, rattaché par `aria-describedby`, placé juste sous ou à côté du bouton, en `text-sm text-muted` (SC-020, SC-016).

### Bandeau de risque
- D-13 — Section `rounded border border-line border-l-4 border-l-defausser bg-ink-2 p-4`. Titre `h2` « Action sur le site à votre place » en `text-defausser font-semibold`, précédé de « ! » (D-09). Corps en `text-paper` : règles § 3 (rétro-ingénierie, interception du trafic), CGU § 6, `robots.txt` « Disallow: /api/ », « Risque de bannissement accepté le 07/11/2026. », et le fait qu'une enchère et une défausse ne s'annulent pas depuis l'extension. Si `contrat-api.md` dit que les étiquettes sont visibles des autres joueurs (H34), une ligne `text-vendre font-semibold` « Les étiquettes sont visibles des autres joueurs : les noms d’amis y apparaîtront. » s'ajoute. Le bandeau reste affiché pendant l'exécution (version compacte, titre seul, autorisée). Aucune case à cocher (H10), aucun bouton de fermeture.

### Aperçu du lot (SC-008, SC-020, SC-024, SC-025)
- D-14 — Contenu, dans l'ordre : titre `h2` « Lot prêt : N actions » ; totaux « 6 étiquettes · 3 enchères · 3 défausses » (`text-sm`) ; « Durée estimée : 2 min » ; liste des actions ; liste des cartes écartées ; ligne « Cadence fixe : 10 actions par minute · arrêt après 3 erreurs » (`text-sm text-muted`) ; boutons « Lancer les N actions » (principal) puis « Annuler » (secondaire). N exclut les actions « non disponibles ».
- D-15 — Liste des actions, `md` et plus : `<table>` avec `<th scope="col">` Carte / Action sur le site / Détail, `w-full text-sm`, lignes séparées par `border-b border-line`, cellules `px-2 py-2 align-top`. Colonne Action : `font-semibold` coloré par type (D-05) : Mettre aux enchères = `text-vendre`, Étiquette = `text-echanger`, Défausser = `text-defausser`, lecture ou création d'étiquette = `text-paper`. Détail en `text-muted` : « départ 50 · valeur marchande 140 », « Statut · Vendre », « Ami · Léa », « exemplaire 1 sur 2 ». Carte : « [R] Titre », rareté en texte entre crochets, `break-words`, titre jamais tronqué.
- D-16 — Liste des actions, base (< 768 px) : chaque ligne devient un bloc empilé (`border-b border-line py-2`). Les en-têtes de colonne disparaissent visuellement mais **chaque valeur est préfixée par son libellé visible** (« Action : », « Détail : », `text-muted`). Implémentation recommandée : liste `<ul>` en grille (`grid grid-cols-1 md:grid-cols-3`, `xl:grid-cols-[3fr_2fr_2fr]`) plutôt qu'un tableau dont `display` est cassé ; si un tableau est gardé, son rôle ARIA est restauré. Aucun défilement horizontal à 375 px.
- D-17 — Cartes non incluses : sous la liste, `<details>` « Cartes non incluses (N) » en `text-sm text-muted`, une ligne par carte avec sa raison en toutes lettres (« non reliée au site », « en attente d’une place libre (5 / 5) », « prix de départ supérieur ou égal à la valeur marchande », « valeur marchande absente », « action non disponible », « nom d’étiquette trop long », « étiquette obsolète conservée : favori »). Au-delà de 50 lignes, regroupement par raison avec compte. La liste d'actions affiche au plus 100 lignes, puis « … et N autres actions » (`text-muted`) pour tenir SC-025 sur 5 000 cartes ; les totaux et la durée portent sur le lot complet. Les actions « non disponibles » sont listées ici, en `text-muted` (D-23).
- D-18 — États de l'aperçu :
  - **Calcul** (< 500 ms attendu) : texte « Calcul du lot… », `aria-busy="true"`, sans spinner animé.
  - **Vide** (collection vide ou lot sans action) : titre « Aucune action à envoyer », texte `text-muted` donnant les raisons (favoris, à trier, non reliées au site), pas de bouton « Lancer », « Annuler » devient « Fermer ».
  - **Lancement désactivé** : « Lancer les N actions » en `aria-disabled` (D-12) avec la raison exacte : « Aucun onglet WikiMasters ouvert. », « Plusieurs onglets WikiMasters sont ouverts : gardez-en un seul. », « Une exécution est déjà en cours. », « Aucune action n’est disponible pour le moment. ».
  - **Erreur de construction** (lecture du stockage impossible) : `text-defausser font-semibold` « Le lot n’a pas pu être préparé : <cause en français fixe> », bouton « Réessayer » (secondaire).

### Zone d'exécution (SC-010 à SC-013, SC-021, SC-023)
- D-19 — Au clic sur « Lancer », l'aperçu est remplacé par la zone d'exécution dans la même section ; le bandeau reste au-dessus. Le focus passe à « Arrêter ». Contenu : « En cours : 4 / 12 · 0 erreur » (`font-semibold`), barre de progression, bouton « Arrêter » (secondaire), indication `text-sm text-muted` « Échap : arrêter le lot ».
- D-20 — Barre : conteneur `h-2 rounded bg-line`, remplissage `bg-paper`, largeur en pourcentage fixée directement (`style={{ width }}`), **sans `transition`** ni `animate-*`. `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label="Progression du lot"`. Le décompte textuel reste la source d'information ; la barre n'en est que le doublon visuel. Aucun indicateur d'attente animé ; l'attente entre deux requêtes se lit dans « prochaine action dans 4 s » (`text-sm text-muted`, mis à jour chaque seconde, **hors** région live).
- D-21 — Région live : un seul élément `role="status"` (`aria-live="polite"`, `aria-atomic="true"`), visible, qui reçoit les phrases de progression (« 4 sur 12 faites, 0 erreur ») uniquement quand une action se termine ou change d'état, jamais chaque seconde. Arrêts et fins de lot y sont écrits en toutes lettres (« Lot arrêté : réponse 429. Aucune autre requête n’a été envoyée. »).
- D-22 — États de fin, dans la même section, avec bordure gauche de 4 px :
  - **Terminé** : « Lot terminé : N réussies, M passées, E échouées », « Lot terminé » en `text-garder font-semibold`, bordure `border-l-garder`.
  - **Arrêté** (3 erreurs, 401/403/429, hors contrat, redirection, délai de 30 s, erreur réseau, stockage, arrêt manuel) : `border-l-defausser`, « Lot arrêté : <cause> » en `text-defausser font-semibold`, puis « N actions n’ont pas été envoyées. ». Pour un résultat inconnu, ligne `text-vendre font-semibold` « Résultat inconnu, à vérifier sur le site. ».
  - **Interrompu** (constaté à la réouverture, SC-013) : style « arrêté », texte « Lot interrompu : la page ou l’onglet a été fermé ou rechargé. L’exécution ne reprend pas toute seule. ».
  - Dans tous les cas, bouton « Fermer » (secondaire) ; le focus va sur le titre de la zone (`tabIndex={-1}`).
- D-23 — Une action « non disponible » ou « passée » s'écrit en `text-muted`, jamais en couleur de statut. Les actions passées apparaissent au journal, pas dans l'aperçu.

### Dialogue de défausse (SC-009, SC-021)
- D-24 — Voile plein écran `fixed inset-0 bg-ink/80`. Boîte `role="dialog"` `aria-modal="true"` `aria-labelledby` (titre) `aria-describedby` (corps), `rounded border border-paper bg-ink-2 p-4`, `max-w-md`, `w-[calc(100%-2rem)]`, centrée, `max-h-[calc(100dvh-2rem)] overflow-y-auto`. Titre `h2 text-lg font-semibold` « Défausser [C] Titre de carte ? » (`break-words`, jamais tronqué). Corps : « Exemplaire 1 sur 2. », puis « ! Cette action est définitive sur le site. » en `text-defausser font-semibold`.
- D-25 — Trois boutons, dans cet ordre DOM et visuel : « Défausser cette carte » (destructeur), « Passer » (principal), « Arrêter le lot » (secondaire). Base : colonne pleine largeur (`flex flex-col gap-2`) ; `md` et plus : en ligne (`md:flex-row md:flex-wrap`).
- D-26 — Clavier : focus initial sur « Passer » ; Tab et Maj+Tab bouclent entre les trois boutons ; Échap = « Passer » (jamais « Arrêter le lot », jamais « Défausser ») ; Entrée et Espace n'activent que le bouton focalisé ; un clic sur le voile n'a aucun effet. À la fermeture, le focus retourne au bouton « Arrêter » de la zone d'exécution, ou, après « Arrêter le lot », au titre de la zone (D-22). Le contenu derrière le dialogue est inerte (`inert`).
- D-27 — Pendant le dialogue, la barre ne bouge pas et le décompte indique « En attente de votre décision » ; la cadence de SC-010 compte la confirmation. L'indication « Échap : arrêter le lot » de la zone est masquée (elle serait fausse).

### Journal (SC-015, SC-016)
- D-28 — Section `aria-labelledby` « Journal » (`h2`), bouton « Vider » (secondaire) à droite du titre, désactivé (D-12, raison « Le journal est vide. ») quand il n'y a rien. Liste `<ol>` de la plus récente à la plus ancienne, entrées séparées par `border-b border-line py-2`, `text-sm`. Le journal n'est **pas** dans la région live (seule la zone d'exécution l'est, D-21).
- D-29 — Entrée : `<time dateTime="…">2026-11-07 14:02:11</time>` en `text-muted` ; « [R] Titre » ; type d'action coloré (D-05, D-15) ; paramètre (« à 50 », « Ami · Léa ») ; résultat en toutes lettres, `font-semibold` : « réussie » `text-garder`, « échouée » `text-defausser`, « résultat inconnu, à vérifier sur le site » `text-vendre`, « passée », « interrompue », « en cours » en `text-muted` ; code HTTP en `text-muted` (« HTTP 429 »), absent s'il est vide. Une entrée d'arrêt de lot (sans carte) s'écrit « Arrêt : <cause> » en `text-defausser`.
- D-30 — Enchères et défausses réussies : sous la ligne, « Non annulable par l’extension » en `text-muted text-sm`, aucun bouton. Pose réussie la plus récente d'un couple (carte, étiquette) encore au registre : bouton secondaire « Retirer l’étiquette » avec `aria-label` complet « Retirer l’étiquette « Ami · Léa » de <carte> ». À `md` et plus, bouton à droite de l'entrée ; en base, sous le texte, pleine largeur. Désactivé (D-12) avec sa raison : « Aucun onglet WikiMasters ouvert. » ou « Action non disponible. ». Après clic, le bouton disparaît, une entrée « en cours » s'ajoute en tête, le focus passe au titre du journal (`tabIndex={-1}`).
- D-31 — Liste longue : 50 entrées affichées d'abord, puis bouton secondaire « Afficher 50 de plus » (avec « N restantes »). Pas de défilement interne : la page défile. Journal vide : `text-muted` « Le journal est vide. Les actions envoyées au site apparaîtront ici. ». Lecture impossible : `text-defausser font-semibold` « Le journal est illisible et n’a pas été modifié. ».

### Dialogue « Vider le journal » (H11)
- D-32 — Même structure que D-24. Titre « Vider le journal ? », corps « Cela efface l’historique local. La collection et les étiquettes enregistrées ne sont pas touchées. ». Deux boutons : « Annuler » (principal, **focus initial**, Échap = Annuler) et « Vider » (destructeur). Focus piégé ; retour du focus sur « Vider » du journal, ou sur le titre si le journal est devenu vide.

## Responsive (mobile-first)
| Breakpoint | Largeur | Comportement |
|---|---|---|
| base | 375 px | Une colonne, `p-4`. Actions de l'aperçu et entrées du journal empilées, valeurs préfixées de leur libellé (D-16). Boutons de l'aperçu empilés pleine largeur, « Lancer » en premier. Dialogues : `w-[calc(100%-2rem)]`, boutons empilés pleine largeur dans l'ordre D-25. « Retirer l’étiquette » sous le texte de l'entrée. Aucun défilement horizontal ; `break-words` sur titres et noms d'amis (jusqu'à 300 caractères). |
| `md` | 768 px | Aperçu en 3 colonnes (D-15) ; boutons de l'aperçu en ligne ; dialogue `max-w-md` avec boutons en ligne ; entrées du journal sur une ligne, « Retirer l’étiquette » à droite. |
| `xl` | 1280 px | Même rendu qu'à `md`, borné par le conteneur existant ; colonne Carte plus large (`xl:grid-cols-[3fr_2fr_2fr]`). Pas de disposition côte à côte aperçu / journal. |

- D-33 — Chaque état clé (aperçu plein, aperçu vide, exécution, arrêt, dialogue de défausse, journal avec « Retirer l’étiquette ») est capturé aux trois largeurs et dans les deux thèmes (D-08). Aucune perte de contenu à 375 px, y compris avec un titre de 300 caractères sans espace (`break-words`).

## Accessibilité

### Contrastes AA calculés
Méthode : luminance relative WCAG 2.x, ratio (L1 + 0,05) / (L2 + 0,05). Luminances. Clair : ink 0,9406 · ink-2 0,8418 · paper 0,0094 · muted 0,1093 · garder 0,1105 · echanger 0,0934 · vendre 0,1272 · defausser 0,1070 · line 0,6418. Sombre : ink 0,0057 · ink-2 0,0100 · paper 0,8108 · muted 0,3361 · garder 0,5221 · echanger 0,3799 · vendre 0,5893 · defausser 0,4623 · line 0,0365. Seuil : 4,5:1 texte normal ; 3:1 composants d'interface.

| Paire texte / fond | Thème | Ratio | Seuil | OK |
|---|---|---|---|---|
| paper / ink | Clair | 16,7:1 | 4,5 | oui |
| paper / ink-2 | Clair | 15,0:1 | 4,5 | oui |
| paper / line (survol, actif) | Clair | 11,6:1 | 4,5 | oui |
| muted / ink | Clair | 6,2:1 | 4,5 | oui |
| muted / ink-2 | Clair | 5,6:1 | 4,5 | oui |
| garder / ink | Clair | 6,2:1 | 4,5 | oui |
| garder / ink-2 | Clair | 5,6:1 | 4,5 | oui |
| echanger / ink | Clair | 6,9:1 | 4,5 | oui |
| echanger / ink-2 | Clair | 6,2:1 | 4,5 | oui |
| vendre / ink | Clair | 5,6:1 | 4,5 | oui |
| vendre / ink-2 | Clair | 5,0:1 | 4,5 | oui (marge faible) |
| defausser / ink | Clair | 6,3:1 | 4,5 | oui |
| defausser / ink-2 | Clair | 5,7:1 | 4,5 | oui |
| defausser / line | Clair | 4,4:1 | 4,5 | **non** : voir D-44 |
| muted / line | Clair | 4,3:1 | 4,5 | **non** : interdit |
| paper / ink | Sombre | 15,4:1 | 4,5 | oui |
| paper / ink-2 | Sombre | 14,3:1 | 4,5 | oui |
| paper / line (survol, actif) | Sombre | 9,9:1 | 4,5 | oui |
| muted / ink | Sombre | 6,9:1 | 4,5 | oui |
| muted / ink-2 | Sombre | 6,4:1 | 4,5 | oui |
| garder / ink | Sombre | 10,3:1 | 4,5 | oui |
| garder / ink-2 | Sombre | 9,5:1 | 4,5 | oui |
| echanger / ink | Sombre | 7,7:1 | 4,5 | oui |
| echanger / ink-2 | Sombre | 7,2:1 | 4,5 | oui |
| vendre / ink | Sombre | 11,5:1 | 4,5 | oui |
| vendre / ink-2 | Sombre | 10,7:1 | 4,5 | oui |
| defausser / ink | Sombre | 9,2:1 | 4,5 | oui |
| defausser / ink-2 | Sombre | 8,5:1 | 4,5 | oui |
| defausser / line | Sombre | 5,9:1 | 4,5 | oui |
| muted / line | Sombre | 4,46:1 | 4,5 | **non** (marge nulle) : interdit |

Composants d'interface (3:1) :
| Élément | Thème | Ratio | Seuil | OK |
|---|---|---|---|---|
| Bordure `muted` / ink-2 (bouton secondaire, désactivé) | Clair / Sombre | 5,6:1 / 6,4:1 | 3 | oui |
| Bordure `paper` / ink-2 (dialogue, bouton principal) | Clair / Sombre | 15,0:1 / 14,3:1 | 3 | oui |
| Bordure `defausser` / ink-2 (bouton destructeur) | Clair / Sombre | 5,7:1 / 8,5:1 | 3 | oui |
| Remplissage `paper` de la barre / piste `line` | Clair / Sombre | 11,6:1 / 9,9:1 | 3 | oui |
| `border-line` des sections / ink-2 | Clair | 1,3:1 | — | décoratif uniquement (D-04) : ne délimite aucune commande |

### Règles vérifiables
| Règle | Énoncé |
|---|---|
| D-34 | **Contraste.** Seules les paires « oui » des tableaux ci-dessus sont autorisées. Interdit : `text-line`, `text-muted` sur `bg-line` (4,3:1 en clair, 4,46:1 en sombre), `opacity-*` sur du texte, `text-vendre` / `text-garder` sur `bg-line` (non calculés comme conformes : 3,9:1 et 4,3:1 en clair). |
| D-35 | **Focus visible.** `:focus-visible` global conservé (contour 2 px `paper`, décalage 2 px). Aucun `outline-none`. Le focus ne disparaît jamais derrière le voile du dialogue ni hors écran. |
| D-36 | **Cibles.** Tout élément actionnable mesure au moins 44 × 44 px (`min-h-11 min-w-11`) ; au moins 8 px (`gap-2`) entre deux boutons. |
| D-37 | **Clavier.** Aperçu, exécution, dialogues et journal sont utilisables au clavier seul, ordre de tabulation = ordre du document. Échap : « Passer » dans le dialogue de défausse ; « Annuler » dans le dialogue « Vider » ; « Arrêter le lot » dans la zone d'exécution quand le focus y est et qu'aucun dialogue n'est ouvert ; sinon sans effet. |
| D-38 | **ARIA.** Dialogues : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`. Région d'état : `role="status"` + `aria-live="polite"` (D-21). Barre : `role="progressbar"` avec valeurs (D-20). Boutons désactivés : `aria-disabled="true"` + `aria-describedby` vers la raison (D-12). `<th scope="col">` pour le tableau ; vraies `<ul>` / `<ol>` pour les listes ; un `h2` par section. « Retirer l’étiquette » rendu unique par `aria-label` (D-30). |
| D-39 | **Mouvement réduit.** La règle globale de `tokens.css` (`animation: none`, `transition: none` sous `prefers-reduced-motion: reduce`) est conservée. En outre la feature n'emploie ni animation ni transition (D-20) : aucun contenu ne dépend d'un mouvement. Interdit : `animate-*`, `transition-*`, `scroll-smooth`. |
| D-40 | **Typographie française.** Apostrophe ’, espace avant `:` `;` `?` `!` (insécable dans les libellés fixes), conformément à AGENTS.md. |
| D-41 | **Contenu non fiable.** Titres, noms d'amis et causes d'erreur sont rendus comme texte (jamais `innerHTML` ni `dangerouslySetInnerHTML`), avec `break-words`. Les causes affichées sont des libellés français fixes de l'extension, jamais le corps brut d'une réponse du site. |
| D-42 | **Pas de couleur seule.** En niveaux de gris, chaque type et chaque résultat reste identifiable par son libellé (D-05). |
| D-43 | **Défausse sans erreur de geste.** Le bouton destructeur n'a jamais le focus initial, n'est pas dans un formulaire validé par Entrée, et un clic hors de la boîte ne le déclenche pas (D-26). |
| D-44 | **Bouton destructeur, survol et actif.** `text-defausser` sur `bg-line` fait 4,4:1 en clair (insuffisant). Le bouton destructeur n'a donc pas de `hover:bg-line` : survol et actif passent par `hover:bg-ink-2` / `active:bg-ink-2` sur fond `ink`, paire « defausser / ink-2 » validée (5,7:1 clair, 8,5:1 sombre). |

## Récapitulatif des règles par source
| Source spec | Règles de design |
|---|---|
| SC-008 (aperçu, risque avant « Lancer ») | D-13 à D-18 |
| SC-009 (dialogue de défausse, focus sur « Passer ») | D-24 à D-27, D-43, D-44 |
| SC-012 (Arrêter) | D-19, D-37 |
| SC-016 (Retirer l’étiquette, non annulable) | D-28 à D-31 |
| SC-020 (Lancer désactivé, vide) | D-12, D-18 |
| SC-021 (accessibilité, thèmes, captures) | D-07, D-08, D-33 à D-44 |
