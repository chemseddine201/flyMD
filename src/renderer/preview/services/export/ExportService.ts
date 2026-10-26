import { ExportStrategy, ExportContext, ExportResult } from './ExportStrategy';
import { HtmlExportStrategy } from './HtmlExportStrategy';
import { PdfExportStrategy } from './PdfExportStrategy';
import { TextifyExportStrategy } from './TextifyExportStrategy';
import { LatexExportStrategy } from './LatexExportStrategy';

export type ExportFormatId = 'html' | 'pdf' | 'txt' | 'tex';

export class ExportService {
  private strategies: Map<ExportFormatId, ExportStrategy> = new Map();

  constructor() {
    this.register(new HtmlExportStrategy());
    this.register(new PdfExportStrategy());
    this.register(new TextifyExportStrategy());
    this.register(new LatexExportStrategy());
  }

  public register(strategy: ExportStrategy): void {
    this.strategies.set(strategy.formatId, strategy);
  }

  public getAvailableFormats(): Array<{ id: ExportFormatId; name: string; ext: string }> {
    return Array.from(this.strategies.values()).map((s) => ({
      id: s.formatId,
      name: s.formatName,
      ext: s.extension,
    }));
  }

  public async exportDocument(formatId: ExportFormatId, context: ExportContext): Promise<ExportResult> {
    const strategy = this.strategies.get(formatId);
    if (!strategy) {
      return { success: false, error: `Unsupported export format: ${formatId}` };
    }

    try {
      return await strategy.export(context);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Export failed' };
    }
  }
}

export const exportService = new ExportService();

