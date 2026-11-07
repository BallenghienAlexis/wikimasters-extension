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
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
      ],
    },
  },
  {
    // Le code exécuté sur le site lit et affiche, mais n'agit jamais à la place du joueur.
    files: ['src/content/**/*.ts', 'src/lib/**/*.ts', 'src/config/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        { selector: "AssignmentExpression[left.property.name='outerHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        { selector: "CallExpression[callee.property.name='write'][callee.object.name='document']", message: 'Interdit par AGENTS.md : rendre les données en texte.' },
        ...['click', 'submit', 'requestSubmit', 'dispatchEvent', 'focus'].map((nom) => ({
          selector: `CallExpression[callee.property.name='${nom}'], CallExpression[callee.property.value='${nom}']`,
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
