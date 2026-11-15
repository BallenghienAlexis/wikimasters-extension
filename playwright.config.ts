import { defineConfig } from '@playwright/test';

// Chaque test ouvre son propre contexte persistant : les fichiers peuvent donc tourner en parallèle.
// En CI, le travail est réparti en tranches (`--shard`, un job par tranche) de 2 processus chacune
// (les exécuteurs GitHub d’un dépôt privé ont 2 cœurs). Le test de durée (@perf) mesure un temps
// d’affichage : il passe seul, après les autres, dans le projet `perf`.
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: false,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  projects: [
    { name: 'principal', grepInvert: /@perf/ },
    { name: 'perf', grep: /@perf/, dependencies: ['principal'], fullyParallel: false },
  ],
});
