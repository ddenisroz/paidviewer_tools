import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

export default [
  {
    ignores: ['dist', 'node_modules', 'build', 'src/tests/**/*', '*.config.js', '*.config.ts', '*.cjs', 'scripts/**/*'],
  },
  js.configs.recommended,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
    plugins: {
      'import': importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      // TypeScript правила - строгие для качества
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // React правила
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
      
      // Code quality правила
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'warn',
      'no-duplicate-imports': 'off', // Отключаем в пользу import/no-duplicates
      
      // Complexity metrics are tracked in reviews, not as lint warnings.
      'max-lines-per-function': 'off',
      'max-depth': 'off',
      'complexity': 'off',
      
      // Import правила - организация и качество импортов
      'import/no-duplicates': 'error',
      'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import/first': 'error',
      'import/newline-after-import': 'warn',
      'import/no-absolute-path': 'error',
      'import/order': ['warn', {
        groups: [
          'builtin',   // Node.js встроенные модули
          'external',  // npm пакеты
          'internal',  // Внутренние алиасы (@/)
          'parent',    // ../
          'sibling',   // ./
          'index',     // ./index
          'type',      // import type
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        pathGroups: [
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: 'react',
            group: 'external',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['react', 'type'],
      }],
      
      // Сортировка импортов внутри группы
      'sort-imports': ['warn', {
        ignoreCase: true,
        ignoreDeclarationSort: true, // Используем import/order для сортировки деклараций
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      }],
    },
  },
]
