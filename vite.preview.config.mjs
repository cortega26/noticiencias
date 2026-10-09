import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serve Astro's generated static files as a multi-page site. Vite's default
// SPA fallback turns unknown routes into HTTP 200 responses for index.html,
// which does not match the built 404.html or production routing contract.
export default {
  root: dirname(fileURLToPath(import.meta.url)),
  appType: 'mpa',
};
