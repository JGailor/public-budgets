/**
 * Sub-pages every city gets, besides its overview at the city root, in nav order
 * (the mockup's: Overview, Revenue, The Gap, Departments, Ballot, Capital, Sources).
 * `label` is the nav link; pages with `nav: false` are linked from the footer only.
 */
export const CITY_PAGES = [
  { slug: 'revenue', title: 'Revenue', label: 'Revenue', nav: true },
  { slug: 'gap', title: 'The gap', label: 'The Gap', nav: true },
  { slug: 'departments', title: 'Departments', label: 'Departments', nav: true },
  { slug: 'ballot', title: 'Your ballot', label: 'Ballot', nav: true },
  { slug: 'sources', title: 'Sources & methods', label: 'Sources', nav: true },
  { slug: 'glossary', title: 'Glossary', label: 'Glossary', nav: false },
] as const;

export type CityPageSlug = (typeof CITY_PAGES)[number]['slug'];
