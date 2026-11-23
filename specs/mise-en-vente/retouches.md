# Retouches — mise en vente

## À reprendre
- `src/content/suiviVentes.ts` (lecture) : prendre le bail pendant la lecture comme le relevé d’affluence (`synchroAuto.ts:200`).
- `src/content/suiviVentes.ts:183` : propager la pause 401/429 d’une écriture dans `arretJusqua`.
- `src/lib/stockage.ts:430` : valider chaque élément de `actives` et `terminees`.
- Relever `history` pour une vente réelle (`final_price`) avant de se fier aux non-ventes.
- Captures de l’onglet aux 3 breakpoints.
- (#187) `src/content/suiviVentes.ts` (transmission du 401/429 du suivi) : l’écriture de `arretJusqua` dans l’état partagé de la synchro peut être réécrasée par une synchro en cours (`synchroAuto.ts` réécrit son état à chaque page) ; prévoir une clé de pause du site dédiée, lue par l’ordonnanceur avant chaque requête.
- (#187) `src/lib/verrouRequete.ts` : le verrou expire après 20 s alors que `transportSite` n’a aucun délai d’abandon ; ajouter un `AbortSignal.timeout` inférieur ou prolonger le verrou pendant la requête. La prise reste non atomique entre onglets (relecture après 50 ms).
- (#187) Faire passer les envois parallèles des lots (`executant`) par le verrou de requête pour tenir « une seule requête en vol ».
- (#187) Captures du bloc « Suivi des ventes en cours » aux 3 breakpoints.
- (fins d’enchère) `src/lib/ventes.ts` (`lireTerminee`) : `card_id` de l’historique n’est pas relevé sur le site ; sans lui la non vendue n’est pas retentée en priorité (la règle habituelle la reprend le plus souvent). Relever une réponse `history` réelle.
- (fins d’enchère) `src/app/OngletMiseEnVente.tsx` : afficher l’issue (`issue`) de chaque ligne du journal des lancements.
- (#187) `src/content/suiviVentes.ts` : la pause d’un envoi de la relance (401/429) n’est pas transmise à `arretJusqua` (seule la lecture le fait) ; à décider avec la clé de pause du site dédiée.
- (fins d’enchère) `src/content/suiviVentes.ts` (`relancer`) : si l’onglet se ferme entre un envoi réussi et `clore`, la fin est retraitée et une mise en vente de trop est possible (bornée par les places et le 409) ; retirer la fin avant l’envoi et la remettre sur `stop`/`bloque`.
- (fins d’enchère) Annulée : traité (Alexis, 2026-11-17), la carte annulée est écartée un jour.
- (fins d’enchère) Tests unitaires de module pour `fileDesFins` (file plafonnée à 50, `sansVerdict` expiré), « Aucune carte éligible » affichée sans `prix: 0`.

## À reprendre (2026-11-21, PR #207)

- `src/content/suiviVentes.ts:189` + `src/lib/reseau.ts` : la relance fait maintenant deux requêtes (relecture `price-history`, puis enchère) sous une seule tenue du verrou de requête, qui expire après 20 s (`DUREE_VERROU_REQUETE_MS`) ; sur un site très lent (15 s par requête), le verrou peut expirer pendant l'envoi. Prolonger le verrou avant l'envoi ou prendre deux tenues distinctes.
- `src/lib/file.ts:426` : une enchère « passée » à la relecture de la tendance est journalisée sans sa cause (« prix du marché indisponible », « aucune vente récente », « prix trop bas ») et le journal d'un lot garde le prix estimé de l'aperçu, pas le prix relu envoyé (`resultat.prix`). Garder cause et prix dans l'entrée de journal.
- `src/lib/reseau.ts` (`relireTendance`) : un 401 ou un 429 à la relecture n'a pas de ligne `diagnostic` (« GET …/price-history → 429 »).
