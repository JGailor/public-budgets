// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wherethemoneywent.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
