/** Keep document formatting, without allowing active HTML from generated or edited content. */
export function sanitizeDocumentHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const tags = new Set(['ARTICLE', 'SECTION', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BR', 'HR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'BLOCKQUOTE', 'PRE', 'CODE', 'A']);
  document.querySelectorAll('script, style, iframe, object, embed, form, input, button, textarea, select, svg, math, template, link, meta, base').forEach(element => element.remove());
  document.body.querySelectorAll('*').forEach(element => {
    if (!tags.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); return; }
    const href = element.getAttribute('href');
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
    if (element.tagName === 'A' && href && /^https?:\/\//i.test(href)) {
      element.setAttribute('href', href); element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return document.body.innerHTML;
}
