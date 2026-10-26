import { app, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolves the primary application icon path safely across dev and production builds.
 */
export function getAppIconPath(): string | null {
  const isWin = process.platform === 'win32';
  const iconName = isWin ? 'icon.ico' : 'icon.png';
  const candidates = [
    path.join(app.getAppPath(), 'build', iconName),
    path.join(__dirname, '../../build', iconName),
    path.join(__dirname, '../build', iconName),
    path.join(process.cwd(), 'build', iconName),
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(__dirname, '../../build', 'icon.png'),
    path.join(__dirname, '../build', 'icon.png'),
    path.join(process.cwd(), 'build', 'icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Returns a fallback base64 16x16 icon for tray.
 */
export function createDefaultTrayIcon(): Electron.NativeImage {
  const base6416x16 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVR42mNkYPj/nwEHYCRGDQyg' +
    'wQYGBsZRBqNmwKj5Yc3wHxkYGP7/Z6AABgAA1K8Q+mX46JMAAAAASUVORK5CYII=';
  return nativeImage.createFromDataURL(`data:image/png;base64,${base6416x16}`);
}

/**
 * Resolves the tray icon nativeImage.
 */
export function getTrayIcon(): Electron.NativeImage {
  const iconPath = getAppIconPath();
  if (iconPath) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        return img.resize({ width: 16, height: 16 });
      }
    } catch (e) {
      console.warn('[assets] Error loading icon for tray:', e);
    }
  }
  return createDefaultTrayIcon();
}
