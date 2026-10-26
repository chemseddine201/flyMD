import { ExportStrategy, ExportContext, ExportResult } from './ExportStrategy';

export class LatexExportStrategy implements ExportStrategy {
  public readonly formatId = 'tex';
  public readonly formatName = 'LaTeX Document';
  public readonly extension = 'tex';

  public toLatex(markdown: string, title = 'Document', direction: 'ltr' | 'rtl' = 'ltr'): string {
    if (!markdown) return '';

    // 1. Isolate code fences and math blocks to prevent character escaping
    const placeholders: string[] = [];
    let text = markdown;

    // Fenced code blocks
    text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = placeholders.length;
      const cleanLang = lang ? `language=${lang},` : '';
      const latexBlock = `\\begin{lstlisting}[${cleanLang}basicstyle=\\ttfamily\\small,breaklines=true,frame=single]\n${code}\\end{lstlisting}`;
      placeholders.push(latexBlock);
      return `@@LATEX_BLOCK_${idx}@@`;
    });

    // Display math $$...$$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      const idx = placeholders.length;
      const latexMath = `\\[\n${math.trim()}\n\\]`;
      placeholders.push(latexMath);
      return `@@LATEX_BLOCK_${idx}@@`;
    });

    // Inline math $...$
    text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      const idx = placeholders.length;
      placeholders.push(`$${math}$`);
      return `@@LATEX_BLOCK_${idx}@@`;
    });

    // Inline code `...`
    text = text.replace(/`([^`\n]+?)`/g, (_, code) => {
      const idx = placeholders.length;
      placeholders.push(`\\texttt{${this.escapeLatex(code)}}`);
      return `@@LATEX_BLOCK_${idx}@@`;
    });

    // 2. Process line by line
    const lines = text.split(/\r?\n/);
    const body: string[] = [];

    for (const line of lines) {
      // Check placeholder line
      const placeholderMatch = line.match(/^@@LATEX_BLOCK_(\d+)@@$/);
      if (placeholderMatch) {
        body.push(placeholders[parseInt(placeholderMatch[1], 10)]);
        continue;
      }

      // Headings
      const h1 = line.match(/^#\s+(.+)$/);
      if (h1) {
        body.push(`\\section{${this.convertInline(h1[1], placeholders)}}`);
        continue;
      }

      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        body.push(`\\subsection{${this.convertInline(h2[1], placeholders)}}`);
        continue;
      }

      const h3 = line.match(/^###\s+(.+)$/);
      if (h3) {
        body.push(`\\subsubsection{${this.convertInline(h3[1], placeholders)}}`);
        continue;
      }

      const h4 = line.match(/^####+\s+(.+)$/);
      if (h4) {
        body.push(`\\paragraph{${this.convertInline(h4[1], placeholders)}}`);
        continue;
      }

      // Blockquotes
      const bq = line.match(/^>\s*(.+)$/);
      if (bq) {
        body.push(`\\begin{quote}\n${this.convertInline(bq[1], placeholders)}\n\\end{quote}`);
        continue;
      }

      // Itemize / lists
      const item = line.match(/^[-*+]\s+(.+)$/);
      if (item) {
        body.push(`\\begin{itemize}\\item ${this.convertInline(item[1], placeholders)}\\end{itemize}`);
        continue;
      }

      // Normal line
      if (line.trim() === '') {
        body.push('');
      } else {
        body.push(this.convertInline(line, placeholders) + '\n');
      }
    }

    // 3. Restore all remaining inline placeholders
    let renderedBody = body.join('\n');
    renderedBody = renderedBody.replace(/@@LATEX_BLOCK_(\d+)@@/g, (_, idxStr) => {
      return placeholders[parseInt(idxStr, 10)] ?? '';
    });

    const isRtl = direction === 'rtl';
    const rtlPreamble = isRtl
      ? `\\usepackage{polyglossia}
\\setmainlanguage{arabic}
\\setotherlanguage{english}
\\newfontfamily\\arabicfont[Script=Arabic]{Amiri}`
      : '% Standard LTR document';

    return `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{listings}
\\usepackage{xcolor}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{ulem}
${rtlPreamble}

\\title{${this.escapeLatex(title)}}
\\author{FlyMD Generated Document}
\\date{\\today}

\\begin{document}
\\maketitle

${renderedBody}

\\end{document}
`;
  }

  private escapeLatex(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([%&#_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  private convertInline(raw: string, placeholders: string[]): string {
    // Links [text](url)
    let res = raw.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const idx = placeholders.length;
      placeholders.push(`\\href{${url}}{${this.escapeLatex(label)}}`);
      return `@@LATEX_BLOCK_${idx}@@`;
    });

    // Bold **text**
    res = res.replace(/(\*\*|__)(.*?)\1/g, (_, __, content) => {
      return `\\textbf{${this.escapeLatex(content)}}`;
    });

    // Italic *text*
    res = res.replace(/(\*|_)(.*?)\1/g, (_, __, content) => {
      return `\\textit{${this.escapeLatex(content)}}`;
    });

    // Strikethrough ~~text~~
    res = res.replace(/~~(.*?)~~/g, (_, content) => {
      return `\\sout{${this.escapeLatex(content)}}`;
    });

    // Escape raw text fragments outside placeholders
    const parts = res.split(/(@@LATEX_BLOCK_\d+@@)/);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith('@@LATEX_BLOCK_')) {
        parts[i] = this.escapeLatex(parts[i]);
      }
    }

    return parts.join('');
  }

  public async export(context: ExportContext): Promise<ExportResult> {
    const defaultName = context.title.replace(/\.(md|markdown|txt)$/i, '') + '.tex';
    const latexSource = this.toLatex(context.markdown, context.title, context.direction);

    const res = await window.electronAPI.saveFileDialog(defaultName, latexSource, [
      { name: 'LaTeX Source File', extensions: ['tex'] },
    ]);

    return {
      success: res.success,
      path: res.path,
      error: res.error,
    };
  }
}

