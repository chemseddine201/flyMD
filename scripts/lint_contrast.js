const fs = require('fs');
const path = require('path');

const RENDERER_DIR = path.resolve(__dirname, '..', 'src', 'renderer');

// --- Contrast Rules ---
// 1. Solid colored background fills (500–950, excluding opacity modifiers like /10, /20)
const SOLID_COLORED_FILL_RE = /\bbg-(blue|sky|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|cyan)-(?:500|600|700|800|900|950)(?!\/)\b/;

// 2. Dark text shades (700–950, black, including dark: variants)
const DARK_TEXT_RE = /\b(?:dark:)?text-(?:slate|gray|zinc|neutral)-(?:700|800|900|950)\b|\b(?:dark:)?text-black\b/;

// 3. Low-contrast colored fills or hovers (400 or 500 shades of light/medium hues)
const LOW_CONTRAST_FILL_RE = /\b(?:hover:)?bg-(?:amber|yellow|lime|sky|cyan|orange|emerald|green|teal)-(?:400|500)(?!\/)\b/;

// 4. White text
const WHITE_TEXT_RE = /\b(?:dark:)?text-white\b/;

// 5. Solid gradient with dark text
const SOLID_GRADIENT_RE = /\b(?:from-(?:sky|blue|indigo|purple|emerald|rose)-(?:500|600|700))\b/;

function evaluateClassString(str) {
  if (!str || typeof str !== 'string') return null;

  // Rule A: Dark text on solid colored fill
  if (SOLID_COLORED_FILL_RE.test(str) && DARK_TEXT_RE.test(str)) {
    return 'Dark text on solid colored fill';
  }

  // Rule B: Dark text on solid colored gradient
  if (SOLID_GRADIENT_RE.test(str) && DARK_TEXT_RE.test(str) && !/\/(?:10|15|20|30|50)\b/.test(str)) {
    return 'Dark text on solid colored gradient';
  }

  // Rule C: White text on low-contrast colored fill or hover (400/500)
  if (LOW_CONTRAST_FILL_RE.test(str) && WHITE_TEXT_RE.test(str)) {
    return 'White text on low-contrast fill/hover (400/500)';
  }

  return null;
}

// --- Self-Test Suite (5 strings that must fail, 5 that must pass) ---
function runSelfTest() {
  const failCases = [
    'bg-sky-500 text-slate-950',
    'bg-amber-600 hover:bg-amber-500 text-white',
    'bg-emerald-500 text-white',
    'bg-indigo-600 text-slate-800',
    'bg-orange-600 hover:bg-orange-400 text-white',
  ];

  const passCases = [
    'bg-sky-600 hover:bg-sky-700 text-white',
    'bg-amber-600 hover:bg-amber-700 text-white',
    'bg-sky-500/10 text-sky-400 hover:text-sky-300',
    'bg-slate-800 text-slate-200 hover:text-white',
    'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
  ];

  for (const failStr of failCases) {
    const res = evaluateClassString(failStr);
    if (!res) {
      console.error(`\x1b[31mSelf-test failure: string should have failed but passed: "${failStr}"\x1b[0m`);
      process.exit(1);
    }
  }

  for (const passStr of passCases) {
    const res = evaluateClassString(passStr);
    if (res) {
      console.error(`\x1b[31mSelf-test failure: string should have passed but failed (${res}): "${passStr}"\x1b[0m`);
      process.exit(1);
    }
  }

  console.log('\x1b[36m[lint:contrast] Self-test passed: 5/5 expected failures caught, 5/5 expected passes accepted.\x1b[0m');
}

runSelfTest();

// --- Codebase Scanner ---
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (/\.(tsx|jsx|ts|js)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractClassStringsFromFile(content) {
  const strings = [];

  // 1. Static className="..." or className='...'
  const staticClassRegex = /\bclass(?:Name)?\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')/g;
  let m;
  while ((m = staticClassRegex.exec(content)) !== null) {
    const val = m[1] !== undefined ? m[1] : m[2];
    strings.push({ str: val, index: m.index });
  }

  // 2. Dynamic className={...}
  const dynamicClassRegex = /\bclass(?:Name)?\s*=\s*\{/g;
  while ((m = dynamicClassRegex.exec(content)) !== null) {
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const expr = content.substring(startIdx, i - 1);

    // a) String literals inside className={...}
    const strLitRegex = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let s;
    while ((s = strLitRegex.exec(expr)) !== null) {
      const val = s[1] !== undefined ? s[1] : s[2];
      strings.push({ str: val, index: startIdx + s.index });
    }

    // b) Template literals inside className={`...`}
    const tplRegex = /`([^`\\]*(?:\\.[^`\\]*)*)`/g;
    let t;
    while ((t = tplRegex.exec(expr)) !== null) {
      const tplContent = t[1];
      // Static parts
      const staticParts = tplContent.split(/\$\{[^}]*\}/);
      for (const part of staticParts) {
        if (part.trim()) {
          strings.push({ str: part, index: startIdx + t.index });
        }
      }
      // String literals inside ${...}
      const innerExprRegex = /\$\{([^}]*)\}/g;
      let ie;
      while ((ie = innerExprRegex.exec(tplContent)) !== null) {
        let is;
        while ((is = strLitRegex.exec(ie[1])) !== null) {
          const val = is[1] !== undefined ? is[1] : is[2];
          strings.push({ str: val, index: startIdx + t.index + ie.index + is.index });
        }
      }
    }
  }

  return strings;
}

const files = walk(RENDERER_DIR);
const violations = [];

for (const file of files) {
  const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  const classStrings = extractClassStringsFromFile(content);
  for (const item of classStrings) {
    const issue = evaluateClassString(item.str);
    if (issue) {
      const lineNum = content.substring(0, item.index).split('\n').length;
      violations.push({
        file: relPath,
        line: lineNum,
        issue,
        code: item.str.trim(),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\x1b[31mFAIL: Found ${violations.length} contrast violations:\x1b[0m\n`);
  for (const v of violations) {
    console.error(`  \x1b[33m${v.file}:${v.line}\x1b[0m [${v.issue}]`);
    console.error(`    ${v.code}\n`);
  }
  process.exit(1);
} else {
  console.log('\x1b[32mPASS: All class strings comply with contrast rules. Zero violations found.\x1b[0m');
  process.exit(0);
}
