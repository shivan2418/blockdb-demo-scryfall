import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the same build works at the dev-server root and under a
  // GitHub Pages project subpath, without hardcoding the repo name. Safe with
  // HashRouter, which never changes the document's path.
  base: './',
  plugins: [react()],
})
