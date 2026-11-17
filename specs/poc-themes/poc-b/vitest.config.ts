import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['specs/poc-themes/poc-b/*.test.ts'] },
});
