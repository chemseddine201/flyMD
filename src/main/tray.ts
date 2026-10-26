import { app, Tray, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { windowManager } from './windows';
import { store } from './store';
import { getTrayIcon } from './infrastructure/electron/assets';

let tray: Tray | null = null;

export function setupSystemTray(): Tray {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('FlyMD - On-the-fly Markdown');

  const updateContextMenu = () => {
    if (!tray) return;

    const history = store.getHistory().slice(0, 5);
    const historySubmenu: Electron.MenuItemConstructorOptions[] = history.length > 0
      ? history.map((item) => ({
          label: item.name,
          click: () => {
            const previewWin = windowManager.createPreviewWindow();
            fs.promises.readFile(item.path, 'utf-8').then((content) => {
              previewWin.webContents.send('preview:file-loaded', {
                path: item.path,
                name: item.name,
                content,
                lastModified: item.lastOpened,
              });
              previewWin.show();
              previewWin.focus();
            }).catch(console.error);
          },
        }))
      : [{ label: 'No recent files', enabled: false }];

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Float Hub',
        click: () => {
          const floatWin = windowManager.createFloatWindow();
          floatWin.show();
          floatWin.focus();
        },
      },
      {
        label: 'New Markdown Editor',
        click: () => {
          const previewWin = windowManager.createPreviewWindow();
          previewWin.webContents.send('preview:file-loaded', {
            path: '',
            name: 'Untitled.md',
            content: '# Untitled Document\n\nStart writing here...',
            lastModified: Date.now(),
          });
          previewWin.show();
          previewWin.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Recent Files',
        submenu: historySubmenu,
      },
      { type: 'separator' },
      {
        label: 'Float Hub Always-on-Top',
        type: 'checkbox',
        checked: store.getSettings().floatAlwaysOnTop,
        click: () => {
          windowManager.toggleFloatAlwaysOnTop();
          updateContextMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit FlyMD',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('click', () => {
    const floatWin = windowManager.createFloatWindow();
    if (floatWin.isVisible()) {
      floatWin.focus();
    } else {
      floatWin.show();
    }
  });

  return tray;
}
