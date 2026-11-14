# Écarts maquette ↔ extension (2026-11-14)

Source : maquette « Refonte IHM · 3 variantes », variante 1, v15 (`Main.dc.html`), rendue puis comparée à l’extension réelle (données fictives de `tests/e2e/extension.ts`), 3 largeurs × 2 thèmes. La vérification du 2026-11-14 (28/28 SC) contrôlait des comportements, pas le rendu : ce relevé est le référentiel visuel des PR « alignement maquette ».

| # | Zone | Écart | Statut |
|---|---|---|---|
| 1 | Coquille | En-tête sur une ligne (titre · dernière synchro · pastille), marge de 24 px, six onglets de largeur égale ; paragraphe d’avertissement déplacé en pied de page | PR 1 |
| 2 | Tableau de bord | Unités à côté des chiffres clés (fait) ; barre de répartition par décision et tableau par rareté : **supprimés volontairement** (statuts locaux retirés, #140) | PR 1 |
| 3 | Tableau de bord | Santé de la synchro : lignes Lecture / Étiquettes / Prix / Ignorées avec symbole et prochaine synchro | à faire |
| 4 | Synchro | Étapes en lignes (nom, barre, compteur) ; Tâches et Ignorées + Journal côte à côte ; barre de fraîcheur des prix et activité récente ; interrupteur de synchro déplacé dans Réglages | à faire |
| 5 | Lots | Lots listés avec interrupteurs, état coloré, résumé et « Lancer les lots cochés » ; encadré d’avertissement compact ; « Écarts avec le site » | à faire |
| 6 | Collection | Cartes de synthèse, évolution 30 jours en barres, 10 plus chères, thèmes en barres ; « valeur par décision » et décision colorée : **supprimés volontairement** | à faire |
| 7 | Tableau de tri | **Supprimé volontairement** (#140) | sans objet |
| 8 | Ventes | **Onglet supprimé volontairement** (#140) : places, file de vente, heures fortes | sans objet |
| 9 | Réglages | Sections compactes (titre, résumé, chevron) ; synchro auto en section ; plafond de défausse : **supprimé volontairement** | à faire |

Choix assumés (fonctions réelles absentes de la maquette) : panneau d’erreur détaillé, champs modifiables de la liste, aperçu du lot, sauvegarde.

Éléments de maquette sans objet depuis #140 : onglet Ventes, tableau de tri, répartition par décision et tableau par rareté (colonnes Garder / Échanger / Vendre), « valeur par décision », places d’enchères et chiffre « Enchères », plafond de défausse, interrupteur de lot « défausses » et « enchères ». La maquette comporte donc six onglets contre cinq dans l’extension.
