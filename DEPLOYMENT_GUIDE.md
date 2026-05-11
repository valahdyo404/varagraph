# Deployment Guide for Varagraph

Panduan ini menjelaskan tempat deploy gratis yang paling cocok untuk Varagraph dan langkah deploy yang direkomendasikan.

## Project type

Varagraph adalah React + Vite static frontend app.

Build production:

```bash
npm run build
```

Output production:

```text
dist/
```

Static host yang dipilih harus menjalankan build command di atas lalu publish folder `dist`.

## Rekomendasi utama: Cloudflare Pages

**Pilih Cloudflare Pages untuk deploy gratis Varagraph.**

Alasan:

- Cocok untuk Vite/React static app.
- Free plan sangat besar untuk static assets.
- Static asset requests gratis dan unlimited menurut docs Cloudflare Pages Functions pricing.
- Cloudflare Pages limit Free plan mencakup 500 builds per month, cukup untuk development normal.
- Custom domain didukung.
- Tidak perlu backend/server untuk kondisi Varagraph saat ini.

### Cloudflare Pages settings

Saat import repo ke Cloudflare Pages, gunakan:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: leave blank / kosongkan
Node version: default/latest supported by Cloudflare, or set to current LTS if needed
```

### Langkah deploy Cloudflare Pages

1. Push project ke GitHub.
2. Buka Cloudflare Dashboard.
3. Masuk ke **Workers & Pages**.
4. Pilih **Create application** → **Pages**.
5. Connect ke GitHub repository Varagraph.
6. Pilih branch production, biasanya `main`.
7. Set build:
   - Build command: `npm run build`
   - Output directory: `dist`
8. Deploy.
9. Setelah sukses, Cloudflare akan memberi domain seperti:
   ```text
   https://your-project.pages.dev
   ```
10. Jika punya domain sendiri, tambahkan di tab custom domains.

## Alternatif bagus

### 1. Netlify

Bagus kalau kamu ingin UI deployment paling simpel dan preview deploy yang enak.

Settings:

```text
Build command: npm run build
Publish directory: dist
```

Catatan:

- Free plan Netlify sekarang memakai sistem monthly usage credits.
- Jika limit Free plan terlampaui, app bisa disuspend sampai bulan berikutnya.
- Tetap bagus untuk demo, portfolio, dan early prototype.

### 2. Vercel

Bagus untuk personal project dan DX cepat.

Settings:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

Catatan penting:

- Vercel Hobby/free ditujukan untuk personal/non-commercial use.
- Kalau Varagraph akan dipakai sebagai produk bisnis/SaaS/client project, jangan andalkan Vercel Hobby; gunakan Cloudflare Pages atau upgrade ke Pro.

### 3. GitHub Pages

Bagus untuk project open-source/demo sederhana.

Catatan:

- Perlu GitHub Actions workflow karena Vite butuh build step.
- Cocok untuk static docs/demo.
- GitHub Pages bukan pilihan terbaik untuk aplikasi produk/SaaS komersial.

## Ranking untuk Varagraph

| Rank | Platform | Cocok untuk | Catatan |
| --- | --- | --- | --- |
| 1 | Cloudflare Pages | Free deploy terbaik untuk Varagraph | Free-tier generous, static requests unlimited, custom domain |
| 2 | Netlify | Demo cepat dan UI deploy mudah | Watch usage credits |
| 3 | Vercel | Personal project | Hobby bukan untuk commercial use |
| 4 | GitHub Pages | Open-source demo/docs | Kurang cocok untuk produk/SaaS |

## Recommended setup for this repo

Untuk Varagraph saat ini, deploy sebagai static SPA:

```bash
npm install
npm run build
```

Publish:

```text
dist
```

Tidak perlu backend, database, atau server runtime untuk versi sekarang karena app berjalan di client/browser.

## SPA routing note

Saat ini Varagraph memakai state/hash/UI client-side dan tidak membutuhkan route server seperti `/dashboard` atau `/settings`. Jika nanti ditambah React Router dengan URL path nyata, tambahkan fallback rewrite ke `index.html` di platform deploy.

Cloudflare Pages contoh `_redirects` jika nanti dibutuhkan:

```text
/* /index.html 200
```

Untuk kondisi sekarang, file rewrite belum wajib.

## Final recommendation

Gunakan **Cloudflare Pages** dulu.

Alasan praktis:

1. Gratis dan kuat untuk static app.
2. Cocok untuk Vite `dist`.
3. Tidak ada concern Vercel Hobby non-commercial.
4. Lebih aman untuk nanti kalau Varagraph menjadi public demo atau product landing/app prototype.

## Sources checked

- Vite static deployment docs: https://vite.dev/guide/static-deploy.html
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages pricing/static asset requests: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages product/pricing page: https://www.cloudflare.com/developer-platform/products/pages/
- Netlify pricing: https://www.netlify.com/pricing/
- Netlify Free plan note: https://www.netlify.com/blog/introducing-netlify-free-plan/
- Vercel plans/pricing: https://vercel.com/docs/plans and https://vercel.com/pricing
- Vercel Terms: https://vercel.com/legal/terms
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits


## Cloudflare error: Failed: root directory not found

Jika log berhenti di `Failed: root directory not`, biasanya field **Root directory (advanced)** diisi path yang tidak ada, misalnya `/` atau nama folder yang bukan folder project. Untuk repo Varagraph, project ada di root repository, jadi field Root directory harus dikosongkan. Jangan isi `/`.

Recommended Cloudflare Pages config:

```text
Framework preset: Vite
Production branch: main
Root directory (advanced): leave blank / kosongkan
Build command: npm run build
Build output directory: dist
Install command: npm ci
Node version: default Cloudflare Pages v3, or NODE_VERSION=22.16.0 if needed
```
