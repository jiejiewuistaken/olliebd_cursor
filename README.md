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

Supported image formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`.
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

Use the buttons on the right side of the screen, or press:

- `1` = Middle seat
- `2` = Left aisle
- `3` = Right aisle
- `4` = Front row
- `5` = Projector booth

The camera smoothly moves between these curated viewpoints, and you can still drag
to look around with OrbitControls.

## Troubleshooting

If the page is blank with a stale Drei/Bloom export error, stop the dev server,
restart it with `npm run dev`, and hard-refresh the browser tab. The dev script
forces Vite to rebuild its optimized dependency cache.

This project uses port `5174` for dev preview to avoid stale Vite preview
state from older local servers.
