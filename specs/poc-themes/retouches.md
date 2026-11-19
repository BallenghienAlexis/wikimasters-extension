# Retouches à reprendre

## À reprendre
- `src/app/planificateurWikipedia.ts:21` : le graphe Wikidata complet est réécrit après chaque carte qui l'agrandit (jusqu'à 1 à 2 Mo). Regrouper les écritures (toutes les N cartes ou en fin de file) si la lecture de fond se montre lente.
- Mesure avec pages Wikipédia réelles (`specs/poc-themes/poc-b/mesure-pages.test.ts`) : dépend de la collecte `poc/collecter.mjs`, ralentie par les 429 de Wikimedia.
- `src/app/verifierWikipedia.ts:83` : une erreur d'enregistrement du graphe Wikidata (quota) est ignorée sans trace au journal ; le graphe se relit alors au chargement suivant (requêtes en plus). À journaliser si le quota pose problème.
