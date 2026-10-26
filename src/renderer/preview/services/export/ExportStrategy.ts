export interface ExportContext {
  title: string;
  markdown: string;
  direction: 'ltr' | 'rtl';
  theme?: string;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface ExportStrategy {
  readonly formatId: 'html' | 'pdf' | 'txt' | 'tex';
  readonly formatName: string;
  readonly extension: string;
  export(context: ExportContext): Promise<ExportResult>;
}

