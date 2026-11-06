/**
 * ============================================================================
 * QUANTA: AUTOMATED HEADLESS CHROMIUM / EDGE PDF GENERATOR
 * Compiles the canonical publication-grade A4 master PDF
 * ============================================================================
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH_X86 = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PATH_64 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function findBrowserBinary() {
  if (fs.existsSync(EDGE_PATH_X86)) return EDGE_PATH_X86;
  if (fs.existsSync(EDGE_PATH_64)) return EDGE_PATH_64;
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  return null;
}

const browserBinary = findBrowserBinary();
if (!browserBinary) {
  console.error('[QUANTA PDF BUILD ERROR] No headless Chromium/Edge binary found.');
  process.exit(1);
}

const workspaceRoot = path.resolve(__dirname, '..');
const htmlSource = `file:///${path.join(workspaceRoot, 'index.html').replace(/\\/g, '/')}`;
const pdfOutput = path.join(workspaceRoot, 'quanta-quantum-mechanics-historical.pdf');

console.log(`[QUANTA] Compiling Canonical Master PDF using browser: ${browserBinary}`);
console.log(`[QUANTA] Source: ${htmlSource}`);
console.log(`[QUANTA] Destination: ${pdfOutput}`);

const args = [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--print-to-pdf-no-header',
  `--print-to-pdf=${pdfOutput}`,
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=5000',
  htmlSource
];

execFile(browserBinary, args, (err, stdout, stderr) => {
  if (err) {
    console.error('[QUANTA] PDF generation failed:', err);
    process.exit(1);
  }
  console.log(`[QUANTA] Successfully generated canonical PDF: ${pdfOutput}`);
});
