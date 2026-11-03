// Genera icone PWA, apple-touch-icon e splash screen iOS a partire dal logo.
// Uso: node scripts/icons.mjs
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const logo = path.resolve(root, '../assets/logo.png')
const out = path.join(root, 'public/icons')
const splashOut = path.join(root, 'public/splash')
const BG = '#0F0D0A'

await mkdir(out, { recursive: true })
await mkdir(splashOut, { recursive: true })

// Il logo è trasparente: lo componiamo su fondo pieno (iOS non accetta trasparenza).
// scale = quota del lato occupata dal logo; la maskable resta nella safe zone.
async function icon(size, scale, name) {
  const inner = Math.round(size * scale)
  const img = await sharp(logo).resize(inner, inner).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: img, gravity: 'center' }])
    .flatten({ background: BG })
    .png()
    .toFile(path.join(out, name))
}

await icon(32, 1, 'icon-32.png')
await icon(180, 0.92, 'apple-touch-icon.png')
await icon(192, 0.92, 'icon-192.png')
await icon(512, 0.92, 'icon-512.png')
await icon(512, 0.72, 'icon-maskable-512.png')

// Splash iOS: [larghezza px, altezza px, larghezza CSS, altezza CSS, dpr]
const devices = [
  [1320, 2868, 440, 956, 3], // 16/17 Pro Max
  [1206, 2622, 402, 874, 3], // 16/17 Pro, 17
  [1260, 2736, 420, 912, 3], // Air
  [1290, 2796, 430, 932, 3], // 14 Pro Max, 15/16 Plus e Pro Max
  [1179, 2556, 393, 852, 3], // 14 Pro, 15, 16
  [1284, 2778, 428, 926, 3], // 12/13 Pro Max, 14 Plus
  [1170, 2532, 390, 844, 3], // 12, 13, 14
  [1125, 2436, 375, 812, 3], // X, XS, 11 Pro, mini
  [1242, 2688, 414, 896, 3], // XS Max, 11 Pro Max
  [828, 1792, 414, 896, 2], // XR, 11
  [750, 1334, 375, 667, 2], // SE, 8
]

const links = []
for (const [w, h, cw, ch, dpr] of devices) {
  const s = Math.round(w * 0.5)
  const img = await sharp(logo).resize(s, s).png().toBuffer()
  const name = `splash-${w}x${h}.png`
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: img, top: Math.round(h * 0.38 - s / 2), left: Math.round((w - s) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(splashOut, name))
  links.push(
    `<link rel="apple-touch-startup-image" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="splash/${name}" />`,
  )
}

// Da incollare in index.html se cambia la lista dei dispositivi.
await writeFile(path.join(root, 'scripts/splash-links.html'), links.join('\n') + '\n')
console.log(`Icone in ${out}, ${devices.length} splash in ${splashOut}`)
