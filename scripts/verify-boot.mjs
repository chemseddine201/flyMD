import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const electronExe = path.resolve(projectRoot, 'node_modules/electron/dist/electron.exe');

console.log('Testing FlyMD launch with electron binary at project root...');

const env = { ...process.env, SMOKE_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronExe, ['.'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env,
});

const timer = setTimeout(() => {
  const resultFile = path.join(projectRoot, 'smoke-test-success.txt');
  if (fs.existsSync(resultFile)) {
    console.log('Smoke test passed: result file written successfully!');
    child.kill();
    process.exit(0);
  } else {
    console.error('Timed out waiting for smoke test output.');
    child.kill();
    process.exit(1);
  }
}, 5000);

child.on('close', (code) => {
  clearTimeout(timer);
  const resultFile = path.join(projectRoot, 'smoke-test-success.txt');
  if (fs.existsSync(resultFile)) {
    console.log('Smoke test passed: result file verified!');
    process.exit(0);
  } else {
    console.log(`Process exited with code: ${code}`);
    process.exit(code || 0);
  }
});
