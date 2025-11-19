// import js from "@eslint/js";
// import globals from "globals";
// import pluginReact from "eslint-plugin-react";
// import { defineConfig } from "eslint/config";

// export default defineConfig([
//   { files: ["**/*.{js,mjs,cjs,jsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
//   { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
//   pluginReact.configs.flat.recommended,
// ]);

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'error',
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
<<<<<<< HEAD
        ...globals.jest,
=======
        ...globals.browser,
        ...globals.node,  
        process: 'readonly',
>>>>>>> 91bf8e9640b076d4154615c2b49e6596ff8a7373
      },
    },
  },
];