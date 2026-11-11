# Affluence : heures de mise en vente

## Besoin (Alexis, 2026-11-11)
Recommandation de mise en vente : cartes les plus chères en priorité, aux heures de plus forte affluence, avec un délai de 1 h ; sur les temps libres, les moins chères avec un délai de 3 h.

## Constat
Aucune route de lecture autorisée ne donne l’affluence du site : `sales?scope=summary` n’a pas d’horodatage, l’historique complet est réservé aux comptes PRO (interdit par AGENTS.md), `marketplace/mine` ne donne que les compteurs du joueur. Aucune requête nouvelle n’est donc ajoutée.

## Décision
Mesure **locale et passive** : l’extension note l’heure à laquelle le joueur déclare chaque mise aux enchères et chaque fin d’enchère (boutons déjà présents dans « Ventes »). Aucune requête, aucune donnée du site, rien d’envoyé.
- Tant que moins de 20 mises en vente sont notées, les créneaux par défaut de `src/config/affluence.ts` s’appliquent (réglables, à rebuild).
- Ensuite, les heures où le joueur a le plus vendu (fin d’enchère comprise) deviennent les heures fortes (top 25 % des créneaux heure × jour utilisés, avec au moins 2 évènements : un créneau à une seule vente n’est jamais fort).
- Conseil affiché dans « Ventes » : carte chère (valeur ≥ seuil) en heure forte → délai 1 h ; sinon, carte peu chère sur temps libre → délai 3 h ; carte chère hors heure forte → « attendre une heure forte » ; carte peu chère en heure forte → « réserver aux cartes chères ».

## Critères
- SC-1 : créneaux par défaut utilisés sous 20 observations.
- SC-2 : au-delà, histogramme 7 × 24 (heure locale) et heures fortes déduites.
- SC-3 : conseil de délai selon valeur et heure.
- SC-4 : journal borné (500 entrées), schéma versionné, entrée illisible ignorée.
- SC-5 : la réinitialisation de la collection ne purge pas le journal `ventes` (réglage séparé, comme les préférences) ; les écritures du journal sont chaînées.
