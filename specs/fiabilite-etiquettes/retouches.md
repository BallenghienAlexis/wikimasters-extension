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
