---
name: review-checklist
description: Checklist de revue des PR SDD WM Collection (conformité tâche/spec/design, qualité, sécurité et vie privée) et format de verdict. Utilisé par reviewer et security-reviewer.
---

# Checklist de revue

## Conformité (reviewer)
1. **Périmètre** : `gh pr diff <n> --name-only` ⊆ fichiers concernés de la tâche (+ `specs/<feature>/captures/T-xxx/`). Tout fichier en plus = bloquant.
2. **Critères d'acceptation** : chacun est implémenté et couvert par un test qui échouerait sans le code.
3. **Tests d'abord** : le premier commit de la branche est `test(T-xxx): …` ; les commits suivants ne modifient pas ces tests (sinon : justification dans la PR, sinon bloquant).
4. **SC** cités dans la PR = SC de la tâche.
5. **design.md** (UI) : tokens seulement, pas de couleur en dur, chaque `D-xx` cité respecté, captures 3 breakpoints jointes, focus visible, navigation clavier.
6. **AGENTS.md** : conventions (français, composants, tests), « Ne jamais faire ».
7. **Qualité** : code lisible et dans le style voisin, pas de duplication évitable, erreurs gérées, pas de code mort ajouté.
8. **CI** : `gh pr checks <n>` vert.

## Sécurité et vie privée (security-reviewer)
1. Secrets : aucune valeur sensible dans le diff, `.env*` et `captures-site/` non ajoutés, aucun mot de passe, cookie ni jeton de session lu, stocké ou journalisé.
2. Manifeste : `permissions` et `host_permissions` minimales, chacune justifiée ; pas de code distant, de `eval` ni d'assouplissement de la CSP. Entrées (fichier importé, contenu du site) validées : types, bornes, tailles.
3. Données personnelles : pas de pseudos, d'identifiants ni de captures réelles du compte dans le code ou les tests. Aucune donnée envoyée à un serveur tiers.
4. Injection : pas de `dangerouslySetInnerHTML` ni d'`innerHTML` sur une donnée ; export CSV protégé contre les formules ; liens ouverts seulement en `https://`.
5. Cadre WikiMasters : aucun clic, envoi ou appel à l'API interne du site fait à la place d'Alexis hors cadre d'`AGENTS.md`.
6. Dépendances : `npm audit --omit=dev` sans vulnérabilité haute ajoutée par la PR.

## Format du verdict
```
VERDICT: APPROVED | CHANGES_REQUESTED
1. [bloquant|mineur] fichier:ligne — problème — référence (SC-xxx, D-xx, AGENTS.md § …, checklist n°) — correction attendue
```
Chaque point est actionnable par le dev sans autre explication. Pas de point sans référence.
