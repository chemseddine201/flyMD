export interface MarkdownHeadingItem {
  id: string;
  text: string;
  level: number;
  line: number;
  index: number; // 0-based index among all headings in the document
}

export interface MarkdownHeadingTreeNode extends MarkdownHeadingItem {
  children: MarkdownHeadingTreeNode[];
}

/**
 * Strips inline markdown tokens (bold, italic, inline code, links) for clean display in the TOC tree.
 */
function cleanHeadingText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // links
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/(\*\*|__)(.*?)\1/g, '$2')       // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')          // italic
    .replace(/~~(.*?)~~/g, '$1')              // strikethrough
    .replace(/<[^>]+>/g, '')                  // html tags
    .trim();
}

/**
 * Extracts all ATX headings (# .. ######) outside fenced code blocks.
 */
export function extractMarkdownHeadings(markdown: string): MarkdownHeadingItem[] {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const headings: MarkdownHeadingItem[] = [];
  let inCodeFence = false;
  let fenceMarker = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inCodeFence) {
        inCodeFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inCodeFence = false;
        fenceMarker = '';
      }
      continue;
    }

    if (inCodeFence) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = cleanHeadingText(headingMatch[2]);
      if (!text) continue;

      const idx = headings.length;
      headings.push({
        id: `md-heading-${idx}`,
        text,
        level,
        line: i + 1,
        index: idx,
      });
    }
  }

  return headings;
}

/**
 * Builds a nested tree of headings based on heading levels (H1 -> H2 -> H3...).
 */
export function buildMarkdownHeadingTree(headings: MarkdownHeadingItem[]): MarkdownHeadingTreeNode[] {
  const root: MarkdownHeadingTreeNode[] = [];
  const stack: MarkdownHeadingTreeNode[] = [];

  for (const h of headings) {
    const node: MarkdownHeadingTreeNode = { ...h, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

