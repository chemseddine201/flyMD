import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const EDGE_BIN = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA = path.resolve(__dirname, '..', 'scratch', 'edge_profile_light');
const PORT = 5998;
const CDP_PORT = 9334;

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

// 1. Static Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const fallback = path.join(DIST_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(fallback).pipe(res);
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`[Server] Serving dist on http://127.0.0.1:${PORT}`);

// 2. Launch Edge
fs.mkdirSync(USER_DATA, { recursive: true });
const edgeProcess = spawn(EDGE_BIN, [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${USER_DATA}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1400,900',
  `http://127.0.0.1:${PORT}`,
], { stdio: 'ignore' });

// 3. Connect CDP
await new Promise((r) => setTimeout(r, 2000));
const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
const targets = await targetsRes.json();
const pageTarget = targets.find((t) => t.type === 'page');

if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
  console.error('Failed to find page target');
  edgeProcess.kill();
  server.close();
  process.exit(1);
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve) => ws.onopen = resolve);

let idCounter = 1;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = idCounter++;
    const handler = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true });
  return res.result ? res.result.value : null;
}

async function capture(filename) {
  const dir = path.dirname(filename);
  fs.mkdirSync(dir, { recursive: true });
  const res = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
  console.log(`[Screenshot] Saved: ${filename}`);
}

await send('Page.enable');
await send('DOM.enable');

// Wait for app load
await new Promise((r) => setTimeout(r, 1500));

// Set theme to light
await evaluate(`
  localStorage.setItem('flymd_theme', 'light');
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
  document.documentElement.setAttribute('data-theme', 'light');
`);
await new Promise((r) => setTimeout(r, 500));

// Hover over the Task Checklist button
const btnBox = await evaluate(`
  const btn = document.querySelector('button[title*="Task Checklist"]');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
  } else null;
`);

if (btnBox) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: btnBox.x,
    y: btnBox.y,
  });
  await new Promise((r) => setTimeout(r, 300));
}

const outDir = path.resolve(__dirname, '..', 'scratch', 'button_verification');
await capture(path.join(outDir, 'light_toolbar_hover_checklist.png'));

// Open Agent Studio
await evaluate(`
  const studioBtn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Studio') || b.textContent?.includes('Studio') || b.title?.includes('Agents'));
  if (studioBtn) studioBtn.click();
`);
await new Promise((r) => setTimeout(r, 800));

// Click on "Pipeline" tab or "In-App Native Studio"
await evaluate(`
  const pipelineBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Pipeline') || b.textContent?.includes('In-App Native Studio'));
  if (pipelineBtn) pipelineBtn.click();
`);
await new Promise((r) => setTimeout(r, 800));

// Switch execution mode to manual
await evaluate(`
  const manualBtn = document.querySelector('button[title*="Manual Mode"]');
  if (manualBtn) manualBtn.click();
`);
await new Promise((r) => setTimeout(r, 500));
await capture(path.join(outDir, 'light_studio_manual_button.png'));

// Cleanup
ws.close();
edgeProcess.kill();
server.close();
console.log('Done capturing verification screenshots.');
process.exit(0);
