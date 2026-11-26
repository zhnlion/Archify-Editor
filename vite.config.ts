import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { finalizePlugin } from './plugins/finalizePlugin'

export default defineConfig({
  plugins: [react(), finalizePlugin()],
  server: { host: '127.0.0.1', port: 5180, strictPort: true, open: true },
  preview: { port: 4173 },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
})
