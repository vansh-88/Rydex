import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The backend refuses to boot in production with a CORS_ORIGIN containing
// localhost, so a dev server can never be a legitimate cross-origin caller.
// Proxying instead makes every request same-origin from the browser's point
// of view, which sidesteps CORS entirely rather than working around it — and
// it keeps the app's own code free of absolute API URLs.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        // Socket.IO negotiates over HTTP before upgrading, so the proxy needs
        // both or the handshake 404s before a WebSocket is ever attempted.
        '/socket.io': { target, changeOrigin: true, ws: true },
      },
    },
  };
});
