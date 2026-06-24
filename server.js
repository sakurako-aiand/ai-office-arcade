/**
 * Minimal static-file server for production (build.io / Heroku-style platform).
 *
 * Serves the Vite build output in ./dist, falls back to index.html for any
 * non-asset route (SPA behavior), and binds to the platform-provided PORT.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const app = express();

// Cache static assets aggressively (file names are content-hashed by Vite).
app.use(
  express.static(DIST_DIR, {
    maxAge: '1y',
    immutable: true,
    index: false,
  })
);

// SPA fallback: any unmatched GET returns index.html.
app.get('*', (_req, res, next) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ai& Office Arcade] serving ./dist on port ${PORT}`);
});
