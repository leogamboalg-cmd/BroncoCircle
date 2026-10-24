// Run the actual page scripts with a small DOM stand-in and a shared API fixture.
// This checks wiring and rendered HTML, not browser layout or accessibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const scripts = await Promise.all(['api.js', 'app.js', 'discover.js', 'live.js'].map(name=>readFile(new URL(`../../broncocircle/${name}`, import.meta.url), 'utf8')));
function element() {
  const attributes = new Map(), listeners = new Map();
  return { value: '', dataset: {}, style: {}, textContent: '', innerHTML: '', hidden: false, open: false, tagName: 'DIV',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute: (key,value)=>attributes.set(key,value), getAttribute: key=>attributes.get(key), hasAttribute: key=>attributes.has(key), removeAttribute: key=>attributes.delete(key),
    addEventListener(name, callback) { listeners.set(name, callback); }, listeners,
    removeEventListener(name) { listeners.delete(name); },
    append() {}, prepend() {}, remove() {}, focus() {}, scrollIntoView() {},
    querySelector: ()=>element(), querySelectorAll: ()=>[],
    showModal() { this.open = true; }, close() { this.open = false; }, reset() {},
  };
}
async function page(fetcher, token = 'host', mode = 'live', options = {}) {
  const nodes = new Map();
  const get = selector=>{ if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const body = element(); body.dataset.page = options.profilePage ? '' : 'discover';
  const document = { body, activeElement: body, hidden: false, title: '', querySelector: get,
    querySelectorAll: ()=>[], createElement: element, addEventListener() {}, getElementById: id=>get(`#${id}`) };
  const storage = new Map([['broncocircle-token', token]]);
  if (options.returnTo) storage.set('broncocircle-return-to',options.returnTo);
  const initial = new URL(options.url || (options.profilePage ? '/index.html' : '/discover.html'), 'http://localhost');
  const sandbox = { document, location: { hostname: 'localhost', origin: initial.origin, href: initial.href, protocol: 'http:', search: initial.search, hash: initial.hash, pathname: initial.pathname, assign: value=>{ sandbox.lastNavigation = value; }, replace: value=>{ sandbox.lastNavigation = value; } },
    history: { replaceState() {} }, AbortSignal, URLSearchParams, URL, FormData, console,
    localStorage: { getItem: ()=>null, setItem() {} }, sessionStorage: { getItem: key=>storage.get(key), setItem: (key,value)=>storage.set(key,value), removeItem: key=>storage.delete(key) },
    fetch: (url,options)=>String(url).endsWith('/social') ? Promise.resolve(new Response('{"followers":0,"following":0,"isFollowing":false}')) : fetcher(url,options), addEventListener() {}, setTimeout: ()=>0, clearTimeout() {}, CSS: { escape: value=>value } };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const script of scripts) vm.runInContext(script, context);
  const expectedStatus = mode === 'demo' ? /^Demo preview/ : token ? /^Signed in as/ : /^Sign in/;
  for (let i = 0; i < 100 && !expectedStatus.test(get('#session-status').textContent); i++) await new Promise(resolve=>setImmediate(resolve));
  assert.match(get('#session-status').textContent, expectedStatus);
  return { context, get, storage, live: sandbox.LiveApp, api: sandbox.BroncoAPI };
}

test('live site uses the teammate login page and preserves the destination instead of showing another login form', async()=>{
  const entry = await page(async()=>new Response(JSON.stringify({ status:'ok' })), '', 'live');
  assert.equal(entry.context.lastNavigation, '/login/');
  assert.equal(entry.storage.get('broncocircle-return-to'), '/discover.html');
  assert.doesNotMatch(entry.get('#form-content').innerHTML, /account-form/);
  assert.equal(vm.runInContext("imageSrc('billiards')", entry.context), 'assets/billiards.png');
  assert.equal(vm.runInContext("imageSrc('avatar')", entry.context), 'assets/teamphoto.jpeg');
  assert.equal(vm.runInContext("imageSrc('bowling')", entry.context), 'assets/billiards.png');
});

test('sign-in discards stale student selection, while explicit signed-in profile visits still work', async()=>{
  const mine={_id:'a'.repeat(24),name:'My Account',handle:'mine',major:'CS',friends:[],savedPosts:[],interests:[]};
  const friend={_id:'b'.repeat(24),name:'My Friend',handle:'friend',major:'CS',interests:[]};
  const calls=[];
  const fetcher=async url=>{
    calls.push(url);
    const value=url==='/api/health'?{status:'ok'}:url==='/api/auth/me'?{account:{name:mine.name}}:url==='/api/profiles/me'?mine:url===`/api/profiles/${friend._id}`?friend:[];
    return new Response(JSON.stringify(value));
  };
  const signedIn=await page(fetcher,'host','live',{profilePage:true,returnTo:`/index.html?student=${friend._id}`});
  assert.equal(signedIn.context.lastNavigation,undefined);
  assert.equal(signedIn.get('#profile-name').textContent,mine.name);
  assert.equal(signedIn.get('#edit-profile').hidden,false);
  assert.equal(signedIn.get('.profile').hidden,false);
  assert.equal(calls.includes(`/api/profiles/${friend._id}`),false);
  assert.equal(signedIn.storage.has('broncocircle-return-to'),false);
  const visit=await page(fetcher,'host','live',{profilePage:true,url:`/index.html?student=${friend._id}`});
  assert.equal(visit.get('#profile-name').textContent,friend.name);
  assert.equal(visit.get('#edit-profile').hidden,true);
  assert.equal(vm.runInContext('state.profile.name',visit.context),mine.name,'browsing another profile must not replace account identity');
  visit.get('#session-logout').onclick();
  visit.get('#session-login').onclick();
  assert.equal(visit.storage.get('broncocircle-return-to'),'/index.html');
  assert.equal(visit.get('.profile').hidden,true);
});

test('static preview shows the photo field near the top and explains that uploads need the running app', async()=>{
  const preview = await page(async()=>new Response('Not found', { status:404 }), '', 'demo');
  vm.runInContext('showCreateForm()', preview.context);
  const markup = preview.get('#form-content').innerHTML;
  assert.match(markup, /Event photo \(optional\)/);
  assert.match(markup, /id="event-image"[^>]*disabled/);
  assert.match(markup, /Photo uploads are unavailable in this demo/);
  assert.ok(markup.indexOf('id="event-image"') < markup.indexOf('id="event-hobby"'));
});

test('Follow and Unfollow persist across visits and control the Following feed without changing state on failure', async()=>{
  const viewer={_id:'a'.repeat(24),name:'Alex',major:'CS',friends:[],savedPosts:[],interests:[]};
  const other={_id:'b'.repeat(24),name:'Maya'};
  let fail=false,followCalls=0;
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
  const fetcher=async(url,options={})=>{
    if(url==='/api/health') return json({status:'ok'});
    if(url==='/api/auth/me') return json({account:{name:viewer.name}});
    if(url==='/api/profiles/me') return json(viewer);
    if(url===`/api/profiles/${other._id}/follow`) {
      followCalls++; if(fail) return json({error:'Could not follow'},503);
      viewer.friends=options.method==='PUT'?[other._id]:[]; return json({following:viewer.friends});
    }
    if(url.startsWith('/api/posts?')) return json([{_id:'c'.repeat(24),author:other,text:'Come play',comments:[],isFriend:viewer.friends.includes(other._id),event:{title:'Maya’s games',category:'Games',location:'BSC',dateTime:'2030-11-10T16:00:00-08:00',endTime:'2030-11-10T18:00:00-08:00',capacity:8,attendees:[]}}]);
    throw new Error(`Unexpected request ${url}`);
  };
  const first=await page(fetcher);
  assert.match(first.get('#campus-feed').innerHTML,/aria-label="Follow Maya"/);
  assert.match(first.get('#campus-feed').innerHTML,/index.html\?student=bbbb/);
  vm.runInContext("selectFeedTab('friends')",first.context);
  assert.equal(first.get('#campus-feed').innerHTML,'');
  fail=true; await first.live.toggleFollow(other._id);
  assert.equal(first.live.isFollowing(other._id),false); assert.equal(viewer.friends.length,0);
  fail=false; await first.live.toggleFollow(other._id);
  assert.equal(first.live.isFollowing(other._id),true);
  assert.match(first.get('#campus-feed').innerHTML,/aria-label="Unfollow Maya"/);
  const second=await page(fetcher); assert.equal(second.live.isFollowing(other._id),true);
  await second.live.toggleFollow(other._id); assert.equal(second.live.isFollowing(other._id),false);
  const before=followCalls; await second.live.toggleFollow(viewer._id); assert.equal(followCalls,before);
});

test('personal profile photos preview, upload, retry safely, persist per user, and can be removed', async()=>{
  const current = { _id:'a'.repeat(24), name:'Alex Rivera', handle:'alex', major:'CS', interests:[], savedPosts:[], friends:[], avatarUrl:'https://res.cloudinary.com/test/image/upload/old.png' };
  const another = { _id:'b'.repeat(24), name:'Maya Chen', avatarUrl:'https://res.cloudinary.com/test/image/upload/maya.png' };
  const newUrl = 'https://res.cloudinary.com/test/image/upload/alex.png';
  let uploadCalls=0, patchCalls=0, failUpload=true, failSave=false;
  const json = (value,status=200)=>new Response(JSON.stringify(value),{status});
  const entry = await page(async(url,options={})=>{
    if (url === '/api/health') return json({status:'ok'});
    if (url === '/api/auth/me') return json({account:{name:current.name}});
    if (url === '/api/profiles/me') {
      if (options.method === 'PATCH') {
        patchCalls++; if(failSave) return json({error:'Save failed'},503);
        Object.assign(current,JSON.parse(options.body));
      }
      return json(current);
    }
    if (url === '/api/uploads/image') {
      uploadCalls++; assert.equal(options.body.get('image').name,'pfp.png');
      return failUpload ? json({error:'Upload failed'},502) : json({imageUrl:newUrl},201);
    }
    if (url.startsWith('/api/posts?')) return json([]);
    throw new Error(`Unexpected request ${url}`);
  });
  const form=element(); form.querySelector=selector=>entry.get(selector);
  entry.get('#form-dialog').open=true;
  entry.live.setupProfileImage(form);
  const picker=entry.get('#profile-image');
  picker.files=[new File(['fake'],'bad.svg',{type:'image/svg+xml'})]; picker.listeners.get('change')();
  assert.match(entry.get('#profile-image-status').textContent,/JPEG/);
  picker.files=[new File(['photo'],'pfp.png',{type:'image/png'})]; picker.listeners.get('change')();
  assert.match(entry.get('#profile-image-preview').src,/^blob:/);
  const fields={name:current.name,handle:'alex',major:'CS',interests:[]};
  await entry.live.saveProfile(fields,form);
  assert.equal(patchCalls,0); assert.equal(entry.get('#form-dialog').open,true);
  assert.equal(current.avatarUrl,'https://res.cloudinary.com/test/image/upload/old.png');
  failUpload=false; failSave=true; await entry.live.saveProfile(fields,form);
  failSave=false; await entry.live.saveProfile(fields,form);
  assert.equal(uploadCalls,2,'retry must reuse the successful upload');
  assert.equal(current.avatarUrl,newUrl);
  assert.equal(another.avatarUrl,'https://res.cloudinary.com/test/image/upload/maya.png');
  assert.match(entry.get('.nav-profile').style.backgroundImage,/alex.png/);
  assert.equal(vm.runInContext('state.profile.avatarUrl',entry.context),newUrl);
  entry.live.setupProfileImage(form);
  entry.get('#profile-image-remove').listeners.get('click')();
  assert.match(entry.get('#profile-image-preview').src,/^data:image\/svg\+xml,/);
  await entry.live.saveProfile(fields,form);
  assert.equal(current.avatarUrl,null); assert.equal(uploadCalls,2);
  assert.match(entry.get('.nav-profile').style.backgroundImage,/data:image\/svg\+xml/);
  assert.notEqual(vm.runInContext("avatarImage({name:'Alex Rivera'})",entry.context), vm.runInContext("avatarImage({name:'Maya Chen'})",entry.context));
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
  await a.live.toggleRSVP(a.live.events[0].id);
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
