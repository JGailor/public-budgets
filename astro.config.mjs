// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://publicbudgets.org',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
