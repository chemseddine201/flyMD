import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            sourcemap: false,
            minify: 'esbuild',
            rollupOptions: {
              external: ['electron', 'path', 'fs', 'os', 'child_process', 'crypto'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            sourcemap: false,
            minify: 'esbuild',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        float: path.resolve(__dirname, 'float.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (/[\\/]node_modules[\\/]katex[\\/]/.test(id)) {
              return 'vendor-katex';
            }
            if (/[\\/]node_modules[\\/]highlight\.js[\\/]/.test(id)) {
              return 'vendor-highlight';
            }
            if (/[\\/]node_modules[\\/](@codemirror|@uiw|@lezer)[\\/]/.test(id)) {
              return 'vendor-codemirror';
            }
            if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) {
              return 'vendor-lucide';
            }
            if (/[\\/]node_modules[\\/](marked|marked-highlight|dompurify)[\\/]/.test(id)) {
              return 'vendor-markdown';
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
