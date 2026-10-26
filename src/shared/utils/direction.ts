export type TextDirection = 'ltr' | 'rtl' | 'auto';

/**
 * Unicode ranges for strong RTL scripts:
 * - Hebrew (\u0590-\u05FF)
 * - Arabic, Persian, Urdu, Sindhi (\u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, \uFB50-\uFDFF, \uFE70-\uFEFF)
 * - Syriac, Thaana, Samaritan, Mandaic
 */
const RTL_REGEX = /[\u0590-\u083F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_REGEX = /[A-Za-z\u00C0-\u024F\u0370-\u052F\u1E00-\u1EFF]/;

/**
 * Strips code fences, inline code, and URLs, then detects the dominant direction of the first strong prose characters.
 */
export function detectTextDirection(text: string): 'ltr' | 'rtl' {
  if (!text) return 'ltr';

  // Strip code blocks and inline code
  const prose = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+?`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]+>/g, '');

  for (const char of prose) {
    if (RTL_REGEX.test(char)) return 'rtl';
    if (LTR_REGEX.test(char)) return 'ltr';
  }

  return 'ltr';
}

/**
 * Resolves a TextDirection setting to a concrete 'ltr' | 'rtl' based on content when 'auto'.
 */
export function resolveDirection(direction: TextDirection = 'auto', content = ''): 'ltr' | 'rtl' {
  if (direction === 'rtl') return 'rtl';
  if (direction === 'ltr') return 'ltr';
  return detectTextDirection(content);
}

