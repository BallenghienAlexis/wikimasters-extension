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
- (fins d’enchère) Une enchère annulée (`cancelled`) libère une place reprise tout de suite, y compris la carte annulée : question posée à Alexis (écarter un temps l’exemplaire annulé ?).
- (fins d’enchère) Tests unitaires de module pour `fileDesFins` (file plafonnée à 50, `sansVerdict` expiré), « Aucune carte éligible » affichée sans `prix: 0`.
