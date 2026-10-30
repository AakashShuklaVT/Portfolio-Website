import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORLD_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'public/data/world.json')

/** Keeps numeric arrays on one line so world.json stays readable and diffable. */
const formatWorld = (world: unknown) =>
  JSON.stringify(world, null, 2).replace(/\[\s+([-\d.e,\s]+?)\s+\]/g, (_, inner: string) => `[${inner.replace(/\s+/g, ' ')}]`)

/** Dev-only endpoint the in-browser editor uses to write public/data/world.json. */
function editorSavePlugin(): Plugin {
  return {
    name: 'portfolio-island-editor-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__editor/save-world', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            const world = JSON.parse(body)
            if (world?.version !== 1 || !world.terrain || !world.track) throw new Error('Not a world file')
            await mkdir(dirname(WORLD_FILE), { recursive: true })
            await writeFile(WORLD_FILE, formatWorld(world) + '\n')
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: 'public/data/world.json' }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), editorSavePlugin()],
  server: {
    // Saving world.json from the editor must not trigger a full page reload.
    watch: { ignored: ['**/public/data/world.json'] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // Vendors change rarely; separate chunks keep them cached across deploys.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\/]three[\/]/ },
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler|@react-three|zustand|its-fine|suspend-react)[\/]/ },
          ],
        },
      },
    },
  },
})
