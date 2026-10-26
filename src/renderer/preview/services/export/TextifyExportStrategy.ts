import { ExportStrategy, ExportContext, ExportResult } from './ExportStrategy';

export class TextifyExportStrategy implements ExportStrategy {
  public readonly formatId = 'txt';
  public readonly formatName = 'Textify (Plain Text)';
  public readonly extension = 'txt';

  public textify(markdown: string, direction: 'ltr' | 'rtl'): string {
    if (!markdown) return '';

    const lines = markdown.split(/\r?\n/);
    const output: string[] = [];
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        output.push(inCode ? '--- [Code Block] ---' : '--------------------');
        continue;
      }

      if (inCode) {
        output.push(`    ${line}`);
        continue;
      }

      // Headings
      const h1 = line.match(/^#\s+(.+)$/);
      if (h1) {
        const text = h1[1].trim();
        output.push('');
        output.push(text.toUpperCase());
        output.push('='.repeat(Math.max(text.length, 12)));
        continue;
      }

      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        const text = h2[1].trim();
        output.push('');
        output.push(text);
        output.push('-'.repeat(Math.max(text.length, 12)));
        continue;
      }

      const h3 = line.match(/^###\s+(.+)$/);
      if (h3) {
        output.push('');
        output.push(`[ ${h3[1].trim()} ]`);
        continue;
      }

      const h4 = line.match(/^####+\s+(.+)$/);
      if (h4) {
        output.push(`* ${h4[1].trim()} *`);
        continue;
      }

      // Horizontal rule
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        output.push('--------------------------------------------------');
        continue;
      }

      // Blockquotes
      const bq = line.match(/^>\s*(.+)$/);
      if (bq) {
        output.push(`| ${this.cleanInline(bq[1])}`);
        continue;
      }

      // Task checklist
      const task = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/);
      if (task) {
        const check = task[2].toLowerCase() === 'x' ? '[X]' : '[ ]';
        output.push(`${task[1]}${check} ${this.cleanInline(task[3])}`);
        continue;
      }

      // Lists
      const list = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (list) {
        output.push(`${list[1]}${list[2]} ${this.cleanInline(list[3])}`);
        continue;
      }

      // Clean normal paragraph
      let cleaned = this.cleanInline(line);
      if (direction === 'rtl' && cleaned.trim()) {
        // Prepend Unicode Right-to-Left Mark (RLM)
        cleaned = '\u200F' + cleaned;
      }
      output.push(cleaned);
    }

    return output.join('\n').trim() + '\n';
  }

  private cleanInline(text: string): string {
    return text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '[Image: $1]')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/<[^>]+>/g, '');
  }

  public async export(context: ExportContext): Promise<ExportResult> {
    const defaultName = context.title.replace(/\.(md|markdown|txt)$/i, '') + '.txt';
    const plainText = this.textify(context.markdown, context.direction);

    const res = await window.electronAPI.saveFileDialog(defaultName, plainText, [
      { name: 'Plain Text File', extensions: ['txt'] },
    ]);

    return {
      success: res.success,
      path: res.path,
      error: res.error,
    };
  }
}

