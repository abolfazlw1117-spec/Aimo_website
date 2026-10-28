import { defineConfig } from 'vite';

// Same policy as vercel.json, also embedded as <meta> in production builds so static hosts
// without custom headers (e.g. GitHub Pages) are covered. Skipped in `vite dev`.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

const metaCsp = () => ({
  name: 'meta-csp',
  transformIndexHtml(html, ctx) {
    if (!ctx || !ctx.bundle) return html;
    return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
  }
});

export default defineConfig({
  base: './', // works on Vercel and under a sub-path such as /Aimo_website/
  plugins: [metaCsp()],
  build: { target: 'es2019', sourcemap: false, chunkSizeWarningLimit: 600 }
});
