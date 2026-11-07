import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'playwright-report/', 'test-results/', 'specs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Verrou réseau (AGENTS.md) : aucun contact avec le site ni avec un serveur.
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({ name, message: 'Interdit par AGENTS.md : verrou réseau.' })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'Interdit par AGENTS.md : verrou réseau.' },
        { object: 'chrome', property: 'cookies', message: 'Interdit par AGENTS.md : pas de lecture de session.' },
        { object: 'chrome', property: 'scripting', message: 'Interdit par AGENTS.md : pas d’injection dans le site.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
      ],
    },
  },
  {
    // Le code exécuté sur le site lit et affiche, mais n'agit jamais à la place du joueur.
    files: ['src/content/**/*.ts', 'src/lib/lecteur.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        ...['click', 'submit', 'requestSubmit', 'dispatchEvent', 'focus'].map((nom) => ({
          selector: `CallExpression[callee.property.name='${nom}']`,
          message: 'Interdit par AGENTS.md : aucune action sur le site à la place du joueur.',
        })),
      ],
    },
  },
  {
    files: ['.claude/hooks/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);
