/**
 * The city registry. Every folder at data/cities/{country}/{state}/{city}/
 * holding a city.json is a city, and gets its pages generated. Adding a city
 * is adding a folder; no routing code changes.
 */

export interface CityMeta {
  name: string;
  state: string;
  stateCode: string;
  country: string;
  countryCode: string;
  government: string;
}

export interface City extends CityMeta {
  /** URL segments, lowercase: { country: 'us', state: 'ca', city: 'berkeley' } */
  slug: { country: string; state: string; city: string };
  /** Site path with trailing slash, e.g. /us/ca/berkeley/ */
  path: string;
}

/** Sub-pages every city gets, besides its overview at the city root. */
export const CITY_PAGES = [
  { slug: 'gap', title: 'The gap' },
  { slug: 'departments', title: 'Departments' },
  { slug: 'sources', title: 'Sources & methods' },
] as const;

export type CityPageSlug = (typeof CITY_PAGES)[number]['slug'];

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED: (keyof CityMeta)[] = ['name', 'state', 'stateCode', 'country', 'countryCode', 'government'];

/** Turns a registry file path plus its parsed JSON into a City, or throws with the reason. */
export function parseCity(file: string, meta: unknown): City {
  const m = file.match(/data\/cities\/([^/]+)\/([^/]+)\/([^/]+)\/city\.json$/);
  if (!m) throw new Error(`${file}: not at data/cities/{country}/{state}/{city}/city.json`);
  const [, country, state, city] = m;
  for (const seg of [country, state, city]) {
    if (!SEGMENT.test(seg)) throw new Error(`${file}: path segment "${seg}" must be lowercase letters, digits and hyphens`);
  }
  if (typeof meta !== 'object' || meta === null) throw new Error(`${file}: expected a JSON object`);
  const record = meta as Record<string, unknown>;
  for (const key of REQUIRED) {
    if (typeof record[key] !== 'string' || record[key] === '') throw new Error(`${file}: missing "${key}"`);
  }
  const typed = record as unknown as CityMeta;
  if (typed.countryCode.toLowerCase() !== country) {
    throw new Error(`${file}: countryCode "${typed.countryCode}" does not match folder "${country}"`);
  }
  if (typed.stateCode.toLowerCase() !== state) {
    throw new Error(`${file}: stateCode "${typed.stateCode}" does not match folder "${state}"`);
  }
  return { ...typed, slug: { country, state, city }, path: `/${country}/${state}/${city}/` };
}

/** Builds the registry from {path: json} entries; rejects duplicates, sorts by path. */
export function buildRegistry(entries: Record<string, unknown>): City[] {
  const cities = Object.entries(entries).map(([file, json]) => parseCity(file, json));
  const seen = new Set<string>();
  for (const c of cities) {
    if (seen.has(c.path)) throw new Error(`duplicate city ${c.path}`);
    seen.add(c.path);
  }
  return cities.sort((a, b) => a.path.localeCompare(b.path));
}

const files = import.meta.glob('/data/cities/*/*/*/city.json', { eager: true, import: 'default' });

export const cities: City[] = buildRegistry(files);

/** getStaticPaths result for a city route: one entry per registered city. */
export function cityStaticPaths() {
  return cities.map((city) => ({ params: city.slug, props: { city } }));
}
