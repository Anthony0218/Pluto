import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { relative, join, extname } from 'node:path';

const root = fileURLToPath(new URL('../..', import.meta.url));
const imageProvenance = JSON.parse(await readFile(join(root, 'docs/AI_IMAGE_PROVENANCE.json'), 'utf8'));
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && /\.(png|jpe?g|webp|svg|mp3|wav|ogg|glb|gltf|woff2?)$/i.test(entry.name)) files.push(path);
  }
  return files;
}
function status(path, hash) {
  if (path.startsWith('public/flags/')) return 'flag-icons 7.5.0; MIT; bundled notices';
  if (path.startsWith('public/group-avatars/')) return 'OpenAI generation recorded in group-avatars/README.md';
  if (imageProvenance.files[path] === hash) return `AI-generated with Codex; project owner confirmed ${imageProvenance.confirmedOn}; third-party rights still apply`;
  if (path.startsWith('public/models/chess/')) return 'Tinymen CGTrader; extraction restrictions; browser permission unresolved';
  return 'Author/source/permission not recorded per file; confirm or replace';
}
const rows = [['path', 'type', 'sha256', 'provenance_status']];
for (const file of (await walk(join(root, 'public'))).sort()) {
  const path = relative(root, file);
  const hash = createHash('sha256').update(await readFile(file)).digest('hex');
  rows.push([path, extname(file).slice(1), hash, status(path, hash)]);
}
await writeFile(join(root, 'docs/MEDIA_INVENTORY.csv'), rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n') + '\n');
console.log(`Inventoried ${rows.length - 1} public media files.`);
