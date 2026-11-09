# Retouches T-901 : points mineurs des revues de T-004 à T-016

## Traité

- `registre.ts` : tables d’étiquettes sans prototype (`__proto__`, `constructor`, `prototype` restent de simples clés) dans `validerRegistre` et `enregistrerEtiquette` ; couple `{ex, nom}` en double rejeté ; tests « n’altère jamais l’entrée » sur copie profonde (cas valide et rejeté).
- `messages.ts` : `CAUSES_RESULTAT` (liste fermée, libellés existants conservés : `action non disponible`, `erreur d’émission`, `erreur de transport`, `jeton-absent`) ; prix d’enchère entier sûr entre 1 et `PRIX_MAX` (1 000 000) ; `validerSignal` ; type renommé `MessageProtocole` (aucun autre fichier ne l’importait) ; `expectTypeOf` sur `ordre` et `resultat` ; `NOM_PORT` défini ici.
- `contrat.ts` : `typesDisponibles` ignore les valeurs `undefined` ; tests : clé à `undefined`, chaînes interdites (`https://`, `http://`, `authorization`, `apikey`, sans tenir compte de la casse) dans `contrat.ts` et `contrat/*`, chemin résolu depuis `import.meta.url`, entrées de familles retrouvées dans `TABLE_CONTRAT`.
- `journal.ts` : vérifié, `completerEntree` compare des identifiants et ne passe plus par le prototype. Rien à changer.
- `jeton` : confinement exige une erreur de règle (pas une erreur d’analyse) ; expression de retrait des commentaires `(?<!:)\/\/.*$` avec un test sur une chaîne contenant `//`.
- `lot.ts` : raisons d’écart dédoublonnées par carte ; `construireEncheres` ignore favori et statut autre que `vendre` (reste exporté, sans autre usage) ; prix entier sûr ≥ 1 ; `Math.floor` sur les places ; test `idsSite: []` ; tests d’enchères déduits de la matrice ; apostrophe de « s’inséreront ».
- `revision.ts` : commentaire sur la cohérence avec l’état actuel ; tests : prix sans `prixCible`, quantité > 1 avec un seul identifiant, `retrait-etiquette` et `lecture` dans la boucle AC3.
- `file.ts` : JSDoc de `reverifier` ; `toBe(6000)` dans le test d’exception de transport.
- `execution.ts`, `content/*` : `NOM_PORT` défini une seule fois (`messages.ts`), ligne vide en trop retirée, import `./executant` placé après `../lib`, test contre `window.onmessage = …` et `on… =`, test de `horlogeReelle` sur `performance`.
- `Journal.tsx`, `DialogueVider.tsx` : test d’une entrée à `idCarte: ''` (pas de repère de rareté, écart assumé avec D-29) ; le `mousedown` sur le voile remet le focus sur « Annuler ».

## Décliné ou laissé

- `validerSignal` n’est branché nulle part : les consommateurs (`execution.ts`) ignorent déjà tout message non attendu ; le brancher changerait leur comportement, hors périmètre.
- Le test du dialogue vérifie le source (pas de DOM dans Vitest, pas de nouvelle dépendance) ; un test e2e pourra le couvrir avec T-017.
- `CAUSES_RESULTAT` contient quelques libellés de réserve (`action réussie`, `erreur réseau`, `délai dépassé`, `réponse hors contrat`) : T-021 l’étendra au besoin.
- `Synchronisation.tsx` et `App.tsx` : réservés à T-017, leurs retouches viendront après.

## À reprendre

Les points mineurs des revues de T-015 et T-017 (`App.tsx`, `Synchronisation.tsx`) n'ont pas été recopiés ici au moment du merge : leur détail n'est plus dans le dépôt. À retrouver auprès de l'orchestrateur du run d'origine, puis à lister ici (fichier:ligne, point) avant la tâche de retouches.
