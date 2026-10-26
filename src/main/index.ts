import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { windowManager } from './windows';
import { registerIpcHandlers } from './ipc';
import { setupSystemTray } from './tray';
import { store } from './store';

// --- Chromium & V8 Low-Memory Optimization Switches ---
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=96 --optimize-for-size');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('renderer-process-limit', '2');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,CalculateNativeWinOcclusion,CanvasOopRasterization');

// Acquire single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // If a second instance was launched with a file argument, open it in preview
    const filePath = findMarkdownArg(commandLine);
    if (filePath) {
      openFileInApp(filePath);
    } else {
      const floatWin = windowManager.getFloatWindow();
      if (floatWin) {
        if (floatWin.isMinimized()) floatWin.restore();
        floatWin.show();
        floatWin.focus();
      }
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    setupSystemTray();

    // Periodic working set cleanup to return unused RAM back to Windows OS
    if (process.platform === 'win32') {
      setInterval(() => {
        try {
          if (global.gc) {
            global.gc();
          }
        } catch {}
      }, 30000);
    }

    // Create the primary floating circle hub
    windowManager.createFloatWindow();

    if (process.env.SMOKE_TEST === '1') {
      setTimeout(() => {
        app.quit();
      }, 1000);
      return;
    }

    // Check if launched with a file argument
    const initialFile = findMarkdownArg(process.argv);
    if (initialFile) {
      openFileInApp(initialFile);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createFloatWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // On Windows and Linux, if both float window and preview window are closed, quit.
    // However, if the tray or float window is running, keep alive.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    store.flushSync();
  });
}

function findMarkdownArg(args: string[]): string | null {
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-')) continue;
    if (/\.(md|markdown|mdown|txt)$/i.test(arg)) {
      if (fs.existsSync(arg)) {
        return path.resolve(arg);
      }
    }
  }
  return null;
}

function openFileInApp(filePath: string) {
  fs.promises.readFile(filePath, 'utf-8').then((content) => {
    const stat = fs.statSync(filePath);
    const name = path.basename(filePath);

    store.addHistory({
      path: filePath,
      name,
      size: stat.size,
      preview: content.slice(0, 150),
    });

    const previewWin = windowManager.createPreviewWindow();
    previewWin.webContents.send('preview:file-loaded', {
      path: filePath,
      name,
      content,
      lastModified: stat.mtimeMs,
    });
    previewWin.show();
    previewWin.focus();
  }).catch(console.error);
}
