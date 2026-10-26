export function sanitizeSvgString(rawSvg: string): string {
  let svg = rawSvg.trim();

  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  if (!svg.startsWith('<?xml')) {
    svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
  }

  return svg;
}

export function downloadSvg(svgContent: string, filename = 'flowchart.svg'): void {
  const cleanSvg = sanitizeSvgString(svgContent);
  const blob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function convertSvgToPngDataUrl(
  svgContent: string,
  options: { scale?: number; backgroundColor?: string } = {}
): Promise<string> {
  const { scale = 2, backgroundColor = '#0f172a' } = options;

  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');

    if (!svgEl) {
      return reject(new Error('Invalid SVG content'));
    }

    let width = 800;
    let height = 600;

    const widthAttr = svgEl.getAttribute('width');
    const heightAttr = svgEl.getAttribute('height');
    const viewBoxAttr = svgEl.getAttribute('viewBox');

    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/[\s,]+/).filter(Boolean).map(Number);
      if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    } else if (widthAttr && heightAttr) {
      const parsedW = parseFloat(widthAttr);
      const parsedH = parseFloat(heightAttr);
      if (!isNaN(parsedW) && !isNaN(parsedH)) {
        width = parsedW;
        height = parsedH;
      }
    }

    svgEl.setAttribute('width', `${width}`);
    svgEl.setAttribute('height', `${height}`);

    const cleanSvg = sanitizeSvgString(new XMLSerializer().serializeToString(svgEl));
    const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        return reject(new Error('Failed to get 2D canvas context'));
      }

      if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error(`Failed to rasterize SVG: ${e}`));
    };

    img.src = blobUrl;
  });
}

export async function downloadPng(
  svgContent: string,
  filename = 'flowchart.png',
  options: { scale?: number; backgroundColor?: string } = {}
): Promise<void> {
  const dataUrl = await convertSvgToPngDataUrl(svgContent, options);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
}

export async function copySvgToClipboard(svgContent: string): Promise<boolean> {
  try {
    const cleanSvg = sanitizeSvgString(svgContent);
    await navigator.clipboard.writeText(cleanSvg);
    return true;
  } catch {
    return false;
  }
}

export async function copyPngToClipboard(
  svgContent: string,
  options: { scale?: number; backgroundColor?: string } = {}
): Promise<boolean> {
  try {
    const dataUrl = await convertSvgToPngDataUrl(svgContent, options);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

