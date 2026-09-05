import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Preview the actual production bundle; npm run build remains the sole site builder.
export default defineConfig({
  root: fileURLToPath(new URL('./dist', import.meta.url)),
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  plugins: [
    {
      name: 'responsive-qa-surface',
      configureServer(server) {
        // A local-only browser QA harness, never copied into the production output.
        server.middlewares.use('/__qa', async (_request, response) => {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(await readFile(new URL('./tests/browser-qa.html', import.meta.url), 'utf8'));
        });
      },
    },
  ],
});
