import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

function staleDreiBloomCompatibility(): Plugin {
  return {
    name: 'stale-drei-bloom-compatibility',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/node_modules/.vite/deps/@react-three_drei.js')) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript');
        res.end(`export * from '/node_modules/@react-three/drei/index.js';\nexport { Bloom, EffectComposer } from '/node_modules/.vite/deps/@react-three_postprocessing.js';\n`);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), staleDreiBloomCompatibility()],
  resolve: {
    alias: [
      {
        find: /^@react-three\/drei$/,
        replacement: fileURLToPath(new URL('./src/dreiCompat.ts', import.meta.url)),
      },
    ],
  },
});
