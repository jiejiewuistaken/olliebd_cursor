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

## Character movement design

The safest way to add movement without breaking the cinema mood is to move a
small camera/character rig between curated points instead of adding full free-roam
physics immediately.

Recommended implementation:

1. Create a `ViewerRig` group that owns the camera target and current seat/aisle position.
2. Define allowed waypoints only where the scene looks good, for example center seats,
   side aisles, front row, and projector booth.
3. Move between waypoints with smooth interpolation (WASD, arrow keys, or click-to-move).
4. Keep `OrbitControls` for looking around, but clamp zoom/rotation so the camera stays
   inside the theater.
5. Add collision/physics later only if you need free walking; the waypoint rig is much
   less likely to disturb lighting, gifts, chairs, or the floating screen composition.

This keeps the current cinematic scene intact while still making the viewer feel like a
character moving through the room.

## Troubleshooting

If the page is blank with a stale Drei/Bloom export error, stop the dev server,
restart it with `npm run dev`, and hard-refresh the browser tab. The dev script
forces Vite to rebuild its optimized dependency cache.

This project uses port `5174` for dev preview to avoid stale Vite preview
state from older local servers.
