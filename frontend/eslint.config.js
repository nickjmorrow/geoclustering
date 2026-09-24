import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * The frontend's half of the contract in AGENTS.md: the broad recommended
 * sets, then individual rules turned off with a note saying why. An `off`
 * with a reason is a decision someone can argue with later.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      unicorn.configs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { perfectionist },
    rules: {
      // ---- House rules, enforced ----------------------------------------

      // Absolute imports only (`src/api/client`): relative paths stop being
      // readable about three directories in.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Absolute imports only: use `src/...`.',
            },
          ],
        },
      ],

      // A promise nobody awaits is an error nobody sees.
      '@typescript-eslint/no-floating-promises': 'error',

      // Types are imported as types, so a type-only import can never pull a
      // module into the bundle at runtime.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],

      // A server logs; a browser app in production should not be narrating to
      // the console. `console.error` stays for the ErrorBoundary, which is the
      // only record that exists when a render throws.
      'no-console': ['error', { allow: ['error'] }],

      // ---- Ordering ------------------------------------------------------
      //
      // Worth enforcing precisely because it is arbitrary: nobody should spend
      // a review comment on it.
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'style'],
          internalPattern: ['^src/.*'],
          newlinesBetween: 'ignore',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-jsx-props': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-named-imports': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-objects': ['error', { type: 'alphabetical' }],

      // NOT enabled: sort-interfaces / sort-object-types. The wire shapes in
      // `src/api/clustering.ts` mirror the field order of the C# records in
      // `backend/`, and keeping the two greppable side by side is worth more
      // than alphabetising them.

      // ---- Accommodations, with reasons ----------------------------------

      // Effect cleanups are `() => clearTimeout(t)` and `() => controller.abort()`.
      // That shorthand is the React idiom; the rule's real target is a
      // non-void function that returns a void call by accident.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],

      // A number in a template string is the normal case.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

      // `while (true)` is sometimes the clearest loop.
      '@typescript-eslint/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],

      // ---- unicorn: off, and why -----------------------------------------

      // `null` is the wire format: the API sends `null` for a cluster with no
      // route, and `undefined` does not survive JSON.
      'unicorn/no-null': 'off',

      // Would rename `props` to `properties` and `ref` to `reference`. Those
      // are React's own vocabulary, not abbreviations we chose.
      'unicorn/name-replacements': 'off',

      // Wants every one-line `/** ... */` expanded to three lines. The concise
      // form is used deliberately for short field notes.
      'unicorn/single-line-block-comment-style': 'off',

      // Both prefer a shape this codebase chose against: an early return for
      // the uninteresting case, then the body unindented.
      'unicorn/prefer-ternary': 'off',
      'unicorn/prefer-early-return': 'off',

      // Browser-only app. `window.location` says where it runs; `globalThis`
      // is for code that has to work in both.
      'unicorn/prefer-global-this': 'off',

      // `getElementById` is not worse than `querySelector('#id')`.
      'unicorn/prefer-query-selector': 'off',

      // Contentious enough that it should not be decided by a default.
      'unicorn/no-array-reduce': 'off',

      // `[...map.values()].sort(...)` already sorts a fresh array, so the
      // mutation these warn about cannot happen. `toSorted` and
      // `Iterator.toArray` buy nothing here.
      'unicorn/no-array-sort': 'off',
      'unicorn/prefer-iterator-to-array': 'off',

      // `response.json().catch(() => null)` is clearer than the try/await form
      // for "parse it if you can, otherwise nothing".
      'unicorn/prefer-await': 'off',

      // Separate guards are often separate reasons, each with its own comment.
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/prefer-combined-guards': 'off',

      // ---- unicorn: configured rather than disabled ----------------------

      // PascalCase for a component (`ClusterMap.tsx`), camelCase for a hook
      // or a module (`useUploads.ts`, `dendrogram.ts`), not kebab-case.
      'unicorn/filename-case': ['error', { cases: { camelCase: true, pascalCase: true } }],

      // `caught`, not `error` — there is already an `error` in scope in the
      // places this matters, and shadowing it is how you log the wrong one.
      'unicorn/catch-error-name': ['error', { name: 'caught' }],
    },
  },

  {
    files: ['**/*.tsx'],
    extends: [jsxA11y.flatConfigs.strict],
    plugins: { react, 'react-refresh': reactRefresh },
    settings: { react: { version: '19.0' } },
    rules: {
      // Place names come from uploaded files. They are text, always.
      'react/no-danger': 'error',

      // "One component per file, default export, named to match the file."
      //
      // `react-refresh/only-export-components` only looks at what a file
      // exports; this counts what it defines.
      'react/no-multi-comp': ['error', { ignoreStateless: false }],

      // A component file exports its component and nothing else. A helper that
      // a second file wants belongs in a .ts module, where importing it does
      // not drag a component along behind it.
      'react-refresh/only-export-components': ['error', { allowConstantExport: false }],
    },
  },

  reactHooks.configs.flat.recommended,

  // Build files run in Node and are not part of the browser program.
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-restricted-imports': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },

  // Last: turns off everything Prettier owns, so formatting is never two tools'
  // opinion at once.
  prettier,
);
