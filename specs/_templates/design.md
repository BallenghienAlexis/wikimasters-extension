# Design — <Titre de la feature>

Contrat visuel. Chaque règle a un identifiant `D-xx` cité par les tâches, la revue et la vérification.

## Tokens
| Token CSS | Utilitaire | Sombre | Clair | Usage | Règle |
|---|---|---|---|---|---|
| `--color-…` | `bg-…` | #… | #… | … | D-01 |

Typographie, espacements, rayons, ombres : uniquement ce qui change.

## Thèmes
- Mécanisme (sélecteur, préférence système, persistance) — D-xx
- Éléments hors tokens à adapter (images, SVG) — D-xx

## Composants
| Composant | États (repos / survol / focus / actif / désactivé) | Variantes | Règle |
|---|---|---|---|

## Responsive (mobile-first)
| Breakpoint | Largeur | Comportement |
|---|---|---|
| base | 375 px | … |
| `md` | 768 px | … |
| `xl` | 1280 px | … |

## Accessibilité
| Paire texte / fond | Thème | Ratio | Seuil | OK |
|---|---|---|---|---|

- Focus visible, cibles ≥ 44 px, `prefers-reduced-motion`, libellés ARIA — D-xx
