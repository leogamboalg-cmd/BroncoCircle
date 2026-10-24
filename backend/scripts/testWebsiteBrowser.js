// Browser integration checks with an isolated API fixture; no database or .env.
import assert from 'node:assert/strict';
import express from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const app = express();
app.use(express.json());
app.use('/login', express.static(fileURLToPath(new URL('../../frontend/login/', import.meta.url))));
app.use(express.static(fileURLToPath(new URL('../../broncocircle/', import.meta.url))));
const accounts = new Map(), profiles = new Map(), posts = [];
let next = 1, failCreate = false, failSave = false;
const id = () => (next++).toString(16).padStart(24, '0');
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.post('/api/auth/signup', (req, res) => {
  const account = { _id: id(), name: req.body.name, email: req.body.email, password: req.body.password, token: id().padEnd(64, 'a') };
  accounts.set(account.email, account); res.status(201).json({ account, token: account.token });
});
app.post('/api/auth/login', (req, res) => {
  const account = accounts.get(req.body.email);
  if (!account || account.password !== req.body.password) return res.status(401).json({ error: 'Invalid email or password.' });
  res.json({ account, token: account.token });
});
app.use('/api', (req, res, next) => {
  req.account = [...accounts.values()].find(account=>`Bearer ${account.token}` === req.headers.authorization);
  if (!req.account) return res.status(401).json({ error: 'Sign in first.' });
  req.profile = profiles.get(req.account._id); next();
});
app.get('/api/auth/me', (req, res) => res.json({ account: req.account }));
app.post('/api/uploads/image', multer({ storage: multer.memoryStorage() }).single('image'), (req, res) => {
  assert.ok(req.file?.buffer.length);
  res.status(201).json({ imageUrl: `${base}/assets/art.jpg` });
});
app.get('/api/profiles/me', (req, res) => req.profile ? res.json(req.profile) : res.status(404).json({ error: 'Create a profile.' }));
app.post('/api/profiles', (req, res) => {
  const profile = { _id: id(), ...req.body, savedPosts: [], friends: [] }; profiles.set(req.account._id, profile); res.status(201).json(profile);
});
app.patch('/api/profiles/me', (req, res) => { Object.assign(req.profile, req.body); res.json(req.profile); });
app.get('/api/profiles', (req, res) => res.json([...profiles.values()]));
app.get('/api/profiles/:id/social', (req,res)=>{
  const target=[...profiles.values()].find(profile=>profile._id === req.params.id);
  res.json({ followers:[...profiles.values()].filter(profile=>profile.friends.includes(target._id)).length, following:target.friends.length, isFollowing:req.profile.friends.includes(target._id) });
});
app.get('/api/profiles/:id', (req, res) => res.json([...profiles.values()].find(profile=>profile._id === req.params.id)));
app.put('/api/profiles/:id/follow', (req, res) => {
  req.profile.friends = [...new Set([...req.profile.friends, req.params.id])]; res.json({ following: req.profile.friends });
});
app.delete('/api/profiles/:id/follow', (req, res) => {
  req.profile.friends = req.profile.friends.filter(id=>id !== req.params.id); res.json({ following: req.profile.friends });
});
function details(post, viewer) {
  const allProfiles = [...profiles.values()];
  const attendees = post.event.attendees.map(id=>allProfiles.find(profile=>profile._id === id));
  return { ...post, author: allProfiles.find(profile=>profile._id === post.author), event: { ...post.event, attendees },
    comments: post.comments.map(comment=>({ ...comment, author: allProfiles.find(profile=>profile._id === comment.author) })),
    attendeeCount: attendees.length, spotsRemaining: post.event.capacity - attendees.length,
    isGoing: post.event.attendees.includes(viewer._id), isSaved: viewer.savedPosts.includes(post._id), isFriend: viewer.friends.includes(post.author) };
}
app.get('/api/posts', (req, res) => res.json(posts.filter(post=>{
  if (req.query.author && post.author !== req.query.author) return false;
  if (req.query.view === 'hosting') return post.author === req.profile._id;
  if (req.query.view === 'going') return post.event.attendees.includes(req.profile._id);
  if (req.query.view === 'saved') return req.profile.savedPosts.includes(post._id);
  if (req.query.view === 'friends' || req.query.view === 'following') return req.profile.friends.includes(post.author);
  return true;
}).map(post=>details(post, req.profile))));
app.post('/api/posts', (req, res) => {
  if (failCreate) return res.status(503).json({ error: 'Test create failure. Please try again.' });
  const post = { _id: id(), text: req.body.text, imageUrl: req.body.imageUrl, author: req.profile._id, comments: [],
    event: { ...req.body.event, attendees: req.body.event.includeHost ? [req.profile._id] : [] } };
  posts.push(post); res.status(201).json(post);
});
app.get('/api/posts/:id', (req, res) => {
  const post = posts.find(post=>post._id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found.' });
  res.json(details(post, req.profile));
});
app.all('/api/posts/:id/rsvp', (req, res) => {
  const post = posts.find(post=>post._id === req.params.id);
  if (req.method === 'DELETE') post.event.attendees = post.event.attendees.filter(id=>id !== req.profile._id);
  else if (!post.event.attendees.includes(req.profile._id)) {
    if (post.event.attendees.length >= post.event.capacity) return res.status(409).json({ error: 'This event is full.' });
    post.event.attendees.push(req.profile._id);
  }
  res.json(details(post, req.profile));
});
app.all('/api/posts/:id/save', (req, res) => {
  if (failSave) return res.status(503).json({ error: 'Test save failure.' });
  req.profile.savedPosts = req.method === 'DELETE' ? req.profile.savedPosts.filter(id=>id !== req.params.id) : [...new Set([...req.profile.savedPosts, req.params.id])];
  res.json({ savedPosts: req.profile.savedPosts });
});
app.post('/api/posts/:id/comments', (req, res) => {
  const post = posts.find(post=>post._id === req.params.id);
  const comment = { text: req.body.text, author: req.profile._id }; post.comments.push(comment); res.status(201).json(comment);
});

const server = app.listen(0, '127.0.0.1');
await new Promise(resolve=>server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
async function check(name, work) { await work(); console.log(`PASS ${name}`); }
try {
  const executablePath = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert.ok(executablePath, 'Set BROWSER_PATH to an installed Chromium executable.');
  browser = await chromium.launch({ executablePath, headless: true });
  const hostContext = await browser.newContext({ timezoneId: 'Asia/Tokyo' });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const context of [hostContext, guestContext]) context.on('page', page=>page.on('pageerror', error=>errors.push(error.message)));
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  async function signUp(page, name) {
    await page.goto(`${base}/discover.html`);
    await page.locator('#choose-signup').click();
    await page.locator('#email').fill(`${name.toLowerCase()}@example.test`);
    await page.locator('#password').fill('Password123');
    await page.locator('#submit-button').click();
    await page.locator('#edit-name').fill(name);
    await page.locator('#edit-handle').fill(name.toLowerCase());
    await page.locator('#edit-major').fill('CS');
    await page.locator('input[name="interests"][value="Games"]').check();
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.waitForFunction(()=>document.querySelector('#session-status').textContent.startsWith('Signed in as'));
  }
  await check('signup and profile creation in two sessions', async()=>{ await signUp(host, 'Host'); await signUp(guest, 'Guest'); });
  await check('failed creation preserves the draft', async()=>{
    await host.locator('#nav-create').click();
    await host.locator('#event-name').fill('Games <em>together</em>');
    await host.locator('#event-location').fill('BSC');
    await host.locator('#event-date').fill('2030-11-10');
    await host.locator('#event-description').fill('Bring board games.');
    await host.locator('#event-capacity').fill('2');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1kAAAAASUVORK5CYII=', 'base64');
    await host.locator('#event-image').setInputFiles({ name: 'event.png', mimeType: 'image/png', buffer: png });
    assert.equal(await host.locator('#event-image-preview').isVisible(), true);
    await host.locator('#event-image-remove').click();
    assert.equal(await host.locator('#event-image-preview').isVisible(), false);
    await host.locator('#event-image').setInputFiles({ name: 'event.png', mimeType: 'image/png', buffer: png });
    failCreate = true;
    await host.locator('#create-form button[type="submit"]').click();
    await host.waitForFunction(()=>!document.querySelector('#form-error').hidden);
    assert.equal(await host.locator('#event-name').inputValue(), 'Games <em>together</em>');
    assert.equal(posts.length, 0); failCreate = false;
  });
  await check('create event uses Pacific time and includes host exactly once', async()=>{
    await host.locator('#create-form button[type="submit"]').click();
    await host.locator('#event-dialog[open]').waitFor();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].event.dateTime, '2030-11-11T00:00:00.000Z');
    assert.equal(posts[0].event.attendees.length, 1);
    assert.equal(posts[0].imageUrl, `${base}/assets/art.jpg`);
    assert.equal(await host.locator('.detail-photo>img').getAttribute('src'), `${base}/assets/art.jpg`);
    assert.equal(await host.locator('#event-title em').count(), 0);
    assert.equal(await host.locator('#event-title').textContent(), 'Games <em>together</em>');
    await host.locator('[data-close="event-dialog"]').click();
  });
  await check('shared event appears for guest; save failure does not change saved state', async()=>{
    await guest.locator('#session-refresh').click();
    const save = guest.locator(`[data-save="${posts[0]._id}"]`);
    await save.waitFor(); failSave = true; await save.click();
    await guest.waitForFunction(()=>document.querySelector('#session-status').textContent.includes('Test save failure'));
    assert.equal(await save.getAttribute('aria-pressed'), 'false');
    failSave = false; await save.click();
    await guest.waitForFunction(id=>document.querySelector(`[data-save="${id}"]`).getAttribute('aria-pressed') === 'true', posts[0]._id);
  });
  await check('RSVP persists and host refresh shows guest attendance', async()=>{
    await guest.locator(`[data-rsvp="${posts[0]._id}"]`).click();
    await guest.waitForFunction(()=>document.querySelector('.attendee-count strong').textContent === '2');
    await host.locator('#session-refresh').click();
    await host.waitForFunction(()=>document.querySelector('.attendee-count strong').textContent === '2');
    assert.equal(posts[0].event.attendees.length, 2);
  });
  await check('comments are shared and safely rendered', async()=>{
    await guest.locator(`[data-comments="${posts[0]._id}"]`).click();
    await guest.locator('[name="comment"]').fill('Hi <script>bad()</script>');
    await guest.getByRole('button', { name: 'Post comment' }).click();
    await host.locator('#session-refresh').click();
    await host.locator(`[data-comments="${posts[0]._id}"]`).click();
    await host.getByText('Hi <script>bad()</script>', { exact: true }).waitFor();
    assert.equal(await host.locator('.comment-list script').count(), 0);
  });
  await check('session survives reload; saved tab and cancellation persist', async()=>{
    await guest.reload();
    await guest.locator('[data-feed-tab="saved"]').click();
    await guest.locator(`[data-rsvp="${posts[0]._id}"]`).waitFor();
    await guest.locator(`[data-rsvp="${posts[0]._id}"]`).click();
    await guest.waitForFunction(()=>document.querySelector('.attendee-count strong').textContent === '1');
    assert.equal(posts[0].event.attendees.length, 1);
  });
  await check('search and another student profile use API records', async()=>{
    await guest.goto(`${base}/search.html`);
    await guest.getByText('Search campus students and the latest 50 plans.', { exact: true }).waitFor();
    await guest.locator('#search').fill('Host');
    await guest.getByRole('button', { name: /^@host/ }).click();
    await guest.waitForURL(/student=/);
    await guest.waitForFunction(()=>document.querySelector('#profile-name').textContent === 'Host');
    await guest.locator('#student-friend').click();
    await guest.getByRole('button', { name: 'Unfollow', exact:true }).waitFor();
    assert.equal(await guest.locator('#edit-profile').isVisible(), false);
  });
  await check('sign out clears private data; sign in restores the account', async()=>{
    await guest.locator('#session-logout').click();
    assert.equal(await guest.locator('.event-card').count(), 0);
    await guest.locator('#session-login').click();
    await guest.locator('#choose-login').click();
    await guest.locator('#email').fill('guest@example.test');
    await guest.locator('#password').fill('Password123');
    await guest.locator('#submit-button').click();
    await guest.waitForFunction(()=>document.querySelector('#session-status').textContent === 'Signed in as Guest');
  });
  await check('Pacific conversion rejects DST gaps', async()=>{
    assert.equal(await host.evaluate(()=>BroncoAPI.pacificTime('2030-07-10', '16:00')), '2030-07-10T23:00:00.000Z');
    assert.equal(await host.evaluate(()=>{ try { BroncoAPI.pacificTime('2030-03-10', '02:30'); return false; } catch { return true; } }), true);
  });
  await check('mobile layout has no horizontal overflow', async()=>{
    assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), true);
  });
  await check('static preview stays usable and clearly labeled', async()=>{
    const preview = await browser.newPage();
    preview.on('pageerror', error=>errors.push(error.message));
    await preview.route('**/api/health', route=>route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' }));
    await preview.goto(`${base}/discover.html`);
    await preview.getByText('Demo preview — plans and changes stay in this browser.', { exact: true }).waitFor();
    assert.ok(await preview.locator('.feed-card').count() > 0);
    await preview.close();
  });
  assert.deepEqual(errors, []);
  console.log('PASS no browser JavaScript errors');
} finally {
  if (browser) await browser.close();
  server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
}
