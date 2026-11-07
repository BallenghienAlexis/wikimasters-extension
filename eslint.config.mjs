import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Un bloc flat-config qui redéfinit une règle REMPLACE la configuration précédente :
// chaque bloc recompose donc sa liste complète à partir des briques ci-dessous.

const MSG_HTML = 'Interdit par AGENTS.md : rendre les données en texte.';
const MSG_ACTION = 'Interdit par AGENTS.md : aucune action sur le site à la place du joueur.';
const MSG_RESEAU = 'Interdit : le réseau passe uniquement par src/lib/reseau.ts.';
const MSG_STOCKAGE = 'Interdit : cookies et stockage du site uniquement en lecture, dans src/lib/jeton.ts.';
const MSG_ECRITURE = 'Interdit : aucune écriture dans les cookies ni le stockage du site, même dans src/lib/jeton.ts.';
const MSG_ALEA = 'Interdit : aucun aléatoire dans la file, le réseau et le jeton (cadence fixe).';
const MSG_JETON = 'Interdit : seul src/lib/reseau.ts peut importer jeton.';

const regle = (selector, message) => ({ selector, message });

// Accès à la propriété `nom` : `a.nom` ou `a['nom']`.
const membre = (nom) => `MemberExpression[property.name='${nom}'], MemberExpression[property.value='${nom}']`;
const HTML = [
  regle("JSXAttribute[name.name='dangerouslySetInnerHTML']", MSG_HTML),
  regle("AssignmentExpression[left.property.name='innerHTML']", MSG_HTML),
  regle("AssignmentExpression[left.property.name='outerHTML']", MSG_HTML),
  regle("CallExpression[callee.property.name='insertAdjacentHTML']", MSG_HTML),
  regle("CallExpression[callee.property.name='write'][callee.object.name='document']", MSG_HTML),
];

const ACTIONS = ['click', 'submit', 'requestSubmit', 'dispatchEvent', 'focus'].map((nom) =>
  regle(`CallExpression[callee.property.name='${nom}'], CallExpression[callee.property.value='${nom}']`, MSG_ACTION),
);

const GLOBALES_RESEAU = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
const RESEAU = [...GLOBALES_RESEAU, 'sendBeacon'].map((nom) => regle(membre(nom), MSG_RESEAU));

const GLOBALES_STOCKAGE = ['cookieStore', 'localStorage', 'sessionStorage', 'indexedDB'];
// Lecture : tout accès aux cookies et au stockage (`document.cookie`, `window['localStorage']`…).
const STOCKAGE = ['cookie', ...GLOBALES_STOCKAGE].map((nom) => regle(membre(nom), MSG_STOCKAGE));

const STOCKAGES_WEB = ['localStorage', 'sessionStorage'];
const ecrireSur = (nom) =>
  `AssignmentExpression:matches([left.object.name='${nom}'], [left.object.property.name='${nom}'], [left.object.property.value='${nom}'])`;
const supprimerSur = (nom) =>
  `UnaryExpression[operator='delete']:matches([argument.object.name='${nom}'], [argument.object.property.name='${nom}'], [argument.object.property.value='${nom}'])`;
const appelerSur = (nom, methodes) =>
  `CallExpression[callee.property.name=/^(${methodes})$/]:matches([callee.object.name='${nom}'], [callee.object.property.name='${nom}'], [callee.object.property.value='${nom}'])`;

// Écritures : interdites partout, jeton.ts compris.
const ECRITURES = [
  regle("AssignmentExpression[left.property.name='cookie'], AssignmentExpression[left.property.value='cookie']", MSG_ECRITURE),
  regle("UpdateExpression[argument.property.name='cookie']", MSG_ECRITURE),
  regle(appelerSur('cookieStore', 'set|delete'), MSG_ECRITURE),
  ...STOCKAGES_WEB.flatMap((nom) => [
    regle(ecrireSur(nom), MSG_ECRITURE),
    regle(supprimerSur(nom), MSG_ECRITURE),
    regle(appelerSur(nom, 'setItem|removeItem|clear'), MSG_ECRITURE),
  ]),
];

// Méthodes d'écriture génériques (indexedDB, Storage) : bannies seulement dans jeton.ts (Set.add, Map.clear ailleurs).
const ECRITURES_JETON = [
  regle(
    "CallExpression:matches([callee.property.name=/^(setItem|removeItem|clear|deleteDatabase|createObjectStore|deleteObjectStore|put|add)$/], [callee.property.value=/^(setItem|removeItem|clear|deleteDatabase|createObjectStore|deleteObjectStore|put|add)$/])",
    MSG_ECRITURE,
  ),
];

const ALEA = [
  regle("MemberExpression:matches([object.name='Math'], [object.property.name='Math']):matches([property.name='random'], [property.value='random'])", MSG_ALEA),
  regle("MemberExpression:matches([property.name=/^(getRandomValues|randomUUID)$/], [property.value=/^(getRandomValues|randomUUID)$/])", MSG_ALEA),
];

const IMPORT_JETON = [
  regle("ImportExpression[source.value=/(^|\\/)jeton(\\.[jt]s)?$/]", MSG_JETON),
  regle("CallExpression[callee.name='require'][arguments.0.value=/(^|\\/)jeton(\\.[jt]s)?$/]", MSG_JETON),
];

const globales = (noms) => noms.map((name) => ({ name, message: noms === GLOBALES_RESEAU ? MSG_RESEAU : MSG_STOCKAGE }));
const GLOBALES = (reseau, stockage) => [
  ...(reseau ? globales(GLOBALES_RESEAU) : []),
  ...(stockage ? globales(GLOBALES_STOCKAGE) : []),
];

const PATTERNS_JETON = { patterns: [{ regex: '(^|/)jeton(\\.[jt]s)?$', message: MSG_JETON }] };

// Composition d'un bloc : `site` = code exécuté sur le site (aucune action, aucun HTML).
function regles({ site = false, reseau = true, stockage = true, alea = false, jeton = true, idb = false } = {}) {
  const syntaxe = [
    ...(site ? HTML : [HTML[0], HTML[1]]),
    ...(site ? ACTIONS : []),
    ...(reseau ? RESEAU : []),
    ...(stockage ? STOCKAGE : []),
    ...ECRITURES,
    ...(idb ? ECRITURES_JETON : []),
    ...(alea ? ALEA : []),
    ...(jeton ? IMPORT_JETON : []),
  ];
  return {
    'no-restricted-syntax': ['error', ...syntaxe],
    'no-restricted-globals': ['error', ...GLOBALES(reseau, stockage)],
    'no-restricted-imports': jeton ? ['error', PATTERNS_JETON] : 'off',
  };
}

const SITE = ['src/content/**/*.ts', 'src/lib/**/*.ts', 'src/config/**/*.ts'];

export default tseslint.config(
  { ignores: ['dist/', 'playwright-report/', 'test-results/', 'specs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, ...regles() },
  },
  {
    // Le code exécuté sur le site lit et affiche, mais n'agit jamais à la place du joueur.
    files: SITE,
    rules: regles({ site: true }),
  },
  {
    // Aléatoire interdit dans la file (cadence fixe).
    files: ['src/lib/file.ts'],
    rules: regles({ site: true, alea: true }),
  },
  {
    // Seul module autorisé à émettre des requêtes et à importer jeton ; sans aléatoire ni journal.
    files: ['src/lib/reseau.ts'],
    rules: { ...regles({ site: true, reseau: false, alea: true, jeton: false }), 'no-console': 'error' },
  },
  {
    // Seul module autorisé à lire cookies et stockage du site : lecture seule, sans réseau ni journal.
    files: ['src/lib/jeton.ts'],
    rules: { ...regles({ site: true, stockage: false, alea: true, idb: true }), 'no-console': 'error' },
  },
  {
    files: ['.claude/hooks/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);
