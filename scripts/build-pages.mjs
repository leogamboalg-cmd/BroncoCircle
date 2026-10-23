import { cp, mkdir, mkdtemp, readFile, readdir, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));

export async function buildPages({ liveAppUrl = '', commit = '', destination } = {}) {
  let liveOrigin = '';
  if (liveAppUrl.trim()) {
    const url = new URL(liveAppUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('LIVE_APP_URL must be the HTTPS origin of the deployed app, with no path, credentials, or query.');
    }
    liveOrigin = url.origin;
  }
  const directory = destination || await mkdtemp(join(tmpdir(), 'broncocircle-pages-'));
  await mkdir(directory, { recursive: true });
  await cp(join(repository, 'broncocircle'), directory, { recursive: true,
    filter: source => !source.slice(repository.length).split(/[\\/]/).some(part => part.startsWith('.')) });
  await cp(join(repository, 'frontend/login'), join(directory, 'login'), { recursive: true });
  // Only the artifact gets the routing script. Source login files stay intact.
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const path = join(directory, entry.name);
    await writeFile(path, (await readFile(path, 'utf8')).replace('<head>', '<head>\n  <script src="site-config.js"></script>'));
  }
  const loginPath = join(directory, 'login/index.html');
  await writeFile(loginPath, (await readFile(loginPath, 'utf8')).replace('<head>', '<head>\n  <script src="../site-config.js"></script>'));
  const redirect = `/* Generated deployment routing; contains no credentials. */
(() => {
  const liveOrigin = ${JSON.stringify(liveOrigin)};
  if (!liveOrigin || location.origin === liveOrigin) return;
  const base = new URL('.', document.currentScript.src).pathname;
  if (!location.pathname.startsWith(base)) return;
  const relative = location.pathname.slice(base.length).replace(/^\\/+/, '') || 'index.html';
  const target = new URL(liveOrigin);
  target.pathname = '/' + relative;
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
})();
`;
  await writeFile(join(directory, 'site-config.js'), redirect);
  await writeFile(join(directory, 'deployment.json'), JSON.stringify({ commit, liveAppUrl: liveOrigin }, null, 2) + '\n');
  return directory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = await buildPages({ liveAppUrl: process.env.LIVE_APP_URL || '', commit: process.env.GITHUB_SHA || '' });
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `path=${path}\n`);
  console.log(`Pages artifact prepared: ${path}`);
}
