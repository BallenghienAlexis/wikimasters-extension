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
    files: ['.claude/hooks/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);
