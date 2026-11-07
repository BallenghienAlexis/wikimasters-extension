import { defineConfig } from 'vite';

// Un content script ne peut pas être un module : il est construit à part, en un seul fichier.
export default defineConfig({
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: 'src/content/index.ts',
      formats: ['iife'],
      name: 'wmContenu',
      fileName: () => 'content.js',
    },
  },
});
