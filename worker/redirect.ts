export const APEX = 'wherethemoneywent.com';

/** The apex URL to redirect to, or null if this request should be served as-is. */
export function wwwRedirect(url: URL): string | null {
  if (url.hostname !== `www.${APEX}`) return null;
  const target = new URL(url);
  target.hostname = APEX;
  return target.toString();
}
