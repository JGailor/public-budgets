/**
 * A figure that opens its own receipt (#29) is an inline <button> inside a sentence:
 * "(<button class="sourced">$24.0M</button>)". Turning every tag into a space, as the
 * page-text helpers do so block elements don't run together, would read that as
 * "( $24.0M )". Unwrap these buttons first so the sentence reads as it renders.
 */
export const unwrapFigures = (html: string) => html.replace(/<button[^>]*\bclass="sourced\b[^"]*"[^>]*>([^<]*)<\/button>/g, '$1');
