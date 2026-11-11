# Retouches — affluence-site

## À reprendre
- `src/app/App.tsx` (lecture de `affluenceSite`) : lue une fois au chargement ; pas de mise à jour si la synchro écrit de nouveaux relevés pendant que la page est ouverte. Écouter la clé comme `ecouterSynchro`.
- `tests/e2e/assistant.spec.ts` : la regex du conseil dépend de l’heure réelle (voir `specs/affluence/retouches.md`).
- Dans `src/content/synchroAuto.ts`, `releverMarche` recopie en partie la cadence de l’ordonnanceur (6 s, 10 par minute). À terme, en faire une étape de `synchroniser` pour partager `requete()`.
- `src/content/synchroAuto.ts:175-195` : une exception de `transport` (réseau coupé) n’est pas comptée comme échec ; dans le `catch`, enregistrer `{ le: debut, echecs: precedent.echecs + 1 }` et ajouter `debut` à `etat.requetes`.
- `src/lib/affluence.ts:123-124` : `routeMarcheValide` ne lit que la première valeur de `scope` et compare `sales` en respectant la casse ; exiger `getAll('scope')` égal à `['summary']` et comparer en minuscules.
- `src/content/synchroAuto.ts:169-170` : la limite de 10 requêtes par minute du relevé n’a pas de test (`etat.requetes` avec 10 horodatages récents, aucun GET vers la route).
- `tests/unit/synchro-auto.test.ts` : les tests « pause » et « bail tenu » sont arrêtés en amont par `synchroniser` ; ils ne testent pas les gardes propres à `releverMarche` (défense en profondeur).
