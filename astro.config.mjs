// @ts-check
import { defineConfig } from 'astro/config';
import sourceUsage from './src/integrations/source-usage.ts';

export default defineConfig({
  site: 'https://wherethemoneywent.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [sourceUsage()],
});
