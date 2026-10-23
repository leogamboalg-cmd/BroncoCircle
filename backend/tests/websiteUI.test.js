// Run the actual page scripts with a small DOM stand-in and a shared API fixture.
// This checks wiring and rendered HTML, not browser layout or accessibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const scripts = await Promise.all(['api.js', 'app.js', 'discover.js', 'live.js'].map(name=>readFile(new URL(`../../broncocircle/${name}`, import.meta.url), 'utf8')));
function element() {
  const attributes = new Map(), listeners = new Map();
  return { value: '', dataset: {}, textContent: '', innerHTML: '', hidden: false, open: false, tagName: 'DIV',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute: (key,value)=>attributes.set(key,value), getAttribute: key=>attributes.get(key), hasAttribute: key=>attributes.has(key), removeAttribute: key=>attributes.delete(key),
    addEventListener(name, callback) { listeners.set(name, callback); }, listeners,
    removeEventListener(name) { listeners.delete(name); },
    append() {}, prepend() {}, remove() {}, focus() {}, scrollIntoView() {},
    querySelector: ()=>element(), querySelectorAll: ()=>[],
    showModal() { this.open = true; }, close() { this.open = false; }, reset() {},
  };
}
async function page(fetcher, token = 'host', mode = 'live') {
  const nodes = new Map();
  const get = selector=>{ if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const body = element(); body.dataset.page = 'discover';
  const document = { body, activeElement: body, hidden: false, title: '', querySelector: get,
    querySelectorAll: ()=>[], createElement: element, addEventListener() {}, getElementById: id=>get(`#${id}`) };
  const storage = new Map([['broncocircle-token', token]]);
  const sandbox = { document, location: { hostname: 'localhost', protocol: 'http:', search: '', hash: '', pathname: '/discover.html' },
    history: { replaceState() {} }, AbortSignal, URLSearchParams, URL, FormData, console,
    localStorage: { getItem: ()=>null, setItem() {} }, sessionStorage: { getItem: key=>storage.get(key), setItem: (key,value)=>storage.set(key,value), removeItem: key=>storage.delete(key) },
    fetch: fetcher, addEventListener() {}, setTimeout: ()=>0, clearTimeout() {}, CSS: { escape: value=>value } };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const script of scripts) vm.runInContext(script, context);
  const expectedStatus = mode === 'demo' ? /^Demo preview/ : /^Signed in as/;
  for (let i = 0; i < 100 && !expectedStatus.test(get('#session-status').textContent); i++) await new Promise(resolve=>setImmediate(resolve));
  assert.match(get('#session-status').textContent, expectedStatus);
  return { context, get, live: sandbox.LiveApp, api: sandbox.BroncoAPI };
}

test('static preview shows the photo field near the top and explains that uploads need the running app', async()=>{
  const preview = await page(async()=>new Response('Not found', { status:404 }), '', 'demo');
  vm.runInContext('showCreateForm()', preview.context);
  const markup = preview.get('#form-content').innerHTML;
  assert.match(markup, /Event photo \(optional\)/);
  assert.match(markup, /id="event-image"[^>]*disabled/);
  assert.match(markup, /Photo uploads are unavailable in this demo/);
  assert.ok(markup.indexOf('id="event-image"') < markup.indexOf('id="event-hobby"'));
});

test('actual website scripts create shared events, save, RSVP, comment, and clear state on logout', async()=>{
  const host = { _id: '1'.repeat(24), name: 'Host', major: 'CS', handle: 'host', interests: ['Games'], savedPosts: [], friends: [] };
  const guest = { ...host, _id: '2'.repeat(24), name: 'Guest', handle: 'guest', savedPosts: [], friends: [] };
  const posts = []; let failSave = false, failCreate = false, failUpload = false, uploadCalls = 0;
  const imageUrl = 'https://res.cloudinary.com/test/image/upload/event.png';
  const json = (data,status=200)=>new Response(JSON.stringify(data), { status });
  const detail = (post,viewer)=>({ ...post, author: host, event: { ...post.event, attendees: post.event.attendees.map(id=>id===host._id?host:guest) },
    comments: post.comments.map(comment=>({ ...comment, author: guest })), attendeeCount: post.event.attendees.length,
    isGoing: post.event.attendees.includes(viewer._id), isSaved: viewer.savedPosts.includes(post._id) });
  const fetcher = async (url,options={})=>{
    if (url === '/api/health') return json({ status:'ok' });
    const viewer = options.headers?.Authorization === 'Bearer guest' ? guest : host;
    if (url === '/api/auth/me') return json({ account: { name: viewer.name } });
    if (url === '/api/profiles/me') return json(viewer);
    if (url.startsWith('/api/posts?')) return json(posts.map(post=>detail(post,viewer)));
    if (url === '/api/uploads/image') {
      uploadCalls++;
      assert.equal(options.body.get('image').name, 'event.png');
      if (failUpload) return json({ error: 'Upload failed' }, 502);
      return json({ imageUrl }, 201);
    }
    if (url === '/api/posts' && options.method === 'POST') {
      if (failCreate) return json({ error:'Create failed' },503);
      const body = JSON.parse(options.body);
      const post = { ...body, _id: '3'.repeat(24), comments: [], event: { ...body.event, attendees: body.event.includeHost ? [host._id] : [] } };
      posts.push(post); return json(post,201);
    }
    const post = posts[0];
    if (url.endsWith('/save')) {
      if (failSave) return json({ error:'Save failed' },503);
      viewer.savedPosts = options.method === 'PUT' ? [post._id] : [];
      return json({ savedPosts: viewer.savedPosts });
    }
    if (url.endsWith('/rsvp')) {
      post.event.attendees = options.method === 'PUT' ? [...new Set([...post.event.attendees, viewer._id])] : post.event.attendees.filter(id=>id!==viewer._id);
      return json(detail(post,viewer));
    }
    if (url.endsWith('/comments')) { post.comments.push({ text: JSON.parse(options.body).text }); return json({},201); }
    return json(detail(post,viewer));
  };
  const a = await page(fetcher);
  assert.equal(a.live.events.length, 6, 'hardcoded plans remain alongside database events');
  assert.equal(a.live.events.every(event=>event.sample), true);
  await a.live.toggleRSVP('bowling-night');
  assert.equal(posts.length, 0, 'sample interactions must not create database records');
  const draft = { title:'Games <em>together</em>', description:'Bring games', location:'BSC', date:'2030-11-10', start:'16:00', end:'18:00', capacity:'2', category:'Games', note:'All welcome' };
  const form = element(); a.get('#form-dialog').open = true;
  form.querySelector = selector=>a.get(selector);
  a.live.setupEventImage(form);
  const picker = a.get('#event-image');
  picker.files = [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })];
  picker.listeners.get('change')();
  assert.equal(a.get('#event-image-preview').hidden, true);
  assert.match(a.get('#event-image-status').textContent, /JPEG/);
  picker.files = [new File(['photo bytes'], 'event.png', { type: 'image/png' })];
  picker.listeners.get('change')();
  assert.equal(a.get('#event-image-preview').hidden, false);
  a.get('#event-image-remove').listeners.get('click')();
  assert.equal(a.get('#event-image-preview').hidden, true);
  picker.listeners.get('change')();
  failUpload = true; await a.live.createEvent(draft,form);
  assert.equal(posts.length, 0); assert.equal(a.get('#form-dialog').open, true);
  assert.equal(a.get('#event-image-preview').hidden, false);
  assert.equal(a.get('#form-error').textContent, 'Upload failed');
  failUpload = false;
  failCreate = true; await a.live.createEvent(draft,form);
  assert.equal(posts.length,0); assert.equal(a.get('#form-dialog').open,true);
  assert.equal(a.get('#form-error').textContent,'Create failed'); assert.equal(form.dataset.busy,undefined);
  failCreate = false; await a.live.createEvent(draft,form);
  assert.equal(posts.length,1);
  assert.equal(uploadCalls, 2, 'retrying event creation must reuse a successful photo upload');
  assert.equal(posts[0].imageUrl, imageUrl);
  assert.equal(posts[0].event.dateTime,'2030-11-11T00:00:00.000Z');
  assert.equal(a.live.events[0].count,1); assert.equal(a.live.events[0].joined,true);
  assert.match(a.get('#event-detail').innerHTML,/Games &lt;em&gt;together&lt;\/em&gt;/);
  assert.doesNotMatch(a.get('#event-detail').innerHTML, /Games <em>/);
  assert.match(a.get('#event-detail').innerHTML, /https:\/\/res.cloudinary.com\/test\/image\/upload\/event.png/);
  const b = await page(fetcher,'guest');
  assert.equal(b.live.events[0].count,1);
  failSave = true; await b.live.toggleSave(posts[0]._id);
  assert.equal(b.live.events[0].saved,false);
  failSave = false; await b.live.toggleSave(posts[0]._id);
  assert.equal(b.live.events[0].saved,true);
  await b.live.toggleRSVP(posts[0]._id);
  assert.equal(b.live.events[0].count,2);
  assert.match(b.get('#campus-feed').innerHTML,/<strong>2<\/strong>\/2 going/);
  await a.live.refreshDetail(posts[0]._id);
  assert.equal(a.live.events[0].count,2);
  await b.live.addComment(element(),posts[0]._id,'Hello <script>bad()</script>');
  await a.live.refreshDetail(posts[0]._id);
  assert.match(a.get('#campus-feed').innerHTML,/Hello &lt;script&gt;bad\(\)&lt;\/script&gt;/);
  await b.live.toggleRSVP(posts[0]._id);
  assert.equal(b.live.events[0].count,1); assert.equal(b.live.events[0].joined,false);
  b.get('#session-logout').onclick();
  assert.equal(b.api.token,''); assert.equal(b.live.events.length,0);
  assert.doesNotMatch(b.get('#campus-feed').innerHTML,/Games &lt;em&gt;/);
});
