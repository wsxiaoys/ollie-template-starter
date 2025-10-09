import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    watch: null
  },
  plugins: [
    tailwindcss(),
  ],
})