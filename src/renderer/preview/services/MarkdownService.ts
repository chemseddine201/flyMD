import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import DOMPurify from 'dompurify';

export class MarkdownService {
  private marked: Marked;

  constructor() {
    this.marked = new Marked(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        },
      })
    );

    this.marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }

  public render(markdown: string): string {
    if (!markdown) return '';

    // 1. Stash code fences so KaTeX math regex doesn't alter code blocks or inline code
    const codeBlocks: string[] = [];
    const placeholderPrefix = '@@MD_CODE_BLOCK_';

    let protectedText = markdown.replace(/(```[\s\S]*?```|`[^`\n]+?`)/g, (match) => {
      const idx = codeBlocks.length;
      codeBlocks.push(match);
      return `${placeholderPrefix}${idx}@@`;
    });

    // 2. Render KaTeX block math $$...$$
    protectedText = protectedText.replace(/\$\$([\s\S]+?)\$\$/g, (_, equation) => {
      try {
        const rendered = katex.renderToString(equation.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        return `<div class="katex-display">${rendered}</div>`;
      } catch {
        return `<div class="katex-error text-rose-400 font-mono text-xs">${equation}</div>`;
      }
    });

    // 3. Render KaTeX inline math $...$
    protectedText = protectedText.replace(/\$([^\$\n]+?)\$/g, (_, equation) => {
      try {
        const rendered = katex.renderToString(equation.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        return `<span class="katex-inline">${rendered}</span>`;
      } catch {
        return `<span class="katex-error text-rose-400 font-mono text-xs">${equation}</span>`;
      }
    });

    // 4. Restore stashed code fences
    protectedText = protectedText.replace(new RegExp(`${placeholderPrefix}(\\d+)@@`, 'g'), (_, idxStr) => {
      const idx = parseInt(idxStr, 10);
      return codeBlocks[idx] ?? '';
    });

    // 5. Run Marked compiler
    const rawHtml = this.marked.parse(protectedText) as string;

    // 6. Sanitize with DOMPurify
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['semantics', 'annotation', 'annotation-xml'],
      ADD_ATTR: ['display', 'xmlns'],
    });
  }

  public exportFullHtml(markdown: string, title = 'Document', direction: 'ltr' | 'rtl' = 'ltr', forPdf = false): string {
    const renderedBody = this.render(markdown);
    const isRtl = direction === 'rtl';

    return `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${direction}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, 'Noto Sans Arabic', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.68;
      background-color: ${forPdf ? '#ffffff' : '#0f172a'};
      color: ${forPdf ? '#0f172a' : '#f8fafc'};
      padding: ${forPdf ? '1.5rem 2rem' : '2rem 3rem'};
      max-width: 900px;
      margin: 0 auto;
      direction: ${direction};
      text-align: ${isRtl ? 'right' : 'left'};
    }
    pre {
      background: ${forPdf ? '#f1f5f9' : '#1e293b'};
      color: ${forPdf ? '#0f172a' : '#f8fafc'};
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      direction: ltr !important;
      text-align: left !important;
      page-break-inside: avoid;
    }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; page-break-inside: avoid; }
    th, td { border: 1px solid ${forPdf ? '#cbd5e1' : '#334155'}; padding: 8px 12px; }
    th { background: ${forPdf ? '#f8fafc' : '#1e293b'}; }
    blockquote {
      border-left: ${isRtl ? 'none' : '4px solid #38bdf8'};
      border-right: ${isRtl ? '4px solid #38bdf8' : 'none'};
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      color: ${forPdf ? '#475569' : '#94a3b8'};
      background: ${forPdf ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 165, 233, 0.05)'};
    }
    ul, ol {
      padding-left: ${isRtl ? '0' : '2rem'};
      padding-right: ${isRtl ? '2rem' : '0'};
    }
    .katex, .katex-display, .mermaid-container {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: embed;
    }
    @media print {
      body { background-color: #fff; color: #000; padding: 0; }
      pre, table, blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${renderedBody}
</body>
</html>`;
  }
}

export const markdownService = new MarkdownService();

