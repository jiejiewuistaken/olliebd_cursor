import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@react-three\/drei$/,
        replacement: fileURLToPath(new URL('./src/dreiCompat.ts', import.meta.url)),
      },
    ],
  },
});
