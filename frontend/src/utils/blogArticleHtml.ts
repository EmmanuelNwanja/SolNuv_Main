/**
 * Normalize and split blog HTML for readable rendering and in-article ad placement.
 */

/** Turn common "wall of text" patterns (br chains, unwrapped text) into paragraphs before sanitize. */
export function loosenHtmlToParagraphs(html: string): string {
  let s = String(html || '').trim();
  if (!s) return s;

  s = s.replace(/(<br\s*\/?>(\s|\r|\n)*){2,}/gi, '</p><p>');

  const hasBlock = /<\s*(p|h[1-6]|ul|ol|blockquote|div|pre|hr|section|article|table)\b/i.test(s);
  if (!hasBlock) {
    return `<p>${s}</p>`;
  }

  if (!/<\s*p[\s>\/]/i.test(s) && /<\s*br\b/i.test(s)) {
    s = `<p>${s.replace(/<br\s*\/?>/gi, '</p><p>')}</p>`;
  }

  return s;
}

/**
 * Split HTML into top-level block chunks for per-block rendering.
 * Unwraps a single wrapper &lt;div&gt; when it is the only root element (common paste pattern).
 */
export function splitTopLevelBlocks(html: string): string[] {
  const trimmed = String(html || '').trim();
  if (!trimmed) return [];

  if (typeof window === 'undefined') {
    return [trimmed];
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div data-blog-root="1">${trimmed}</div>`, 'text/html');
    const root = doc.querySelector('[data-blog-root="1"]');
    if (!root) return [trimmed];

    let container: Element = root;
    if (root.childElementCount === 1) {
      const only = root.firstElementChild;
      if (only && only.tagName === 'DIV' && only.childElementCount > 0) {
        container = only;
      }
    }

    if (container.childElementCount === 0) {
      return trimmed ? [trimmed] : [];
    }

    const chunks = Array.from(container.children).map((el) => el.outerHTML);
    return chunks.length ? chunks : trimmed ? [trimmed] : [];
  } catch {
    return [trimmed];
  }
}
