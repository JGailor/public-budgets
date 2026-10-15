import { describe, expect, it } from 'vitest';
import { buildRegistry, cities, parseCity } from '../../src/lib/cities';

const berkeley = {
  name: 'Berkeley',
  state: 'California',
  stateCode: 'CA',
  country: 'United States',
  countryCode: 'US',
  government: 'City of Berkeley',
};

describe('city registry', () => {
  it('loads Berkeley from data/cities', () => {
    expect(cities.map((c) => c.path)).toEqual(['/us/ca/berkeley/']);
    expect(cities[0].slug).toEqual({ country: 'us', state: 'ca', city: 'berkeley' });
  });

  it('derives the route from the folder, so a second city is data, not code', () => {
    const reg = buildRegistry({
      '/data/cities/us/ca/berkeley/city.json': berkeley,
      '/data/cities/us/ca/oakland/city.json': { ...berkeley, name: 'Oakland', government: 'City of Oakland' },
    });
    expect(reg.map((c) => c.path)).toEqual(['/us/ca/berkeley/', '/us/ca/oakland/']);
  });

  it('rejects a city.json whose codes disagree with its folder', () => {
    expect(() => parseCity('/data/cities/us/ny/berkeley/city.json', berkeley)).toThrow(/stateCode "CA"/);
  });

  it('rejects a missing field', () => {
    const { government: _omit, ...partial } = berkeley;
    void _omit;
    expect(() => parseCity('/data/cities/us/ca/berkeley/city.json', partial)).toThrow(/missing "government"/);
  });

  it('rejects path segments that are not URL-safe', () => {
    expect(() => parseCity('/data/cities/us/ca/San Jose/city.json', berkeley)).toThrow(/path segment/);
  });
});
