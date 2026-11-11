# Retouches — affluence-site

## À reprendre
- `src/app/App.tsx` (lecture de `affluenceSite`) : lue une fois au chargement ; pas de mise à jour si la synchro écrit de nouveaux relevés pendant que la page est ouverte. Écouter la clé comme `ecouterSynchro`.
- `tests/e2e/assistant.spec.ts` : la regex du conseil dépend de l’heure réelle (voir `specs/affluence/retouches.md`).
- Dans `src/content/synchroAuto.ts`, `releverMarche` recopie en partie la cadence de l’ordonnanceur (6 s, 10 par minute). À terme, en faire une étape de `synchroniser` pour partager `requete()`.
