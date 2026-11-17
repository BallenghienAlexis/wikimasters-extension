# Spec courte : onglet Mise en vente (2026-11-17)

Décisions d’Alexis (chat du projet, 2026-11-17), risque de bannissement rappelé et assumé :
- « un suivi plus approfondi dans un onglet mise en vente » : décompte dès la mise en vente, prix de départ, mise à jour toutes les 5 minutes puis toutes les 10 secondes dans la dernière minute ; règle du site : mise débitée tout de suite, remboursée si surenchéri, mise dans les 10 dernières secondes = fin prolongée de 60 secondes.
- « automatise la mise en vente : quand une enchère est finie, lance une nouvelle » : choix 1 (règle de pré-cochage actuelle, plus chères d’abord), **sans clic « Lancer »** (confirmé), tant que l’interrupteur est activé et qu’un onglet WikiMasters est visible.
- Une enchère non vendue remet sa carte dans la file ; pas de boucle sans limite visible : avertissement avec choix.
- Règle du 16/11 : aucun process ne s’arrête seul sur des échecs ; attente progressive de 5 s, +5 s à chaque échec ; avertissement avec choix « Passer cette carte » / « Continuer d’attendre ». Seuls l’anti-bot (attente, jamais contourné) et 401/429 (pause 30 min) mettent en pause.

Critères : tests `tests/unit/mise-en-vente.test.ts`, `tests/unit/suivi-ventes-cycle.test.ts`, `tests/e2e/mise-en-vente.spec.ts`. Cadre complet dans `AGENTS.md` § « Mise en vente : suivi et relance automatique ».

## Non-ventes et prix de départ (Alexis, 2026-11-17)

Une enchère non vendue est mémorisée par carte (`nonVentes`, `finsVues` dans `suiviVentes`) : la relance divise le prix de départ de la matrice par deux autant de fois que la carte est restée non vendue de suite (÷2, ÷4…), plancher de 1 wikibidou (minimum du site **non vérifié**). Une vente remet le compte à zéro. À la première lecture, l’historique existant n’est pas compté. L’onglet affiche les non-ventes de suite et le prochain prix de départ.

Le compte est tenu par `rareté|titre`. **Non vérifié** : la forme de `history` pour une vente réelle (`final_price`) ; une vente sans `final_price` serait comptée non vendue (point à relever, `retouches.md`). Un seul onglet WikiMasters visible évite l’entrelacement du bail.
