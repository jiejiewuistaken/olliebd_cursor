# Floating Cinema Gallery

An interactive React Three Fiber scene with a dark cinema space, a glowing floating
screen, rolling procedural picture/video cards, draggable camera perspective, and
gift hint markers hidden on the theater chairs.

## Preview

Install dependencies, then start the Vite dev server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. In Cursor Cloud, use the forwarded port for
the Vite server on port `5174`.

Controls:

- Drag to rotate around the cinema.
- Scroll to zoom in and out.
- Look across the seats to find the glowing gift hints.

## Use your own photos and videos

Put your files in:

```txt
public/media/
```

Example:

```txt
public/media/birthday-photo.jpg
public/media/travel-clip.mp4
public/media/family/picnic.webp
```

Supported image formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`. GIF files animate inside clue cards in the browser overlay.
Supported video formats: `.mp4`, `.webm`, `.mov`, `.m4v`, `.ogg`, `.ogv`.

The app scans this folder and writes `public/media-manifest.json` automatically before
`npm run dev` and `npm run build`. If you add files while the dev server is already
running, run this and refresh the browser:

```bash
npm run generate:media
```

If `public/media` is empty, the screen falls back to the built-in procedural film cards.

## Character movement controls

The scene uses controlled waypoint movement so it keeps the cinematic composition
without full free-roam physics.

A floating seat map stays on the page. The cinema has 7 seats in row 1, 9 seats in row 2, and 10 seats in row 3.

Click any seat on the map to move to that seat. The camera moves there once, then releases control so you can drag freely around the cinema with OrbitControls.

Some seats hide surprise clue cards. Found clues are saved in the Cinema Ticket Album in the corner: collected stickers are colorful and clickable, while locked clues stay as dark silhouettes. If `public/media` contains a `.gif`, the clue card uses that GIF first; otherwise it falls back to one of your photos.

## Private Gift Planning

`BIRTHDAY_GIFT_PLAN.md` records private gift concepts for the maker. These ideas are not exposed directly in the recipient-facing cinema UI, so the surprises can stay hidden behind clue cards and the ticket album.

## Troubleshooting

If the page is blank with a stale Drei/Bloom export error, stop the dev server,
restart it with `npm run dev`, and hard-refresh the browser tab. The dev script
forces Vite to rebuild its optimized dependency cache.

This project uses port `5174` for dev preview to avoid stale Vite preview
state from older local servers.
