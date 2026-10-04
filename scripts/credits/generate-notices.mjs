// Regenerate public notices and the credits inventory from the installed dependency tree.
// License texts stay in their original language; page labels are translated by the app.
import { readFile, readdir, realpath, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const project = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const packages = new Map();
const seen = new Set();

async function locate(name, from) {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);
    try { await readFile(join(candidate, 'package.json')); return await realpath(candidate); }
    catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
    if (dirname(directory) === directory) return null;
  }
}

function projectUrl(pkg) {
  const raw = pkg.homepage || (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url) || '';
  const url = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
  return /^https?:\/\//.test(url) ? url : `https://www.npmjs.com/package/${pkg.name}`;
}

async function visit(name, from, optional = false, scope = 'transitive') {
  const directory = await locate(name, from);
  if (!directory) {
    if (optional) return;
    throw new Error(`Missing dependency ${name}. Install dependencies before generating credits.`);
  }
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  const previous = packages.get(key);
  if (previous && scope !== 'transitive') previous.scope = scope;
  if (seen.has(directory)) return;
  seen.add(directory);
  const licenseFiles = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && /^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(entry.name)) {
      licenseFiles.push({ name: entry.name, text: await readFile(join(directory, entry.name), 'utf8') });
    }
  }
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || pkg.licenses?.map(item => item.type).join(' OR ') || 'See upstream license';
  if (!previous) packages.set(key, { name: pkg.name, version: pkg.version, license, homepage: projectUrl(pkg), scope, licenseFiles });
  const optionalNames = pkg.optionalDependencies ?? {};
  const peerNames = pkg.peerDependencies ?? {};
  for (const dependency of Object.keys({ ...pkg.dependencies, ...optionalNames, ...peerNames }).sort()) {
    // Include installed peer packages; absent peers can be optional integrations.
    await visit(dependency, directory, dependency in optionalNames || dependency in peerNames);
  }
}

// Visit direct packages first so their scope wins over transitive references.
for (const [scope, dependencies] of [['runtime', project.dependencies], ['development', project.devDependencies]]) {
  for (const name of Object.keys(dependencies ?? {}).sort()) await visit(name, root, false, scope);
}
const inventory = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
await mkdir(join(root, 'public/licenses'), { recursive: true });
await writeFile(join(root, 'src/data/dependencyCredits.json'), JSON.stringify(inventory.map(({ licenseFiles, ...item }) => item), null, 2) + '\n');
const notices = ['Pluto — third-party software notices', 'Generated from installed runtime, server and development dependencies.', 'Package names, versions, upstream links and original license/copyright notices follow.', ''];
for (const item of inventory) {
  notices.push('='.repeat(72), `${item.name} ${item.version}`, `License: ${item.license}`, `Project: ${item.homepage}`, '');
  for (const file of item.licenseFiles) notices.push(`--- ${file.name} ---`, file.text, '');
  if (!item.licenseFiles.length) notices.push('This package does not ship a root license text. Consult its upstream project and declared license.', '');
}
notices.push('='.repeat(72), 'Web KaTrain — vendored browser Go engine', 'Source commit: 8dd813aeb565cbdad5215dc75204fc40fd519c50', 'https://github.com/Sir-Teo/web-katrain', await readFile(join(root, 'src/vendor/browser-katago/LICENSE'), 'utf8'));
await writeFile(join(root, 'public/licenses/third-party-notices.txt'), notices.join('\n'));
await copyFile(resolve(root, 'node_modules/stockfish/Copying.txt'), join(root, 'public/licenses/Stockfish-GPL-3.0.txt'));
console.log(`Generated credits and notices for ${inventory.length} installed packages.`);
