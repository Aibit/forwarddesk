import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'

// One id per build: the app compares it with /forwarddesk/version.json to tell people on an old (cached) build to reload.
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' } })()
const BUILD = `${sha}-${Date.now().toString(36)}`
const versionFile = (): Plugin => ({
  name: 'fd-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this app below /forwarddesk/.
  base: '/forwarddesk/',
  plugins: [react(), versionFile()],
  define: { __FD_BUILD__: JSON.stringify(BUILD) },
})
