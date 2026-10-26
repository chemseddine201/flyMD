/**
 * htmlToMarkdown.ts
 * Robust client-side DOM-to-Markdown serializer for FlyMD WYSIWYG editor.
 */

export function htmlToMarkdown(rootNode: Node): string {
  function walk(node: Node, context: { listType?: 'ul' | 'ol'; listIndex?: number; inPre?: boolean } = {}): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return context.inPre ? text : text.replace(/\n+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    // Check for KaTeX math blocks
    if (element.classList.contains('katex-display')) {
      const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
      const mathSrc = annotation?.textContent?.trim() || element.getAttribute('data-math') || element.textContent || '';
      return `\n\n$$\n${mathSrc}\n$$\n\n`;
    }

    if (element.classList.contains('katex-inline')) {
      const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
      const mathSrc = annotation?.textContent?.trim() || element.textContent || '';
      return `$${mathSrc}$`;
    }

    // Mermaid charts
    if (element.classList.contains('mermaid-container')) {
      const rawCode = element.getAttribute('data-mermaid') || '';
      return `\n\n\`\`\`mermaid\n${rawCode}\n\`\`\`\n\n`;
    }

    // Children recursion helper
    const childrenText = (ctx = context) =>
      Array.from(element.childNodes)
        .map((child) => walk(child, ctx))
        .join('');

    switch (tagName) {
      case 'h1':
        return `\n\n# ${childrenText().trim()}\n\n`;
      case 'h2':
        return `\n\n## ${childrenText().trim()}\n\n`;
      case 'h3':
        return `\n\n### ${childrenText().trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${childrenText().trim()}\n\n`;
      case 'h5':
        return `\n\n##### ${childrenText().trim()}\n\n`;
      case 'h6':
        return `\n\n###### ${childrenText().trim()}\n\n`;

      case 'p': {
        const text = childrenText().trim();
        return text ? `\n\n${text}\n\n` : '\n';
      }

      case 'div': {
        const text = childrenText().trim();
        return text ? `\n\n${text}\n\n` : '';
      }

      case 'blockquote': {
        const lines = childrenText().trim().split('\n');
        return `\n\n${lines.map((l) => `> ${l}`).join('\n')}\n\n`;
      }

      case 'pre': {
        const codeEl = element.querySelector('code');
        const langClass = Array.from(codeEl?.classList || []).find((c) => c.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : '';
        const rawCode = (codeEl || element).textContent || '';
        return `\n\n\`\`\`${lang}\n${rawCode.trim()}\n\`\`\`\n\n`;
      }

      case 'code': {
        if (context.inPre) return element.textContent || '';
        return `\`${element.textContent || ''}\``;
      }

      case 'strong':
      case 'b': {
        const inner = childrenText().trim();
        return inner ? `**${inner}**` : '';
      }

      case 'em':
      case 'i': {
        const inner = childrenText().trim();
        return inner ? `*${inner}*` : '';
      }

      case 'del':
      case 's':
      case 'strike': {
        const inner = childrenText().trim();
        return inner ? `~~${inner}~~` : '';
      }

      case 'hr':
        return '\n\n---\n\n';

      case 'br':
        return '\n';

      case 'a': {
        const href = element.getAttribute('href') || '';
        const text = childrenText().trim() || href;
        return `[${text}](${href})`;
      }

      case 'img': {
        const src = element.getAttribute('src') || '';
        const alt = element.getAttribute('alt') || '';
        return `![${alt}](${src})`;
      }

      case 'ul': {
        const items = Array.from(element.children)
          .map((child) => walk(child, { listType: 'ul' }))
          .join('');
        return `\n\n${items.trim()}\n\n`;
      }

      case 'ol': {
        let index = 1;
        const items = Array.from(element.children)
          .map((child) => walk(child, { listType: 'ol', listIndex: index++ }))
          .join('');
        return `\n\n${items.trim()}\n\n`;
      }

      case 'li': {
        const checkbox = element.querySelector('input[type="checkbox"]');
        let prefix = context.listType === 'ol' ? `${context.listIndex || 1}. ` : '- ';
        if (checkbox) {
          prefix = (checkbox as HTMLInputElement).checked ? '- [x] ' : '- [ ] ';
        }

        // Clone node without checkbox to avoid duplicate text
        const clone = element.cloneNode(true) as HTMLElement;
        const cbInClone = clone.querySelector('input[type="checkbox"]');
        if (cbInClone) cbInClone.remove();

        const content = Array.from(clone.childNodes)
          .map((c) => walk(c, context))
          .join('')
          .trim();

        return `${prefix}${content}\n`;
      }

      case 'table': {
        const rows = Array.from(element.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        const mdRows: string[] = [];
        rows.forEach((row, rowIdx) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
            cell.textContent?.trim().replace(/\|/g, '\\|') || ''
          );
          mdRows.push(`| ${cells.join(' | ')} |`);

          // Insert markdown divider after header row
          if (rowIdx === 0) {
            const dividers = cells.map(() => '---');
            mdRows.push(`| ${dividers.join(' | ')} |`);
          }
        });

        return `\n\n${mdRows.join('\n')}\n\n`;
      }

      default:
        return childrenText();
    }
  }

  const raw = walk(rootNode);

  // Clean up excess vertical whitespace
  return raw
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

