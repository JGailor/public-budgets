import { describe, expect, it } from 'vitest';
import worker from '../../worker/index';
import { wwwRedirect } from '../../worker/redirect';

describe('www redirect', () => {
  it('sends www to the apex, keeping path and query', () => {
    expect(wwwRedirect(new URL('https://www.wherethemoneywent.com/us/ca/berkeley/gap/?year=2028'))).toBe(
      'https://wherethemoneywent.com/us/ca/berkeley/gap/?year=2028',
    );
  });

  it('leaves the apex, previews and workers.dev alone', () => {
    for (const u of [
      'https://wherethemoneywent.com/',
      'https://pr-1-wherethemoneywent.example.workers.dev/',
      'http://localhost:8787/',
    ]) {
      expect(wwwRedirect(new URL(u))).toBeNull();
    }
  });

  it('answers www with a 301 and passes everything else to the assets', async () => {
    const served: string[] = [];
    const env = { ASSETS: { fetch: async (r: Request) => (served.push(r.url), new Response('asset')) } };

    const redirect = await worker.fetch(new Request('https://www.wherethemoneywent.com/x'), env);
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('location')).toBe('https://wherethemoneywent.com/x');

    const page = await worker.fetch(new Request('https://wherethemoneywent.com/x'), env);
    expect(await page.text()).toBe('asset');
    expect(served).toEqual(['https://wherethemoneywent.com/x']);
  });
});
