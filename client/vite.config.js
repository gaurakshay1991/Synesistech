import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(process.cwd(), '..');
  const env = loadEnv(mode, envDir, '');

  return {
    envDir,
    plugins: [react()],
    base: process.env.GITHUB_ACTIONS ? '/Synesistech/' : '/',
    build: {
      outDir: 'dist',
      sourcemap: true,
      emptyOutDir: true
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.SYNESIS_API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true
    }
  };
});
