import { ExportStrategy, ExportContext, ExportResult } from './ExportStrategy';
import { markdownService } from '../MarkdownService';

export class HtmlExportStrategy implements ExportStrategy {
  public readonly formatId = 'html';
  public readonly formatName = 'HTML Document';
  public readonly extension = 'html';

  public async export(context: ExportContext): Promise<ExportResult> {
    const defaultName = context.title.replace(/\.(md|markdown|txt)$/i, '') + '.html';
    const htmlContent = markdownService.exportFullHtml(
      context.markdown,
      context.title,
      context.direction,
      false
    );

    const res = await window.electronAPI.saveFileDialog(defaultName, htmlContent, [
      { name: 'HTML Document', extensions: ['html', 'htm'] },
    ]);

    return {
      success: res.success,
      path: res.path,
      error: res.error,
    };
  }
}

