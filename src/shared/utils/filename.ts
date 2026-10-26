/**
 * Extracts base file name from a path.
 */
export function getBasename(filePath: string, removeExtension = false): string {
  if (!filePath) return '';
  const lastSegment = filePath.split(/[\\/]/).pop() || '';
  if (removeExtension) {
    return lastSegment.replace(/\.[^/.]+$/, '');
  }
  return lastSegment;
}

/**
 * Extracts the file extension (in lower-case, without dot).
 */
export function getFileExtension(filePath: string): string {
  if (!filePath) return '';
  const match = filePath.match(/\.([0-9a-z]+)(?:[?#]|$)/i);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Generates an appropriate translated filename like "README_fr.md"
 */
export function generateTranslatedFileName(originalFileName: string, langSuffix: string): string {
  const safeLang = langSuffix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const base = originalFileName.replace(/\.(md|markdown|txt)$/i, '');
  return `${base}_${safeLang || 'translated'}.md`;
}

/**
 * Sanitizes filename to prevent illegal filesystem characters across OSes.
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

