// Réglages de l'écriture des étiquettes sur le site (spec synchro-complete, relevé du 2026-11-11).
// Aucune valeur de session ici : ni jeton, ni identifiant de joueur. La clé publique est celle
// du site (rôle « anon », visible de tout visiteur) ; décision d'Alexis du 2026-11-11 : en dur,
// dans cette constante unique.

/** Hôte REST des étiquettes (projet Supabase du site) : la seule origine, autre que le site, autorisée. */
/** Origine du site : cible des écritures « enchère » et « défausse » (cookies du navigateur, aucun jeton lu). */
export const ORIGINE_SITE = 'https://www.wiki-masters.com'
export const ORIGINE_REST = 'https://cyrxjeppjqsxxjayfrur.supabase.co'

/** Nom du cookie de session du site (découpé en `.0`, `.1`…). Le jeton n'est lu que dans `jeton.ts`. */
export const NOM_COOKIE_SESSION = 'sb-cyrxjeppjqsxxjayfrur-auth-token'

/** Clé publique du projet, exigée par l'hôte REST dans l'en-tête `apikey`. */
export const CLE_PUBLIQUE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cnhqZXBwanFzeHhqYXlmcnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODAzMzksImV4cCI6MjA4OTQ1NjMzOX0.BZluyXygNxuQGDPxFX1zG5i-cqp10CVK-8GGtuak4Rg'

/** Couleur des étiquettes créées par l'extension (réglage d'Alexis ; format `#rrggbb`). */
export const COULEUR_ETIQUETTE = '#e879f9'

/** Délai maximal d'une requête, en millisecondes. */
export const DELAI_REQUETE_MS = 15_000
