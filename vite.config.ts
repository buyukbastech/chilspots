import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(async ({ command }) => {
  const plugins: any[] = [
    tanstackStart({
      server: { entry: 'server' },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'ChillSpot AI',
        short_name: 'ChillSpot',
        description: 'ChillSpot AI Mekan Keşfi',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]

  // Add nitro (server deployment) plugin only during build
  if (command === 'build') {
    try {
      const { nitro } = await import('nitro/vite')
      plugins.push(nitro({ preset: 'vercel' }))
    } catch {
      console.warn('nitro/vite not found, skipping server deployment plugin')
    }
  }

  return {
    plugins,
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-start'],
    },
  }
})
