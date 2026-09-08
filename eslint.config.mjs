import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
  {
    files: ['__tests__/**/*.ts'],
    ...jest.configs['flat/recommended'],
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.js', '*.mjs'],
  }
)
