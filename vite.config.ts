import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // Sinon le mode --watch efface content.js, construit à part. `npm run build` vide dist/ lui-même.
    emptyOutDir: false,
    rollupOptions: {
      input: {
        collection: 'collection.html',
        background: 'src/background.ts',
      },
      output: {
        // Le manifeste cite background.js : ce nom doit rester stable.
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
