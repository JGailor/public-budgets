/**
 * Sub-pages every city gets, besides its overview at the city root.
 * `label` is the nav link; pages with `nav: false` are linked from the footer only.
 */
export const CITY_PAGES = [
  { slug: 'gap', title: 'The gap', label: 'The Gap', nav: true },
  { slug: 'departments', title: 'Departments', label: 'Departments', nav: true },
  { slug: 'sources', title: 'Sources & methods', label: 'Sources', nav: true },
  { slug: 'glossary', title: 'Glossary', label: 'Glossary', nav: false },
] as const;

export type CityPageSlug = (typeof CITY_PAGES)[number]['slug'];
