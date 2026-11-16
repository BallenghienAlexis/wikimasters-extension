# Écarts maquette ↔ extension (2026-11-14)

Source : maquette « Refonte IHM · 3 variantes », variante 1, v15 (`Main.dc.html`), rendue puis comparée à l’extension réelle (données fictives de `tests/e2e/extension.ts`), 3 largeurs × 2 thèmes. La vérification du 2026-11-14 (28/28 SC) contrôlait des comportements, pas le rendu : ce relevé est le référentiel visuel des PR « alignement maquette ».

| # | Zone | Écart | Statut |
|---|---|---|---|
| 1 | Coquille | En-tête sur une ligne (titre · dernière synchro · pastille), marge de 24 px, cinq onglets de largeur égale ; paragraphe d’avertissement déplacé en pied de page | PR 1 |
| 2 | Tableau de bord | Unités à côté des chiffres clés (fait) ; barre de répartition par décision et tableau par rareté : **supprimés volontairement** (statuts locaux retirés, #140) | PR 1 |
| 3 | Tableau de bord | Santé de la synchro : lignes Lecture / Étiquettes / Prix / Ignorées avec symbole et prochaine synchro | à faire |
| 4 | Synchro | Étapes en lignes (nom, barre, compteur), carte Tâches et barre de fraîcheur des prix : PR 2. Reste : Tâches et Ignorées + Journal côte à côte, activité récente ; interrupteur de synchro aussi dans Réglages (fait, décision d’Alexis du 2026-11-14 : aux deux endroits, même préférence `syncAuto`) | partiel |
| 5 | Lots | Lots listés avec interrupteurs, état coloré, résumé et « Lancer les lots cochés » ; encadré d’avertissement compact (fait : une ligne + détail repliable des règles du site) ; « Écarts avec le site ». Écarts assumés : l’aperçu reste demandé par « Voir l’aperçu du lot » (lot figé, D-18) au lieu de s’afficher d’emblée, et le Journal reste sous l’aperçu | partiel |
| 6 | Collection | Cartes de synthèse, évolution 30 jours en barres, 10 plus chères, thèmes en barres ; « valeur par décision » et décision colorée : **supprimés volontairement**. Fait : liste et filtres dans une carte, thèmes en barres, évolution en carte avec bornes et écart. Écarts assumés : tableau éditable (valeur, prix cible, note) au lieu de la liste en lecture seule de la maquette, 3 analyses sur une ligne, pas de carte de synthèse « Doublons » (le résumé en tête de page en tient lieu) | partiel |
| 7 | Tableau de tri | **Supprimé volontairement** (#140) | sans objet |
| 8 | Ventes | **Onglet supprimé volontairement** (#140) : places, file de vente, heures fortes | sans objet |
| 9 | Réglages | Sections compactes (titre, résumé, chevron) ; synchro auto en section (faite, #142) ; plafond de défausse : **supprimé volontairement** (la section reste dans l’extension, en réserve). Fait : résumé de la valeur courante calé à droite, plus de carte dans la carte (Sauvegarde, Plafond), hook `useSyncAuto`. Reste : résumé « N trouvées » des étiquettes préexistantes | partiel |

Choix assumés (fonctions réelles absentes de la maquette) : panneau d’erreur détaillé, champs modifiables de la liste, aperçu du lot, sauvegarde.

Éléments de maquette sans objet depuis #140 : onglet Ventes, tableau de tri, répartition par décision et tableau par rareté (colonnes Garder / Échanger / Vendre), « valeur par décision », places d’enchères et chiffre « Enchères », plafond de défausse, interrupteur de lot « défausses » et « enchères ». La maquette comporte donc six onglets contre cinq dans l’extension.

Non-régression : `tests/e2e/refonte-conformite-maquette.spec.ts` mesure en-tête, onglets, encadré de risque, cartes de la Collection et résumés de Réglages (3 largeurs, 2 thèmes) ; il échoue si l’extension s’éloigne de nouveau de la maquette.

## Blocs dépliables et épuration (Alexis, 2026-11-16)

Demande : pages trop chargées ; chaque bloc doit être dépliable et, replié, ne montrer que la dernière information ou un résumé. Fait : `SectionRepliable` (replié par défaut, `ouvertParDefaut` réservé à l’opération en cours) appliqué à Tâches, Prix du marché, Synchronisation automatique, Historique et Journal, Analyses (3 blocs), Évolution sur 30 jours, Enchères et défausses (ouvert seulement si des cartes sont choisies) et Progression (ouverte seulement pendant une synchro). Onglet Synchro réordonné : titre, pastille et durée restante sur une ligne, puis l’erreur, la progression, les tâches, les ignorées, les prix, la synchro auto, l’historique. Les tests e2e utilisent `deplierTout` (`tests/e2e/extension.ts`) quand ils lisent le contenu d’un bloc.
