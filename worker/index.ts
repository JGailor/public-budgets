/**
 * The only code that runs at the edge. Everything else is static files.
 * It exists for one job: www.wherethemoneywent.com → wherethemoneywent.com.
 * All other requests go straight to the built assets (dist/), which also
 * serve dist/404.html with a 404 status for unknown paths.
 *
 * Keep this module to its default export: workerd treats every named export
 * of the entry module as an entrypoint and refuses to start on anything else.
 */
import { wwwRedirect } from './redirect';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const target = wwwRedirect(new URL(request.url));
    if (target) return Response.redirect(target, 301);
    return env.ASSETS.fetch(request);
  },
};
