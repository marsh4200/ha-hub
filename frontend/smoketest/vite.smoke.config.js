import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^.*\/services\/api$/, replacement: path.resolve('smoketest/apistub.js') },
      { find: /^socket\.io-client$/, replacement: path.resolve('smoketest/sockstub.js') },
    ],
  },
});
