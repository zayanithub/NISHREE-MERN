import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

function homepageHeroPreload() {
  const manifestPath = fileURLToPath(new URL('./src/utils/responsiveImageManifest.json', import.meta.url))
  const imageManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const heroVariants = imageManifest['/homepage-images/showroom.png']?.avif || []
  if (!heroVariants.length) throw new Error('Responsive showroom image variants are missing.')

  const srcset = heroVariants.map(({ src, width }) => `${src} ${width}w`).join(', ')
  const fallback = heroVariants.find(({ width }) => width >= 768) || heroVariants.at(-1)
  const preloadScript = `<script>(()=>{if(location.pathname!=='/'&&location.pathname!=='/home')return;const l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';l.href='${fallback.src}';l.setAttribute('imagesrcset','${srcset}');l.setAttribute('imagesizes','(max-width: 600px) 200vw, 100vw');l.fetchPriority='high';document.head.append(l)})()</script>`

  return {
    name: 'homepage-hero-preload',
    transformIndexHtml(html) {
      return html.replace('</head>', `${preloadScript}</head>`)
    },
  }
}

function primaryFontPreload() {
  return {
    name: 'primary-font-preload',
    enforce: 'post',
    generateBundle(_, bundle) {
      const fontPath = Object.keys(bundle).find((fileName) => /(?:^|\/)dm-sans-latin-wght-normal-[^/]+\.woff2$/.test(fileName))
      const html = bundle['index.html']
      if (!fontPath || !html || html.type !== 'asset') {
        throw new Error('Production DM Sans font asset or HTML entry is missing.')
      }
      html.source = String(html.source).replace(
        '</head>',
        `<link rel="preload" href="/${fontPath}" as="font" type="font/woff2" crossorigin /></head>`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://127.0.0.1:5000'

  try {
    const target = new URL(backendTarget)
    if (!['http:', 'https:'].includes(target.protocol)) {
      throw new Error()
    }
  } catch {
    throw new Error('VITE_BACKEND_URL must be a valid HTTP or HTTPS URL.')
  }

  return {
    plugins: [homepageHeroPreload(), react(), tailwindcss(), primaryFontPreload()],
    build: {
      sourcemap: true,
    },
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
