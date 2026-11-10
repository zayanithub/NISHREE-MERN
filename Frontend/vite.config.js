import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

function criticalHeroPreload() {
  const manifestPath = fileURLToPath(new URL('./src/utils/responsiveImageManifest.json', import.meta.url))
  const imageManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const criticalImages = [
    { paths: ['/', '/home'], key: '/homepage-images/showroom.png', sizes: '100vw' },
    {
      paths: ['/product_hub'],
      key: '/assets/saree girls image.jpg',
      sizes: '(max-width: 600px) 100vw, (max-width: 900px) 55vw, 45vw',
    },
  ].map(({ paths, key, sizes }) => {
    const variants = imageManifest[key]?.avif || []
    if (!variants.length) throw new Error(`Responsive image variants are missing for ${key}.`)
    const fallback = variants.find(({ width }) => width >= 768) || variants.at(-1)
    return {
      paths,
      sizes,
      src: fallback.src,
      srcset: variants.map(({ src, width }) => `${src} ${width}w`).join(', '),
    }
  })
  const preloadScript = `<script>(()=>{const image=${JSON.stringify(criticalImages)}.find(({paths})=>paths.includes(location.pathname));if(!image)return;const l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';l.href=image.src;l.setAttribute('imagesrcset',image.srcset);l.setAttribute('imagesizes',image.sizes);l.fetchPriority='high';document.head.append(l)})()</script>`

  return {
    name: 'critical-hero-preload',
    transformIndexHtml(html) {
      const stylesheetLink = /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/i
      if (stylesheetLink.test(html)) {
        return html.replace(stylesheetLink, `${preloadScript}$&`)
      }
      return html.replace('</head>', `${preloadScript}</head>`)
    },
  }
}

function criticalResourcePreload() {
  return {
    name: 'critical-resource-preload',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html']
      const homePageChunk = Object.values(bundle).find((asset) =>
        asset.type === 'chunk' &&
        asset.facadeModuleId?.replaceAll('\\', '/').endsWith('/src/pages/HomePage.jsx')
      )
      const fontPatterns = [
        /(?:^|\/)dm-sans-latin-wght-normal-[^/]+\.woff2$/,
        /(?:^|\/)lora-latin-wght-normal-[^/]+\.woff2$/,
      ]
      const fontPaths = fontPatterns.map((pattern) => Object.keys(bundle).find((fileName) => pattern.test(fileName)))
      if (fontPaths.some((fontPath) => !fontPath) || !homePageChunk || !html || html.type !== 'asset') {
        throw new Error('Production DM Sans/Lora font assets, homepage chunk, or HTML entry are missing.')
      }
      const homePageModules = new Set([homePageChunk.fileName])
      const collectStaticImports = (chunk) => {
        for (const fileName of chunk.imports) {
          const dependency = bundle[fileName]
          if (dependency?.type !== 'chunk' || homePageModules.has(fileName)) continue
          homePageModules.add(fileName)
          collectStaticImports(dependency)
        }
      }
      collectStaticImports(homePageChunk)
      const preloadLinks = fontPaths
        .map((fontPath) => `<link rel="preload" href="/${fontPath}" as="font" type="font/woff2" crossorigin />`)
        .join('')
      const homePagePreload = `<script>(()=>{if(location.pathname!=='/'&&location.pathname!=='/home')return;for(const src of ${JSON.stringify([...homePageModules])}){const l=document.createElement('link');l.rel='modulepreload';l.href='/'+src;document.head.append(l)}})()</script>`
      const stylesheetLink = /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/i
      html.source = String(html.source)
        .replace(stylesheetLink, `${homePagePreload}$&`)
        .replace('</head>', `${preloadLinks}</head>`)
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
    plugins: [criticalHeroPreload(), react(), tailwindcss(), criticalResourcePreload()],
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
