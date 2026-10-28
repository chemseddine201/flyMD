import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import { store } from './store';
import { getAppIconPath } from './infrastructure/electron/assets';

function getRendererHtml(fileName: string): string {
  return path.join(app.getAppPath(), 'dist', fileName);
}

export class WindowManager {
  private floatWindow: BrowserWindow | null = null;
  private previewWindow: BrowserWindow | null = null;

  getFloatWindow(): BrowserWindow | null {
    return this.floatWindow;
  }

  getPreviewWindow(): BrowserWindow | null {
    return this.previewWindow;
  }

  createFloatWindow(): BrowserWindow {
    if (this.floatWindow && !this.floatWindow.isDestroyed()) {
      this.floatWindow.show();
      this.floatWindow.focus();
      return this.floatWindow;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Window canvas size: 380x560 provides ample transparent headroom for the 140px circle + history popover
    const winWidth = 380;
    const winHeight = 560;

    const savedBounds = store.getFloatBounds();
    const defaultX = screenWidth - winWidth - 40;
    const defaultY = Math.round((screenHeight - winHeight) / 2);

    const x = savedBounds.x !== undefined ? savedBounds.x : defaultX;
    const y = savedBounds.y !== undefined ? savedBounds.y : defaultY;

    const isAlwaysOnTop = store.getSettings().floatAlwaysOnTop;
    const appIcon = getAppIconPath() || undefined;

    this.floatWindow = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      x,
      y,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      alwaysOnTop: isAlwaysOnTop,
      skipTaskbar: false,
      backgroundColor: '#00000000',
      icon: appIcon,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: true,
        spellcheck: false,
        devTools: false,
        webgl: false,
      },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      this.floatWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/float.html`);
    } else {
      this.floatWindow.loadFile(getRendererHtml('float.html'));
    }

    this.floatWindow.on('moved', () => {
      if (this.floatWindow) {
        const [curX, curY] = this.floatWindow.getPosition();
        store.setFloatBounds({ x: curX, y: curY });
      }
    });

    this.floatWindow.on('closed', () => {
      console.log('[DEBUG] floatWindow closed!');
      this.floatWindow = null;
    });

    this.floatWindow.webContents.on('render-process-gone', (_e, details) => {
      console.log('[DEBUG] floatWindow render-process-gone:', details);
    });

    this.floatWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      console.log('[DEBUG] floatWindow did-fail-load:', code, desc);
    });

    return this.floatWindow;
  }

  createPreviewWindow(): BrowserWindow {
    if (this.previewWindow && !this.previewWindow.isDestroyed()) {
      this.previewWindow.show();
      this.previewWindow.focus();
      return this.previewWindow;
    }

    const savedBounds = store.getPreviewBounds();
    const isAlwaysOnTop = store.getSettings().previewAlwaysOnTop;

    this.previewWindow = new BrowserWindow({
      width: (savedBounds.width && savedBounds.width >= 1350) ? savedBounds.width : 1440,
      height: (savedBounds.height && savedBounds.height >= 850) ? savedBounds.height : 920,
      x: savedBounds.x,
      y: savedBounds.y,
      minWidth: 700,
      minHeight: 500,
      frame: false,
      show: false,
      alwaysOnTop: isAlwaysOnTop,
      backgroundColor: '#0f172a',
      icon: getAppIconPath() || undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: true,
        spellcheck: false,
        devTools: false,
        webgl: false,
      },
    });

    if (savedBounds.isMaximized) {
      this.previewWindow.maximize();
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      this.previewWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/index.html`);
    } else {
      this.previewWindow.loadFile(getRendererHtml('index.html'));
    }

    this.previewWindow.once('ready-to-show', () => {
      if (this.previewWindow) {
        this.previewWindow.show();
      }
    });

    const saveGeometry = () => {
      if (!this.previewWindow || this.previewWindow.isDestroyed()) return;
      const isMax = this.previewWindow.isMaximized();
      if (!isMax) {
        const bounds = this.previewWindow.getBounds();
        store.setPreviewBounds({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: false,
        });
      } else {
        store.setPreviewBounds({ isMaximized: true });
      }
    };

    this.previewWindow.on('resize', saveGeometry);
    this.previewWindow.on('move', saveGeometry);

    this.previewWindow.on('closed', () => {
      this.previewWindow = null;
    });

    return this.previewWindow;
  }

  toggleFloatAlwaysOnTop(): boolean {
    if (!this.floatWindow) return false;
    const current = this.floatWindow.isAlwaysOnTop();
    const next = !current;
    this.floatWindow.setAlwaysOnTop(next, next ? 'screen-saver' : 'normal');
    store.updateSettings({ floatAlwaysOnTop: next });
    return next;
  }

  togglePreviewAlwaysOnTop(): boolean {
    if (!this.previewWindow) return false;
    const current = this.previewWindow.isAlwaysOnTop();
    const next = !current;
    this.previewWindow.setAlwaysOnTop(next, next ? 'floating' : 'normal');
    store.updateSettings({ previewAlwaysOnTop: next });
    return next;
  }

  moveFloatWindow(deltaX: number, deltaY: number) {
    if (!this.floatWindow) return;
    const [currentX, currentY] = this.floatWindow.getPosition();
    this.floatWindow.setPosition(currentX + deltaX, currentY + deltaY);
  }

  getFloatPosition(): { x: number; y: number } {
    if (!this.floatWindow) return { x: 0, y: 0 };
    const [x, y] = this.floatWindow.getPosition();
    return { x, y };
  }

  setFloatPosition(x: number, y: number) {
    if (!this.floatWindow) return;
    this.floatWindow.setPosition(Math.round(x), Math.round(y));
  }
}

export const windowManager = new WindowManager();
