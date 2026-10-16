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
| `npm run data` | Rebuilds each city's `budget.json` from its workbook and validates it |
| `npm run build` | Checks `budget.json` is current and valid, then builds the site into `dist/` |
| `npm run test:dist` | Tests against the built site (`tests/dist/`); run after `build` |
| `npm run test:e2e` | Browser tests against the built site via `wrangler dev`: no horizontal scroll at 390px/768px, no nav overlap at 1024px+, fonts, menus. Run after `build` |
| `scripts/smoke.sh <url>` | HTTP checks against a running or deployed site: 200s for real pages, 404s for unknown cities |

CI (`.github/workflows/ci.yml`) runs lint, unit tests, build and dist tests on every PR and on `main`. Every step runs under `bash` with `pipefail`, so a failure can't be hidden behind a pipe.

## Design tokens and the shell

`src/styles/tokens.css` holds the epic's colors, fonts and layout values as CSS custom properties. Red means only "money short" (deficits and cuts) and gold only one-time money; don't use either for decoration. Headlines are set in Gelasio (metric-compatible with Georgia) and UI and numbers in Nunito Sans (an open stand-in for Avenir Next), both self-hosted from `@fontsource`. Tables and `.num` use tabular numerals.

Every page renders inside `src/layouts/Base.astro`: the dark top strip (path, independence line, "Report an error"), the header (full nav at 1024px and up, compact `WTMW` header with a menu below), and the footer. Nav links come from `CITY_PAGES` in `src/lib/city-pages.ts`; the "19 sources" pill counts the city's sources from its data. At 1024px the nav has about 50px to spare, so adding pages to the nav needs a layout change; the browser tests will fail if items overlap.

## Where city data lives

```
data/cities/{country}/{state}/{city}/city.json
```

Each folder is one city, and its path is its URL: `data/cities/us/ca/berkeley/` is served at `/us/ca/berkeley/`. `src/lib/cities.ts` loads the registry at build time and fails the build if a `city.json` is missing a field or its `countryCode`/`stateCode` disagree with the folder.

Every city gets an overview at its root plus the sub-pages in `CITY_PAGES` (`/gap/`, `/departments/`, `/sources/`). A path that isn't in the registry is a 404.

**To add a city**, create its folder and `city.json` (copy Berkeley's). The budget data for each city lives in the same folder.

### Budget data: workbook → `budget.json`

Nothing on the site is typed in by hand. Each city's numbers come from a source workbook committed beside it:

```
data/cities/us/ca/berkeley/
  city.json
  source/Berkeley_Budget_FY25-FY28.xlsx   the workbook (compiled from public documents)
  budget.json                            generated from it: commit both together
```

`npm run data` extracts the workbook into `budget.json` (`src/data/berkeley/extract.ts`) and validates it (`src/data/berkeley/validate.ts`). `npm run build` first runs `npm run data:check`, which fails the build if any check breaks or if `budget.json` doesn't match the workbook. So **after editing the workbook, run `npm run data` and commit both files.**

- **Every record carries a receipt:** `source` (S1–S19, rows of the *Sources & Links* tab; S1–S10 are City documents, S11–S19 news), optional `related` sources, and the workbook `table` and `row` it came from.
- **Derived numbers are computed, not read.** The workbook doesn't store results for all of its formulas, so the extractor reads typed-in inputs and TOTAL rows, computes everything else, and checks its arithmetic against every result Excel did store.
- **Validation** ties every TOTAL row to its lines and pins the City's headline figures (FY27 department baselines $283,764,035, the FY27 gap −$29,249,339, …). A moved column, a changed source line, or a formula typed over an input cell stops the build with the cell address.
- **Skipped on purpose:** the *Scenario Model* tab (its "gap remaining" counts the sales-tax money twice).
- **Downloads:** the build publishes `/us/ca/berkeley/data/budget.json`, one CSV per table, and the original workbook.

Pages read the data with `budgetFor(city)` from `src/lib/budget.ts`.

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
