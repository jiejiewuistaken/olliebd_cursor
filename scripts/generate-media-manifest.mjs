import { readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mediaDir = join(root, 'public', 'media');
const manifestPath = join(root, 'public', 'media-manifest.json');

const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const videoExtensions = new Set(['.m4v', '.mov', '.mp4', '.ogg', '.ogv', '.webm']);

function titleFromFile(filePath) {
  return filePath
    .replace(/\.[^/.]+$/, '')
    .split(/[\\/]/)
    .pop()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function collectMediaFiles(directory) {
  let entries = [];

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectMediaFiles(entryPath);
      }

      const extension = extname(entry.name).toLowerCase();
      const type = imageExtensions.has(extension)
        ? 'photo'
        : videoExtensions.has(extension)
          ? 'video'
          : null;

      if (!type) {
        return [];
      }

      const publicPath = `/${relative(join(root, 'public'), entryPath).replace(/\\/g, '/')}`;

      return [
        {
          title: titleFromFile(entry.name),
          type,
          src: publicPath,
        },
      ];
    }),
  );

  return files.flat().sort((a, b) => a.src.localeCompare(b.src));
}

const media = await collectMediaFiles(mediaDir);
await writeFile(manifestPath, `${JSON.stringify(media, null, 2)}\n`);

console.log(`Generated public/media-manifest.json with ${media.length} media file(s).`);
