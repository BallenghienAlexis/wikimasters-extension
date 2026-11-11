
## À reprendre (PR #58, vérification Wikipédia)

- `src/app/VerificationWikipedia.tsx` : pas de parcours e2e ni de captures aux 3 breakpoints (navigateur Playwright absent de l'environnement du fil).
- `src/lib/themes.ts` (`definirThemesWikipedia`) : la surcouche reste un état de module ; un passage explicite du cache en paramètre de `themesDeCarte` serait plus pur mais touche tri, lot, exports et écarts.
- Décliné : retirer `host_permissions` via `origin=*` (Alexis a validé la permission explicite, documentée dans AGENTS.md).
