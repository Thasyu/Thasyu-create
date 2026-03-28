This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy environment variables template first:

```bash
cp .env.example .env.local
```

PowerShell (Windows):

```powershell
Copy-Item .env.example .env.local
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Video Export (FFmpeg)

This project includes a server-side render endpoint at `/api/render`.
It converts the browser timeline JSON into an FFmpeg command and generates an MP4 in `public/renders`.

### Prerequisite

- Install FFmpeg and ensure `ffmpeg` is available in your PATH.

### Usage

- Open the editor page and click `Export MP4`.
- The client sends timeline JSON (`clips`, `start`, `length`, `trimIn`, `track`, `zIndex`) to `/api/render`.
- The server runs FFmpeg with `filter_complex` and returns a downloadable file URL like `/renders/<file>.mp4`.

### Optional Environment Variables (Render Safeguards)

- `RENDER_MAX_CLIPS` (default: `120`)
- `RENDER_MAX_WIDTH` (default: `1920`)
- `RENDER_MAX_HEIGHT` (default: `1080`)
- `RENDER_MAX_FPS` (default: `60`)
- `RENDER_MAX_DURATION_SECONDS` (default: `180`)
- `RENDER_MAX_TOTAL_TEXT_LENGTH` (default: `20000`)
- `RENDER_MAX_CONCURRENCY` (default: `2`)
- `RENDER_RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RENDER_RATE_LIMIT_MAX_REQUESTS` (default: `20`)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
