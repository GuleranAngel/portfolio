# guleranangel.com

Portfolio of Angel Guleran, brand identity designer. Built with [Astro](https://astro.build), hosted on Netlify.

## Run it

```sh
npm install
npm run dev      # local dev server on http://localhost:4321
npm run build    # static build into dist/, then checks the copy for em and en dashes
npm run preview  # serve the built site
```

Node 22.12 or newer.

## Structure

- `src/pages/` the homepage, the two case studies (`work/atlas-pay`, `work/pog`) and the 404 page
- `src/components/` shared pieces: header, footer, dividers, case study hero, credits, next project, contact
- `src/styles/global.css` tokens (colours, spacing, breakpoints) and the type styles from the Figma file
- `src/data/site.ts` name, email and links
- `src/scripts/site.ts` mobile menu and the video manager (lazy loads, pauses off screen, respects reduced motion)

## Images

Images are pre-built, not processed during the Netlify build, so deploys stay fast.

1. Put a source file (PNG or JPG, about 2x its largest display size) in a source folder, named like `pog-cap.jpg`.
2. Run `node scripts/build-images.mjs <source-folder>`.
3. It writes AVIF and WebP widths to `public/img/` and updates `src/data/images.json`.
4. Use it with `<Picture name="pog-cap" alt="..." sizes="..." />`.

## Videos

Loops live in `public/video/` as H.264 MP4 in two sizes (`-1080.mp4` and `-720.mp4`) with a WebP poster in `public/video/poster/`. Use `<LoopVideo name="..." label="..." />`. Phones and Save-Data get the 720p file.

Example encode:

```sh
ffmpeg -i in.mp4 -an -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -vf scale=1920:-2 -movflags +faststart name-1080.mp4
ffmpeg -i in.mp4 -an -c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p -vf scale=1280:-2 -movflags +faststart name-720.mp4
```

## Fonts

Instrument Sans, Fragment Mono and Poppins (POG page only), self-hosted from Google Fonts and subset to Latin with arrows. SIL Open Font License, see `public/fonts/LICENSES.txt`.

## Copy rule

No em dashes. `npm run build` fails if one slips into the published pages.
