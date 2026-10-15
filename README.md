# Where the Money Went

Live at **[wherethemoneywent.com](https://wherethemoneywent.com)** (WTMW for short).

City budgets, made readable. Every number on the site links to the public document it came from.

Independent. Not affiliated with any city government.

## Stack, and why

**[Astro](https://astro.build), static output, served by Cloudflare Workers static assets.**

- Astro renders every page to plain HTML at build time and ships **zero JavaScript by default**. The few interactive pieces (charts, toggles, the source receipt drawer) opt in as [islands](https://docs.astro.build/en/concepts/islands/), so they're the only JS on the page. Everything else works with JS off, loads fast on a phone, and is easy for search engines and screen readers.
- Routes come from data. `getStaticPaths` reads the city registry, so adding a city doesn't touch routing code.
- Cloudflare serves `dist/`. Unknown paths get `dist/404.html` with a real 404 status (`not_found_handling: "404-page"` in `wrangler.jsonc`). The only edge code is `worker/index.ts`, which redirects `www` to the apex and hands every other request to the static files.

## Running locally

Needs Node 22.22+ (`.nvmrc` pins 24; run `nvm use`).

```bash
npm install
npm run dev          # http://localhost:4321, hot reload
npm run preview      # build, then serve dist/ through wrangler, exactly as Cloudflare will (incl. 404s)
```

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint plus `astro check` (types in `.astro` and `.ts`) |
| `npm test` | Unit tests (`tests/unit/`), no build needed |
| `npm run build` | Builds the site into `dist/` |
| `npm run test:dist` | Tests against the built site (`tests/dist/`); run after `build` |
| `scripts/smoke.sh <url>` | HTTP checks against a running or deployed site: 200s for real pages, 404s for unknown cities |

CI (`.github/workflows/ci.yml`) runs lint, unit tests, build and dist tests on every PR and on `main`. Every step runs under `bash` with `pipefail`, so a failure can't be hidden behind a pipe.

## Where city data lives

```
data/cities/{country}/{state}/{city}/city.json
```

Each folder is one city, and its path is its URL: `data/cities/us/ca/berkeley/` is served at `/us/ca/berkeley/`. `src/lib/cities.ts` loads the registry at build time and fails the build if a `city.json` is missing a field or its `countryCode`/`stateCode` disagree with the folder.

Every city gets an overview at its root plus the sub-pages in `CITY_PAGES` (`/gap/`, `/departments/`, `/sources/`). A path that isn't in the registry is a 404.

**To add a city**, create its folder and `city.json` (copy Berkeley's). The budget data for each city lives in the same folder.

## Deploying

The site is the Cloudflare Worker `wherethemoneywent`. Production is served on the custom domains `wherethemoneywent.com` and `www.wherethemoneywent.com` (declared in `wrangler.jsonc`), and `www` 301s to the apex.

- **Production** deploys from `main`: on every push, CI runs `wrangler deploy`, then smoke-tests both the workers.dev URL and `https://wherethemoneywent.com` (including the `www` redirect).
- **Every PR** gets a preview: CI uploads a version with `wrangler versions upload --preview-alias pr-<number>`, smoke-tests it, and comments the URL on the PR (`https://pr-<number>-wherethemoneywent.<subdomain>.workers.dev`). Fork PRs don't get secrets, so they skip this.

### One-time setup

1. Create a Cloudflare API token (dash → My Profile → API Tokens → *Edit Cloudflare Workers* template), scoped to the account.
2. Add two repo secrets (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN`: the token
   - `CLOUDFLARE_ACCOUNT_ID`: the account ID (`npx wrangler whoami` prints it)
3. The `wherethemoneywent.com` zone must be active in the same Cloudflare account, because the custom-domain routes fail to attach otherwise.
4. The first production deploy creates the Worker. Preview aliases only work once it exists, so either merge to `main` first or run `npm run deploy` once by hand.

Until the secrets exist, the deploy jobs fail with an error that points here. The lint/test/build job runs on its own regardless.

To deploy by hand: `npx wrangler login`, then `npm run deploy`.
