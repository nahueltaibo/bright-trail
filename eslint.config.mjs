import js from '@eslint/js';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodePackages = [
  'shared/**/*.ts',
  'content/**/*.ts',
  'feedback-worker/**/*.{ts,mjs}',
  'feedback/**/*.ts',
];

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
  {
    // Styles are built at import, so kid screens follow the dyslexia font only through this Text.
    files: [
      'app/src/app/child/**',
      'app/src/components/**',
      'app/src/design/kid.tsx',
      'app/src/feedback/**',
      'app/src/learning/**',
      'app/src/narration/**',
    ],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message: 'Use Text from app/src/design/Text, which follows the dyslexia font.',
            },
          ],
        },
      ],
    },
  },
  ...[js.configs.recommended, ...tseslint.configs.recommended].map((config) => ({
    ...config,
    files: nodePackages,
  })),
  {
    files: nodePackages,
    languageOptions: { globals: globals.node },
  },
  {
    ...js.configs.recommended,
    files: ['feedback-worker/public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'module' },
  },
  prettierConfig,
];
