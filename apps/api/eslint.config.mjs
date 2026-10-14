import { base } from '../../eslint.config.mjs';

export default [
  ...base,
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];
