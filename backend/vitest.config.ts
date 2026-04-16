import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000,
    // Carga .env automaticamente antes de los tests
    env: {
      DATABASE_URL: 'postgresql://pulse:pulse@localhost:5432/pulse',
    },
  },
});
