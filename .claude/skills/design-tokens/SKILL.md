---
name: design-tokens
description: Système de tokens de WM Collection (Tailwind 4 @theme dans src/styles/tokens.css) et règles pour l'étendre. Utilisé par designer et dev-ui.
---

# Design tokens WM Collection

## Où vivent les tokens
`src/styles/tokens.css`, bloc `@theme` : chaque `--color-<nom>` génère les utilitaires `bg-<nom>`, `text-<nom>`, `border-<nom>` (+ opacité `bg-<nom>/40`).

## Tokens actuels
| Rôle | Token | Sombre | Clair |
|---|---|---|---|
| Fond | `ink` / `ink-2` | #13110f / #1c1916 | #fbf8f2 / #f1ece2 |
| Texte | `paper` / `muted` | #ede8df / #a39c91 | #1b1815 / #635c52 |
| Filet | `line` | #3a352f | #d8d1c4 |
| Statut | `garder` `echanger` `vendre` | #52d69a #7ba4ff #f4c356 | #0f6b45 #1f4fb8 #8a5a00 |

Les noms `ink`/`paper` sont des **rôles** (fond/texte), pas des couleurs : un thème redéfinit leur valeur, les composants ne changent pas de classe.

## Règles
- Pas de nouvelle couleur en dur (`#…`, `rgb(…)`) dans un composant : ajouter un token, le documenter dans `design.md` (`D-xx`).
- Un thème se décline par redéfinition des variables sous `@media (prefers-color-scheme: dark)`, jamais par des classes `dark:` dispersées.
- Contraste AA : 4,5:1 texte normal, 3:1 grand texte (≥ 24 px ou 18,66 px gras) et éléments d'interface. Calcul : luminance relative WCAG 2.x ; donner le ratio dans `design.md`.
- Breakpoints Tailwind par défaut, mobile-first : base = 375 px, `md:` = 768 px, `xl:` = 1280 px.
- Focus : `:focus-visible` global (contour 2 px `paper`, décalage 2 px) ; ne pas le supprimer.
- Mouvement : toute animation est coupée par `prefers-reduced-motion` (règle globale existante).
- Page d'extension : polices système uniquement, la CSP interdit les ressources distantes.
