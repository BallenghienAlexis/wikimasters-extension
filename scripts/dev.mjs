// Reconstruit dist/ en continu : la page et le content script ont chacun leur build.
import { spawn } from 'node:child_process';

const COMMANDES = ['vite build --watch', 'vite build --watch --config vite.content.config.ts'];

const processus = COMMANDES.map((commande) => spawn(`npx ${commande}`, { stdio: 'inherit', shell: true }));

process.on('SIGINT', () => {
  for (const enfant of processus) enfant.kill();
  process.exit(0);
});
