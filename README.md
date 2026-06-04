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

Use the buttons on the right side of the screen, or press the keys below. The default entry point is the back row so you can see the seats and screen together:

- `1` = Back row
- `2` = Left aisle
- `3` = Mystery point 1 (random seat)
- `4` = Mystery point 2 (random seat)

The camera smoothly moves to a selected viewpoint once, then releases control so
you can drag freely around the cinema with OrbitControls. Mystery points are randomly selected seat views
each time the app loads. Row 2 Seat 2 and Row 5 Seat 7 are fixed clue seats;
if a mystery point lands on one, selecting it opens an animated film clue card, and
selecting it again hides the card. If `public/media` contains a `.gif`, the clue card
uses that GIF first; otherwise it falls back to one of your photos.

## Troubleshooting

If the page is blank with a stale Drei/Bloom export error, stop the dev server,
restart it with `npm run dev`, and hard-refresh the browser tab. The dev script
forces Vite to rebuild its optimized dependency cache.

This project uses port `5174` for dev preview to avoid stale Vite preview
state from older local servers.
