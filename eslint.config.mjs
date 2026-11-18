import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'node_modules/**',
      'backups/**',
      'Yedek/**',
      'scratch/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Mevcut kod tabanında yaygın legacy any kullanımları ayrı tip sıkılaştırma adımına bırakıldı.
      '@typescript-eslint/no-explicit-any': 'off',
      // Türkçe UI metinlerindeki kesme/tırnak işaretlerinde gereksiz uyarı üretmesini önler.
      'react/no-unescaped-entities': 'off',
    },
  },
];

export default eslintConfig;
