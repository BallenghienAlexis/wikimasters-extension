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
const MSG_ALEA = 'Interdit : aucun aléatoire dans la file, le réseau et le jeton (l’aléa vient de gigue.ts, injecté).';
const MSG_JETON = 'Interdit : seul src/lib/reseau.ts peut importer jeton.';

const regle = (selector, message) => ({ selector, message });

// Accès à la propriété `nom` : `a.nom` ou `a['nom']`.
// Clés en gabarit sans expression (`localStorage`) comprises.
const membre = (nom) =>
  `MemberExpression[property.name='${nom}'], MemberExpression[property.value='${nom}'], MemberExpression[property.type='TemplateLiteral'][property.expressions.length=0][property.quasis.0.value.cooked='${nom}']`;
// Déstructuration : `const { nom } = …`, `const { nom: autre } = …`, `const { 'nom': x } = …`.
const destructure = (noms) =>
  `ObjectPattern > Property[key.name=/^(${noms})$/], ObjectPattern > Property[key.value=/^(${noms})$/]`;
const HTML = [
  regle("JSXAttribute[name.name='dangerouslySetInnerHTML']", MSG_HTML),
  regle("AssignmentExpression[left.property.name='innerHTML']", MSG_HTML),
  regle("AssignmentExpression[left.property.name='outerHTML']", MSG_HTML),
  regle("CallExpression[callee.property.name='insertAdjacentHTML']", MSG_HTML),
  regle("CallExpression[callee.property.name='write'][callee.object.name='document']", MSG_HTML),
];

const NOMS_ACTIONS = ['click', 'submit', 'requestSubmit', 'dispatchEvent', 'focus'];
const ACTIONS = [
  ...NOMS_ACTIONS.map((nom) =>
    regle(`CallExpression[callee.property.name='${nom}'], CallExpression[callee.property.value='${nom}']`, MSG_ACTION),
  ),
  // `el.click.call(el)`, `.apply`, `.bind`.
  ...NOMS_ACTIONS.map((nom) =>
    regle(
      `CallExpression[callee.property.name=/^(call|apply|bind)$/]:matches([callee.object.property.name='${nom}'], [callee.object.property.value='${nom}'])`,
      MSG_ACTION,
    ),
  ),
];

const GLOBALES_RESEAU = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
const NOMS_RESEAU = [...GLOBALES_RESEAU, 'sendBeacon'];
const reseau = (noms) => [...noms.map((nom) => regle(membre(nom), MSG_RESEAU)), regle(destructure(noms.join('|')), MSG_RESEAU)];
const RESEAU = reseau(NOMS_RESEAU);
// Exécuteur de la synchronisation automatique : `fetch` seulement, aucune autre API réseau.
const AUTRES_RESEAU = NOMS_RESEAU.filter((nom) => nom !== 'fetch');
const RESEAU_SAUF_FETCH = reseau(AUTRES_RESEAU);

const GLOBALES_STOCKAGE = ['cookieStore', 'localStorage', 'sessionStorage', 'indexedDB'];
// Lecture : tout accès aux cookies et au stockage (`document.cookie`, `window['localStorage']`…).
const NOMS_STOCKAGE = ['cookie', ...GLOBALES_STOCKAGE];
const STOCKAGE = [...NOMS_STOCKAGE.map((nom) => regle(membre(nom), MSG_STOCKAGE)), regle(destructure(NOMS_STOCKAGE.join('|')), MSG_STOCKAGE)];

const STOCKAGES_WEB = ['localStorage', 'sessionStorage'];
const ecrireSur = (nom) =>
  `AssignmentExpression:matches([left.object.name='${nom}'], [left.object.property.name='${nom}'], [left.object.property.value='${nom}'])`;
const supprimerSur = (nom) =>
  `UnaryExpression[operator='delete']:matches([argument.object.name='${nom}'], [argument.object.property.name='${nom}'], [argument.object.property.value='${nom}'])`;
const appelerSur = (nom, methodes) =>
  `CallExpression[callee.property.name=/^(${methodes})$/]:matches([callee.object.name='${nom}'], [callee.object.property.name='${nom}'], [callee.object.property.value='${nom}'])`;

// Écritures : interdites partout, jeton.ts compris.
const ECRITURES = [
  regle("AssignmentExpression:matches([left.property.name='cookie'], [left.property.value='cookie'], [left.property.type='TemplateLiteral'][left.property.quasis.0.value.cooked='cookie'])", MSG_ECRITURE),
  regle("UpdateExpression[argument.property.name='cookie']", MSG_ECRITURE),
  regle(appelerSur('cookieStore', 'set|delete'), MSG_ECRITURE),
  ...STOCKAGES_WEB.flatMap((nom) => [
    regle(ecrireSur(nom), MSG_ECRITURE),
    regle(supprimerSur(nom), MSG_ECRITURE),
    regle(appelerSur(nom, 'setItem|removeItem|clear'), MSG_ECRITURE),
  ]),
];

// Méthodes d'écriture génériques (indexedDB, Storage) : bannies seulement dans jeton.ts (Set.add, Map.clear ailleurs).
const METHODES_ECRITURE = 'setItem|removeItem|clear|deleteDatabase|createObjectStore|deleteObjectStore|createIndex|deleteIndex|put|add|delete|update';
const ECRITURES_JETON = [
  regle(`CallExpression:matches([callee.property.name=/^(${METHODES_ECRITURE})$/], [callee.property.value=/^(${METHODES_ECRITURE})$/])`, MSG_ECRITURE),
  // `const { setItem } = localStorage` : méthode d'écriture détachée.
  regle(destructure(METHODES_ECRITURE), MSG_ECRITURE),
  // Transactions en écriture et montée de version d'une base.
  regle("Literal[value=/^(readwrite|versionchange)$/]", MSG_ECRITURE),
  regle(appelerSur('indexedDB', 'open') + '[arguments.length>1]', MSG_ECRITURE),
];

const ALEA = [
  regle("MemberExpression:matches([object.name='Math'], [object.property.name='Math']):matches([property.name='random'], [property.value='random'])", MSG_ALEA),
  regle("MemberExpression:matches([property.name=/^(getRandomValues|randomUUID)$/], [property.value=/^(getRandomValues|randomUUID)$/])", MSG_ALEA),
  regle(destructure('random|getRandomValues|randomUUID'), MSG_ALEA),
];

const IMPORT_JETON = [
  regle("ImportExpression[source.value=/(^|\\/)jeton(\\.[jt]s)?$/]", MSG_JETON),
  regle("CallExpression[callee.name='require'][arguments.0.value=/(^|\\/)jeton(\\.[jt]s)?$/]", MSG_JETON),
];

const globales = (noms, message) => noms.map((name) => ({ name, message }));
const GLOBALES = (reseau, stockage) => [
  ...(reseau === 'sauf-fetch' ? globales(GLOBALES_RESEAU.filter((nom) => nom !== 'fetch'), MSG_RESEAU) : reseau ? globales(GLOBALES_RESEAU, MSG_RESEAU) : []),
  ...(stockage ? globales(GLOBALES_STOCKAGE, MSG_STOCKAGE) : []),
];

const PATTERNS_JETON = { patterns: [{ regex: '(^|/)jeton(\\.[jt]s)?$', message: MSG_JETON }] };

// Composition d'un bloc : `site` = code exécuté sur le site (aucune action, aucun HTML).
function regles({ site = false, reseau = true, stockage = true, alea = false, jeton = true, idb = false } = {}) {
  const syntaxe = [
    ...(site ? HTML : [HTML[0], HTML[1]]),
    ...(site ? ACTIONS : []),
    ...(reseau === 'sauf-fetch' ? RESEAU_SAUF_FETCH : reseau ? RESEAU : []),
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
    // Seul fichier du content script autorisé à appeler `fetch` (GET même origine, voir synchro-auto-lint.test.ts).
    files: ['src/content/synchroAuto.ts'],
    rules: regles({ site: true, reseau: 'sauf-fetch', alea: true }),
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
