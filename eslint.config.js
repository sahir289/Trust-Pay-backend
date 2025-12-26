import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['src/examples/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,  
        process: 'readonly',
      },
    },
  },
  pluginJs.configs.recommended,
];
