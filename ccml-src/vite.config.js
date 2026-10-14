import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://potentoperations.netlify.app/ccml/ (same site, same repo as POTENT OS)
export default defineConfig({
  base: '/ccml/',
  plugins: [react()],
  build: { outDir: 'dist' }
})
