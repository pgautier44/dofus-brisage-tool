/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : permet de servir le build depuis n'importe quel sous-dossier
  // (ex: GitHub Pages à /dofus-brisage-tool/forge/) sans config supplémentaire.
  base: './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
