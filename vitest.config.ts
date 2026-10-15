/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    projects: [
      // Pure-function tests; no build needed.
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      // Assertions about the built site. Run after `npm run build`.
      { extends: true, test: { name: 'dist', include: ['tests/dist/**/*.test.ts'] } },
    ],
  },
});
