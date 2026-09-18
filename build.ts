import { cp, mkdir } from 'node:fs/promises'

const results = await Promise.all([
  Bun.build({ entrypoints: ['./server.ts'], target: 'bun', outdir: './dist', minify: true }),
  Bun.build({ entrypoints: ['./public/app.js', './public/styles.css'], target: 'browser', outdir: './dist/public', minify: true }),
])
for (const result of results) {
  if (!result.success) {
    console.error(result.logs)
    process.exit(1)
  }
}
await mkdir('dist/public', { recursive: true })
await cp('public/index.html', 'dist/public/index.html')
await cp('public/admin.html', 'dist/public/admin.html')
await cp('public/assets', 'dist/public/assets', { recursive: true })
await cp('public/proposals', 'dist/public/proposals', { recursive: true })
const avatarPreview = await Bun.build({ entrypoints: ['./public/proposals/avatars.js'], target: 'browser', outdir: './dist/public/proposals', minify: true })
if (!avatarPreview.success) {
  console.error(avatarPreview.logs)
  process.exit(1)
}
console.log('Production build ready in dist/')
