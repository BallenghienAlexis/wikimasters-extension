# Spec — Sauvegarde complète entre deux PC

Demande d'Alexis (2026-11-12) : « la sauvegarde complète peut être bien pour transvaser entre deux PC, mets ça en place ».

## Critères d'acceptation
- SC-1 : l'export écrit un seul fichier JSON (`format`, `version`, date) ; liste blanche : édition des cartes (statut, prix cible, note, ami, décidé par, valeur marchande, favori), préférences (thèmes, amis), interrupteur de synchro, ventes du joueur. Aucun jeton, cookie, identifiant d'exemplaire, étiquette du site ni cache.
- SC-2 : l'import valide strictement (JSON, format, version — plus récente : message dédié —, taille ≤ 20 Mo, chaque carte, réglages, ventes) ; toute erreur est lisible et ne modifie rien. Les champs inconnus sont ignorés.
- SC-3 : l'aperçu précède toute écriture : cartes nouvelles, complétées, identiques, en conflit ; thèmes, amis, ventes ajoutés.
- SC-4 : fusion sans écrasement aveugle : édition vierge ici → reçoit la sauvegarde ; conflit → « garder ici » (défaut) ou « prendre la sauvegarde » ; favori, quantité, identifiants du site toujours ceux d'ici ; thèmes, amis, ventes réunis ; idempotente.
- SC-5 : la section est visible même collection vide (cas du PC neuf).

## Hors périmètre (voir retouches.md)
Registre des étiquettes posées, journal d'exécution, caches, plafonds de `src/config/prix.ts`.
