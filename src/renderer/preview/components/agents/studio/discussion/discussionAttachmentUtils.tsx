import React from 'react';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  X,
  Paperclip,
} from 'lucide-react';
import { DiscussionAttachedFile } from '../../../../../../shared/types';

export const MAX_DISCUSSION_ATTACHMENTS = 10;

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileCategoryIcon(fileName: string, isImage?: boolean) {
  if (isImage || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(fileName)) {
    return <ImageIcon size={12} className="text-emerald-500 shrink-0" />;
  }
  if (
    /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp|cs|html|css|scss|sh|bat|ps1|sql|json|ya?ml|toml)$/i.test(
      fileName
    )
  ) {
    return <FileCode size={12} className="text-sky-500 shrink-0" />;
  }
  if (/\.(csv|tsv|xlsx?|ods)$/i.test(fileName)) {
    return <FileSpreadsheet size={12} className="text-amber-500 shrink-0" />;
  }
  if (/\.(md|markdown|txt|pdf|docx?|rtf|log)$/i.test(fileName)) {
    return <FileText size={12} className="text-violet-500 shrink-0" />;
  }
  return <File size={12} className="text-slate-400 shrink-0" />;
}

export async function readAttachmentFile(file: File): Promise<DiscussionAttachedFile> {
  const extension = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    : '';
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name);

  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (isImage) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id,
          name: file.name,
          size: file.size,
          extension,
          mimeType: file.type || 'image/png',
          dataUrl: e.target?.result as string,
          isImage: true,
        });
      };
      reader.onerror = () => {
        resolve({
          id,
          name: file.name,
          size: file.size,
          extension,
          mimeType: file.type,
          isImage: true,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Text, code, config, document files: read as UTF-8 text if <= 5MB
  if (file.size <= 5 * 1024 * 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve({
          id,
          name: file.name,
          size: file.size,
          extension,
          mimeType: file.type || 'text/plain',
          content: text,
          isImage: false,
        });
      };
      reader.onerror = () => {
        resolve({
          id,
          name: file.name,
          size: file.size,
          extension,
          mimeType: file.type,
          isImage: false,
        });
      };
      reader.readAsText(file);
    });
  }

  return {
    id,
    name: file.name,
    size: file.size,
    extension,
    mimeType: file.type,
    isImage: false,
  };
}

export async function processFilesForAttachment(
  fileList: FileList | File[],
  currentCount: number,
  maxCount: number = MAX_DISCUSSION_ATTACHMENTS
): Promise<{ added: DiscussionAttachedFile[]; clamped: boolean }> {
  const filesArray = Array.from(fileList);
  const remainingSlots = Math.max(0, maxCount - currentCount);
  const toProcess = filesArray.slice(0, remainingSlots);
  const clamped = filesArray.length > remainingSlots;

  const added: DiscussionAttachedFile[] = [];
  for (const f of toProcess) {
    try {
      const processed = await readAttachmentFile(f);
      added.push(processed);
    } catch (e) {
      console.warn('[processFilesForAttachment] Failed to process file:', f.name, e);
    }
  }
  return { added, clamped };
}

export function formatAttachedFilesContext(files: DiscussionAttachedFile[]): string {
  if (!files || files.length === 0) return '';
  const header = `\n\n### Attached Reference Files (${files.length} file${files.length > 1 ? 's' : ''}):\n`;
  const bodies = files.map((f, idx) => {
    let block = `\n#### File ${idx + 1}: \`${f.name}\` (${formatFileSize(f.size)})\n`;
    if (f.content) {
      const lang = f.extension.replace(/^\./, '') || 'text';
      block += `\`\`\`${lang}\n${f.content.trim()}\n\`\`\`\n`;
    } else if (f.isImage) {
      block += `*(Attached image file: ${f.name})*\n`;
    } else {
      block += `*(Attached document/binary file: ${f.name})*\n`;
    }
    return block;
  });
  return header + bodies.join('\n');
}

export interface DiscussionAttachmentPillsProps {
  files: DiscussionAttachedFile[];
  onRemove: (fileId: string) => void;
  maxFiles?: number;
}

export const DiscussionAttachmentPills: React.FC<DiscussionAttachmentPillsProps> = ({
  files,
  onRemove,
  maxFiles = MAX_DISCUSSION_ATTACHMENTS,
}) => {
  if (!files || files.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-1 shrink-0">
        <Paperclip size={11} className="text-sky-500" />
        <span>
          Attached ({files.length}/{maxFiles}):
        </span>
      </div>
      {files.map((file) => (
        <div
          key={file.id}
          className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all max-w-[220px]"
          title={`${file.name} (${formatFileSize(file.size)})`}
        >
          {file.isImage && file.dataUrl ? (
            <img
              src={file.dataUrl}
              alt={file.name}
              className="w-4 h-4 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
            />
          ) : (
            getFileCategoryIcon(file.name, file.isImage)
          )}
          <span className="truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
            {file.name}
          </span>
          <span className="text-[9px] text-slate-400 shrink-0 font-mono">
            {formatFileSize(file.size)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(file.id);
            }}
            className="p-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-0.5"
            title="Remove attachment"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
};

