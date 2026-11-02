/**
 * Context-Aware Smart Deliverable File Naming & Multilingual Slugification (Frontend).
 * Mirrors Rust backend naming domain logic for consistent, collision-free filenames.
 */

const ARABIC_KEYWORD_MAP: Record<string, string> = {
  مشروع: 'Project',
  خطة: 'Plan',
  تقرير: 'Report',
  تصميم: 'Design',
  بحث: 'Research',
  مراجعة: 'Review',
  تحليل: 'Analysis',
  الفيزياء: 'Physics',
  فيزياء: 'Physics',
  الضوء: 'Light',
  ضوء: 'Light',
  تطوير: 'Development',
  تطور: 'Evolution',
  محاكاة: 'Simulation',
  هندسة: 'Engineering',
  برمجة: 'Programming',
  نظام: 'System',
  واجهة: 'UI',
  أمان: 'Security',
  اختبار: 'Testing',
  إصلاح: 'Fix',
};

const ARABIC_CHAR_MAP: Record<string, string> = {
  ا: 'a',
  أ: 'a',
  إ: 'a',
  آ: 'a',
  ء: 'a',
  ى: 'a',
  ب: 'b',
  ت: 't',
  ة: 't',
  ث: 'th',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 'ss',
  ض: 'dd',
  ط: 'tt',
  ظ: 'dh',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'w',
  ي: 'y',
};

/**
 * Transliterates Arabic words and letters into readable English / Latin phonemes.
 */
export function transliterateArabic(input: string): string {
  let text = input;

  for (const [ar, en] of Object.entries(ARABIC_KEYWORD_MAP)) {
    if (text.includes(ar)) {
      text = text.replaceAll(ar, en);
    }
  }

  let out = '';
  for (const ch of text) {
    out += ARABIC_CHAR_MAP[ch] !== undefined ? ARABIC_CHAR_MAP[ch] : ch;
  }
  return out;
}

const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/**
 * Converts arbitrary text into a clean alphanumeric filename slug.
 */
export function slugifySemanticTitle(input: string, maxLen = 40): string {
  const ascii = transliterateArabic(input);
  let slug = '';
  let lastWasDelim = true;

  for (let i = 0; i < ascii.length; i++) {
    const ch = ascii[i];
    const isAlphanumeric = /[a-zA-Z0-9]/.test(ch);

    if (isAlphanumeric) {
      slug += ch;
      lastWasDelim = false;
    } else if (/[ _\-.]/.test(ch) && !lastWasDelim) {
      slug += '_';
      lastWasDelim = true;
    }
  }

  slug = slug.replace(/[_\-.]+$/, '');

  if (slug.length > maxLen) {
    slug = slug.slice(0, maxLen).replace(/[_\-]+$/, '');
  }

  if (!slug || WINDOWS_RESERVED.has(slug.toUpperCase())) {
    return `Doc_${slug}`;
  }

  return slug;
}

export interface SmartDeliverableParams {
  projectName?: string | null;
  subprojectName?: string | null;
  topicOrPrompt?: string | null;
  intentOrKind?: string;
  fallbackName?: string;
}

/**
 * Composes a context-rich, standard Markdown deliverable filename.
 * Pattern: `[Project]_[SubProject]_[Topic]_[Kind].md`
 */
export function composeSmartDeliverableName({
  projectName,
  subprojectName,
  topicOrPrompt,
  intentOrKind = 'plan',
  fallbackName = 'Deliverable.md',
}: SmartDeliverableParams): string {
  const parts: string[] = [];

  if (projectName) {
    const pSlug = slugifySemanticTitle(projectName, 30);
    if (pSlug && pSlug !== 'Default' && pSlug !== 'Workspace' && pSlug !== 'Doc_') {
      parts.push(pSlug);
    }
  }

  if (subprojectName) {
    const spSlug = slugifySemanticTitle(subprojectName, 25);
    if (spSlug && !parts.some((p) => p.toLowerCase() === spSlug.toLowerCase())) {
      parts.push(spSlug);
    }
  }

  if (topicOrPrompt) {
    const cleaned = topicOrPrompt.trim().replace(/^#+\s*/, '').trim();
    const firstLine = cleaned.split(/\r?\n/)[0] || cleaned;
    const topSlug = slugifySemanticTitle(firstLine, 35);
    if (topSlug && !parts.some((p) => p.toLowerCase() === topSlug.toLowerCase())) {
      parts.push(topSlug);
    }
  }

  const kindSuffix = (() => {
    switch (intentOrKind) {
      case 'refine-plan':
      case 'plan':
        return 'Plan';
      case 'review':
      case 'audit':
        return 'AuditReport';
      case 'build':
        return 'BuildReport';
      case 'fix-bugs':
        return 'FixReport';
      case 'consensus-report':
      case 'discussion':
        return 'ConsensusReport';
      case 'explain':
        return 'Explanation';
      case 'test':
        return 'TestReport';
      default:
        return intentOrKind.trim() ? slugifySemanticTitle(intentOrKind, 15) : 'Deliverable';
    }
  })();

  if (!parts.some((p) => p.toLowerCase() === kindSuffix.toLowerCase())) {
    parts.push(kindSuffix);
  }

  if (parts.length === 0) {
    return fallbackName.endsWith('.md') ? fallbackName : `${fallbackName}.md`;
  }

  return `${parts.join('_')}.md`;
}

/**
 * Ensures a filename doesn't collide with existing filenames in a list.
 * Appends `-v2.md`, `-v3.md` if needed.
 */
export function resolveAntiCollisionName(
  existingFileNames: string[],
  candidateName: string
): string {
  const nameSet = new Set(existingFileNames.map((f) => f.toLowerCase().trim()));
  const raw = candidateName.trim();
  const dotIdx = raw.lastIndexOf('.');
  const stem = dotIdx !== -1 ? raw.slice(0, dotIdx) : raw;
  const ext = dotIdx !== -1 ? raw.slice(dotIdx) : '.md';

  if (!nameSet.has(raw.toLowerCase())) {
    return raw;
  }

  let baseStem = stem;
  let startV = 2;
  const dashVMatch = stem.match(/^(.*)-v(\d+)$/);
  if (dashVMatch) {
    baseStem = dashVMatch[1];
    startV = parseInt(dashVMatch[2], 10) + 1;
  }

  for (let v = startV; v < 1000; v++) {
    const candidate = `${baseStem}-v${v}${ext}`;
    if (!nameSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${baseStem}-${Date.now()}${ext}`;
}
