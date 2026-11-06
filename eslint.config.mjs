import js from '@eslint/js';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodePackages = ['shared/**/*.ts', 'content/**/*.ts'];

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', 'app/expo-env.d.ts'],
  },
  ...expoConfig.map((config) => ({ ...config, files: ['app/**/*.{js,jsx,ts,tsx}'] })),
  {
    // eslint-plugin-react's 'detect' calls an API that ESLint 10 removed.
    files: ['app/**/*.{js,jsx,ts,tsx}'],
    settings: { react: { version: '19.3' } },
  },
  ...[js.configs.recommended, ...tseslint.configs.recommended].map((config) => ({
    ...config,
    files: nodePackages,
  })),
  {
    files: nodePackages,
    languageOptions: { globals: globals.node },
  },
  prettierConfig,
];
