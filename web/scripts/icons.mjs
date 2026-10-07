import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#BBECFF"/><stop offset="1" stop-color="#2397DF"/></linearGradient></defs><rect width="512" height="512" rx="114" fill="#F3F8FD"/><g transform="translate(66 55) scale(6)"><path d="M32 7C27 16 10 24 10 39c0 12 9 19 22 19s22-7 22-19C54 24 37 16 32 7Z" fill="url(#a)"/><path d="M24 23c-5 5-8 10-8 15" stroke="white" stroke-width="3.5" stroke-linecap="round" opacity=".7"/><ellipse cx="32" cy="38" rx="29" ry="10" transform="rotate(-25 32 38)" stroke="#2788BC" stroke-width="1.4" fill="none"/></g></svg>`
await fs.mkdir(new URL('../public/icons/', import.meta.url), { recursive: true })
await fs.writeFile(new URL('../public/favicon.svg', import.meta.url), svg)
for (const size of [192, 512])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`../public/icons/ciel-${size}.png`, import.meta.url)))
await sharp(Buffer.from(svg))
  .resize(400, 400)
  .extend({ top: 56, bottom: 56, left: 56, right: 56, background: '#F3F8FD' })
  .png()
  .toFile(fileURLToPath(new URL('../public/icons/ciel-maskable-512.png', import.meta.url)))
console.log('Generated original favicon and installable PWA icons.')
