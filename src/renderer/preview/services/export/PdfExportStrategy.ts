import { ExportStrategy, ExportContext, ExportResult } from './ExportStrategy';
import { markdownService } from '../MarkdownService';

export class PdfExportStrategy implements ExportStrategy {
  public readonly formatId = 'pdf';
  public readonly formatName = 'PDF Document';
  public readonly extension = 'pdf';

  public async export(context: ExportContext): Promise<ExportResult> {
    const defaultName = context.title.replace(/\.(md|markdown|txt)$/i, '') + '.pdf';
    const htmlContent = markdownService.exportFullHtml(
      context.markdown,
      context.title,
      context.direction,
      true // forPdf
    );

    const res = await window.electronAPI.exportPdf(defaultName, htmlContent);

    return {
      success: res.success,
      path: res.path,
      error: res.error,
    };
  }
}

