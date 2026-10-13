import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2020', rollupOptions: { input: { main: 'index.html', portal: 'portal.html' } } },
});
