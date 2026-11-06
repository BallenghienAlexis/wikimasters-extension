import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
