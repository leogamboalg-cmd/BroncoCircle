import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildPages } from '../../scripts/build-pages.mjs';

test('Pages artifact includes the actual website, login and correct image assets without backend secrets', async()=>{
  const directory = await buildPages({ commit: 'test-sha' });
  for (const file of ['index.html', 'discover.html', 'search.html', 'app.js', 'api.js', 'live.js', 'assets/teamphoto.jpeg', 'assets/billiards.png', 'login/index.html', 'login/login.css', 'login/login.js', 'login/assets/dm-sans.woff2']) {
    assert.ok((await stat(join(directory, file))).size > 0, file);
  }
  assert.match(await readFile(join(directory,'discover.html'),'utf8'), /src="site-config.js"/);
  assert.match(await readFile(join(directory,'login/index.html'),'utf8'), /src="..\/site-config.js"/);
  const sourceLogin = await readFile(new URL('../../frontend/login/login.js',import.meta.url),'utf8');
  assert.equal(await readFile(join(directory,'login/login.js'),'utf8'), sourceLogin);
  await assert.rejects(stat(join(directory,'.env')), { code: 'ENOENT' });
  await assert.rejects(stat(join(directory,'backend')), { code: 'ENOENT' });
  const metadata = JSON.parse(await readFile(join(directory,'deployment.json'),'utf8'));
  assert.equal(metadata.commit,'test-sha'); assert.equal(metadata.liveAppUrl,'');
});

test('existing Pages links forward to the full app while preserving event and student URLs', async()=>{
  const directory = await buildPages({ liveAppUrl:'https://campus.example/' });
  const source = await readFile(join(directory,'site-config.js'),'utf8');
  for (const [path, query, hash] of [['/BroncoCircle/discover.html','', '#event=123'], ['/BroncoCircle/index.html','?student=456',''], ['/BroncoCircle/login/','',''], ['/BroncoCircle/','','']]) {
    let redirected;
    vm.runInNewContext(source, { URL,
      document:{ currentScript:{ src:'https://example.github.io/BroncoCircle/site-config.js' } },
      location:{ origin:'https://example.github.io', pathname:path, search:query, hash, replace: url=>{ redirected=url; } }
    });
    assert.equal(redirected, `https://campus.example/${path.slice('/BroncoCircle/'.length) || 'index.html'}${query}${hash}`);
  }
  for (const url of ['http://campus.example', 'https://user:pass@campus.example', 'https://campus.example/private']) {
    await assert.rejects(buildPages({ liveAppUrl:url }));
  }
});
