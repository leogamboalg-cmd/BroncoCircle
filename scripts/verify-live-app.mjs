import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyLiveApp(origin, fetchImpl = fetch) {
  if (!origin) return;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Expected an HTTPS app origin.');
  for (const [path, marker] of [['/api/health', null], ['/login/', 'id="choose-login"'], ['/discover.html', 'src="live.js"']]) {
    const response = await fetchImpl(new URL(path, url), { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`Live app check failed: ${path} returned HTTP ${response.status}. Check Render deployment logs.`);
    if (marker) {
      if (!(await response.text()).includes(marker)) throw new Error(`Live app check failed: ${path} is not the expected BroncoCircle page. Render must deploy the latest main branch from the repository root.`);
    } else if ((await response.json()).status !== 'ok') throw new Error('The Render API health check did not return ok.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyLiveApp(process.env.LIVE_APP_URL || '');
  console.log('Live app checks passed.');
}
