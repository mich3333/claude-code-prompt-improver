import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: media:",
  "media-src 'self' media:",
  "font-src 'self' data:",
].join('; ');

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [
    react(),
    {
      // Strict CSP for the packaged app (the dev server needs inline scripts for hot reload).
      name: 'clipcraft-csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
  ],
  build: {
    outDir: '../../build/renderer',
    emptyOutDir: true,
    target: 'chrome130',
  },
});
