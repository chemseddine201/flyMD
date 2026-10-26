const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true,
    },
  });

  const svgPath = path.join(__dirname, '../build/icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Wrap SVG in a full-bleed HTML document
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 512px; height: 512px; overflow: hidden; background: transparent; }
    svg { width: 512px; height: 512px; display: block; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait 500ms for SVG rendering and filters to settle
  await new Promise(r => setTimeout(r, 600));

  const image = await win.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const pngBuffer = image.toPNG();
  const outPath = path.join(__dirname, '../build/icon.png');
  fs.writeFileSync(outPath, pngBuffer);

  const statusPath = path.join(__dirname, '../build/icon-gen-result.txt');
  fs.writeFileSync(statusPath, `Successfully wrote icon.png (${pngBuffer.length} bytes, size: ${image.getSize().width}x${image.getSize().height})`);

  app.quit();
});
