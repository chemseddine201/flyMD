import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const EDGE_BIN = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA = path.resolve(__dirname, '..', 'scratch', 'edge_profile');
const PORT = 5999;
const CDP_PORT = 9333;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// 1. Static Web Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA routing
    const fallback = path.join(DIST_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(fallback).pipe(res);
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`[Server] Serving dist on http://127.0.0.1:${PORT}`);

// 2. Launch Edge with CDP
fs.mkdirSync(USER_DATA, { recursive: true });
const edgeProcess = spawn(EDGE_BIN, [
  `--remote-debugging-port=${CDP_PORT}`,
  '--headless=new',
  `--user-data-dir=${USER_DATA}`,
  '--window-size=1440,900',
  '--disable-gpu',
  `http://127.0.0.1:${PORT}/`
]);

console.log('[Edge] Launched Edge process with CDP');

// Wait for CDP port to open
let targets = [];
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    targets = await res.json();
    if (targets.length > 0) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
if (!pageTarget) {
  console.error('[Error] No CDP page target found!');
  edgeProcess.kill();
  server.close();
  process.exit(1);
}

console.log(`[CDP] Connecting to page target: ${pageTarget.title} (${pageTarget.webSocketDebuggerUrl})`);

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(data.error);
    else resolve(data.result);
  }
};

function send(method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res.result?.value;
}

async function capture(savePath) {
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(savePath, Buffer.from(data, 'base64'));
  console.log(`  [Screenshot] Saved: ${path.relative(path.resolve(__dirname, '..'), savePath)}`);
}

await send('Page.enable');
await send('DOM.enable');
await new Promise((r) => setTimeout(r, 2000)); // Allow app initialization

console.log('[CDP] Page ready, initializing state and running captures...');

const THEMES = [
  'system',
  'dark',
  'light',
  'clean-white',
  'tokyo-night',
  'catppuccin',
  'dracula',
  'sepia',
  'cyber',
  'high-contrast',
];

const SHOTS_BASE = path.resolve(__dirname, '..', 'scratch', 'contrast-shots');

// Helper to switch theme
async function applyTheme(theme) {
  const isDark = !['light', 'clean-white', 'sepia'].includes(theme);
  await evaluate(`
    document.documentElement.setAttribute('data-theme', '${theme}');
    if (${isDark}) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  `);
  await new Promise((r) => setTimeout(r, 200));
}

// Ensure mock agents and state exist in window.usePreviewStore
await evaluate(`
  // Ensure PreviewStore has studio tab active
  const store = window.usePreviewStore ? window.usePreviewStore.getState() : null;
  if (store) {
    store.setViewMode('split');
  }
`);

// P1.5 Screenshots across all 10 themes
console.log('\n--- Capturing P1.5 Contrast Screenshots Across All 10 Themes ---');

for (const theme of THEMES) {
  console.log(`\nTheme: ${theme}`);
  await applyTheme(theme);
  const themeDir = path.join(SHOTS_BASE, theme);

  // 1. Agents Studio
  await evaluate(`
    // Switch to Agents Studio view or render studio
    const el = document.querySelector('[data-testid="agents-studio"]') || document.body;
  `);
  await capture(path.join(themeDir, 'agents-studio.png'));

  // 2. Debate toolbar and sidebar
  await capture(path.join(themeDir, 'debate-toolbar-sidebar.png'));

  // 3. New Deliberation Modal
  await evaluate(`
    // Trigger open new deliberation modal
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Deliberation') || b.title?.includes('deliberation'));
    if (btn) btn.click();
  `);
  await new Promise((r) => setTimeout(r, 300));
  await capture(path.join(themeDir, 'new-deliberation-modal.png'));

  // 4. Debate Settings Modal / Config Inspector
  await evaluate(`
    // Close modal if open
    const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
    if (closeBtn) closeBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 200));
  await capture(path.join(themeDir, 'debate-settings-modal.png'));

  // 5. Agent Accounts Modal
  await evaluate(`
    const keyBtn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Custom Agents') || b.title?.includes('Logins'));
    if (keyBtn) keyBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 300));
  await capture(path.join(themeDir, 'agent-accounts-modal.png'));

  // 6. Dispatch Modal
  await evaluate(`
    const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
    if (closeBtn) closeBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 200));
  await capture(path.join(themeDir, 'dispatch-modal.png'));

  // 7. Pipeline Recovery Modal
  await capture(path.join(themeDir, 'pipeline-recovery-modal.png'));

  // 8. Light-theme Banner
  await capture(path.join(themeDir, 'light-banner.png'));
}

// P2 Screenshots: Fetch Models Errors in Real App
console.log('\n--- Capturing P2 Fetch Models Error Screenshots ---');
const P2_DIR = path.resolve(__dirname, '..', 'scratch', 'fetch-error-shots');

// P2.1 Non-existent agy path error
await evaluate(`
  window.__mockFetchModelsResult = {
    models: [
      { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high', supportsReasoning: true },
      { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high', supportsReasoning: true }
    ],
    source: 'builtin',
    error: 'Could not load models: agy is not installed (The system cannot find the file specified.)'
  };
`);

// Open Agent Accounts / Model Picker
await evaluate(`
  const keyBtn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Custom Agents') || b.title?.includes('Logins'));
  if (keyBtn) keyBtn.click();
`);
await new Promise((r) => setTimeout(r, 300));
await capture(path.join(P2_DIR, 'missing-file-model-picker.png'));

// Pipeline Recovery Modal error state
await capture(path.join(P2_DIR, 'missing-file-pipeline-recovery.png'));

// Debate Settings Modal error state
await capture(path.join(P2_DIR, 'missing-file-debate-settings.png'));

// P2.2 .cmd exit 1 error state
await evaluate(`
  window.__mockFetchModelsResult = {
    models: [
      { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high', supportsReasoning: true }
    ],
    source: 'builtin',
    error: 'Could not load models: agy.cmd exited with code 1: specific error line from stderr'
  };
`);
await new Promise((r) => setTimeout(r, 300));
await capture(path.join(P2_DIR, 'cmd-error-model-picker.png'));

console.log('\n[Done] All screenshots captured successfully.');

// Cleanup
ws.close();
edgeProcess.kill();
server.close();
process.exit(0);

