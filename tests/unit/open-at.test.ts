import { describe, expect, it } from 'vitest';
import { openAt } from '../../src/lib/open-at';

describe('openAt (#30)', () => {
  const pdf = { url: 'https://berkeleyca.gov/a.pdf', format: 'PDF' };
  it('opens a PDF at the quoted page, and says so', () => {
    expect(openAt(pdf, 55)).toEqual({ href: 'https://berkeleyca.gov/a.pdf#page=55', label: 'Open the PDF at page 55 ↗' });
  });
  it('opens a PDF with no page at its start', () => {
    expect(openAt(pdf)).toEqual({ href: pdf.url, label: 'Open the PDF ↗' });
  });
  it('leaves a web page alone, page or not', () => {
    expect(openAt({ url: 'https://example.com/story', format: 'Web page' }, 3)).toEqual({ href: 'https://example.com/story', label: 'Open the source ↗' });
  });
});
