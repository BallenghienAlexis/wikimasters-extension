# STATUS — synchro-complete

- **Besoin** : « synchronisation complète » avec WikiMasters : poser les étiquettes (thèmes et « #À échanger »), mettre aux enchères et défausser depuis l’extension (Alexis, 2026-11-07).
- **Étape courante** : 5-retouches (écriture livrée, points ouverts dans `retouches.md`)
- **Mis à jour** : 2026-11-12

## Gate spec
- [x] Spec validée par Alexis — 2026-11-07 ; option B (lecture du jeton en mémoire dans `jeton.ts`) choisie le même jour.
- [x] Écriture autorisée et relevés faits par Claude sans manipulation d’Alexis — 2026-11-11.

## Livré (sur `main`)
- T-001 à T-017 et T-901 ; `reseau.ts`, `jeton.ts` (lecture du cookie de session, hôte REST relevé), entrées du contrat (étiquettes, enchère, défausse) : PR #55, #64 (e2e T-018, T-020, T-026), #65 (enchère et défausse réelles), #66 à #70 (seuil de défausse, 409, identifiant d’exemplaire, cause du 403), #72 à #75 (cadence rapide et parallélisme).
- Décisions postérieures à la spec : cadence la plus rapide (plancher 0,2 s, sans plafond par minute), poses et retraits en parallèle, `PLAFOND_VALEUR_DEFAUSSE` = 5.

## Reste (détail dans `retouches.md` § « À reprendre »)
Décompte « prochaine action » (D-20), cartes déjà en vente exclues de l’aperçu, `ventesSite` non affiché dans `FileVente`, première défausse réelle à confirmer, libellés 401/403/429, retrait d’étiquette non couvert en e2e, `LONGUEUR_MAX_ETIQUETTE` non relevée, bail de la synchro non atomique. Alignement des specs sur la cadence actuelle : fait le 2026-11-12 (avenants), détail restant dans `retouches.md`.
