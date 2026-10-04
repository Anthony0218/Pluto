import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

// Embed flag art without answer-bearing asset URLs or SVG metadata in multiplayer payloads.
const root = fileURLToPath(new URL('../..', import.meta.url));
const countries = JSON.parse(await readFile(join(root, 'data/geography/countries.json'), 'utf8'));
const flags = {};
for (const country of countries) {
  if (!country.flagAsset || !country.flagAsset.startsWith('/flags/')) continue;
  const path = resolve(root, 'public', country.flagAsset.slice(1));
  let svg = await readFile(path, 'utf8');
  svg = svg.replace(/<!--[^]*?-->/g, '').replace(/<(title|desc)\b[^>]*>[^]*?<\/\1>/gi, '');
  svg = svg.replace(/(<svg\b[^>]*?)\s+id="[^"]*"/i, '$1');
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  for (const [index, id] of ids.entries()) {
    svg = svg.replaceAll(`id="${id}"`, `id="art${index}"`)
      .replaceAll(`href="#${id}"`, `href="#art${index}"`)
      .replaceAll(`url(#${id})`, `url(#art${index})`);
  }
  flags[country.flagAsset] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
await writeFile(join(root, 'supabase/functions/atlas-match/flag-media.json'), JSON.stringify(flags) + '\n');
console.log(`Bundled ${Object.keys(flags).length} flag assets.`);
