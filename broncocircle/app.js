/* BroncoCircle — dependency-free campus profile demo. */
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const STORAGE_KEY = 'broncocircle-profile-v1';
const isDiscoverPage = document.body.dataset.page === 'discover';
const categories = ['Games', 'Outdoors', 'Coffee', 'Creative', 'Sports'];
const categoryImage = {Games:'bowling', Outdoors:'hike', Coffee:'coffee', Creative:'art', Sports:'basketball'};
const categoryLabels = {Games:'Game night', Outdoors:'Fresh air club', Coffee:'Coffee & connection', Creative:'Make something', Sports:'Play for the plot'};
const categoryNotes = {Games:'Good games.\nEven better people.', Outdoors:'A little fresh air.\nA fresh perspective.', Coffee:'Less scrolling.\nMore coffee.', Creative:'Make a little mess.\nMake a new friend.', Sports:'Show up.\nFind your team.'};
const sampleEvents = [
  {id:'bowling-night',title:'Strikes & good vibes',category:'Games',date:'2026-10-24',start:'18:00',end:'20:00',location:'BSC Games Room',image:'bowling',imageAlt:'A bowler taking a shot in a colorful neon bowling alley',count:5,capacity:8,description:'A few rounds of bowling, a questionable victory dance, and some new campus friends. Come hang out at the BSC Games Room. No skills required — gutter balls are part of the experience.',note:'Bring your Bronco ID and a little friendly competition. Meet by the front desk! 🎳',cost:'Bring money for lane & shoe rental'},
  {id:'golden-hour-hike',title:'Chasing the golden hour',category:'Outdoors',date:'2026-10-25',start:'16:00',end:'18:00',location:'Campus trailhead',image:'hike',imageAlt:'Hikers on a mountain ridge in warm golden sunset light',count:6,capacity:12,description:'Let’s close the laptop and catch a sunset together. We’ll take a relaxed walk along the campus trails, stop for photos, and enjoy the view. All paces welcome — this is a hangout, not a race.',note:'Meet at the campus trailhead. Bring water, comfy shoes, and a light layer. 🌄',cost:'Free to join'},
  {id:'coffee-and-catchup',title:'Coffee, campus & catch-ups',category:'Coffee',date:'2026-10-26',start:'10:00',end:'11:30',location:'BSC café patio',image:'coffee',imageAlt:'Fresh pour-over coffee being prepared at a café',count:3,capacity:6,description:'Your Monday deserves a soft start. Grab your favorite drink and join us on the café patio for an easy conversation. Come solo, bring a friend, or just take a break between classes.',note:'Look for the green notebook on the table. First-timers especially welcome. ☕',cost:'Buy your own drink'}
];
const discoveryEvents = [
  {id:'pool-between-classes',title:'One more game of pool?',category:'Games',date:'2026-10-25',start:'13:00',end:'14:30',location:'BSC Games Room',image:'pool',imageAlt:'Pool balls and a cue on a green billiards table',count:2,capacity:4,description:'A break between classes is better with a little friendly competition. Come play a few relaxed games of pool — beginners are very welcome.',note:'Meet by the pool tables. Bring your Bronco ID! 🎱',cost:'Bring money for table rental',host:{name:'Alex Rivera',initials:'AR',image:'friend',friend:true}},
  {id:'sketch-and-unwind',title:'A sketchbook kind of afternoon',category:'Creative',date:'2026-10-26',start:'15:00',end:'16:30',location:'University Quad',image:'art',imageAlt:'Colorful art supplies ready for an afternoon of creating',count:3,capacity:8,description:'Bring a sketchbook, find a spot on the grass, and make something just for fun. No prompts, no pressure, and definitely no art major required.',note:'Bring something to draw with and a blanket if you have one. 🎨',cost:'Free to join',host:{name:'Maya Chen',initials:'MC',friend:true}},
  {id:'pickup-after-class',title:'A little pickup, a little catch-up',category:'Sports',date:'2026-10-27',start:'17:00',end:'18:30',location:'BRIC outdoor courts',image:'basketball',imageAlt:'A basketball court ready for a friendly pickup game',count:6,capacity:10,description:'Let’s get a casual game going after class. All skill levels welcome. We’ll make teams when everyone gets here, so coming solo is perfect.',note:'Bring water, comfortable shoes, and your best team spirit. 🏀',cost:'Free to join',host:{name:'Sam Patel',initials:'SP',friend:false}}
];

function loadState() {
  const defaults = {joined:['coffee-and-catchup'],saved:['golden-hour-hike'],custom:[],profile:{name:'Johnny Park',handle:'johnnyonthequad',bio:'Collecting good memories, not just units. 🌱\nAlways down for a game, a trail, or one more coffee.'}};
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return defaults;
    if (Array.isArray(stored.joined)) defaults.joined = stored.joined.filter(id => typeof id === 'string');
    if (Array.isArray(stored.saved)) defaults.saved = stored.saved.filter(id => typeof id === 'string');
    if (Array.isArray(stored.custom)) defaults.custom = stored.custom.filter(isValidEvent).slice(0,50);
    if (stored.profile && typeof stored.profile.name === 'string' && typeof stored.profile.handle === 'string' && typeof stored.profile.bio === 'string') {
      defaults.profile = {name:stored.profile.name.slice(0,40), handle:stored.profile.handle.slice(0,30), bio:stored.profile.bio.slice(0,180)};
    }
  } catch { /* A blocked or cleared storage area falls back to the demo. */ }
  return defaults;
}
function isValidEvent(event) {
  return event && typeof event.id === 'string' && typeof event.title === 'string' && categories.includes(event.category) && /^\d{4}-\d{2}-\d{2}$/.test(event.date) && /^\d{2}:\d{2}$/.test(event.start) && /^\d{2}:\d{2}$/.test(event.end) && typeof event.location === 'string' && typeof event.description === 'string' && typeof event.note === 'string' && Number.isInteger(event.capacity) && event.capacity >= 2 && event.capacity <= 100 && Number.isInteger(event.count) && event.count >= 0 && event.count <= event.capacity && /^[a-z]+$/.test(event.image);
}
const state = loadState();
let currentTab = 'hosting';
let currentFilter = 'All';
let currentEventId = null;
let toastTimeout;
let persistenceWarningShown = false;
const events = () => [...sampleEvents, ...discoveryEvents, ...state.custom];
const getEvent = id => events().find(event => event.id === id);
const isJoined = event => state.joined.includes(event.id);
const attendance = event => event.count + (isJoined(event) ? 1 : 0);
const spots = event => Math.max(0,event.capacity - attendance(event));
const dateObject = event => new Date(`${event.date}T12:00:00`);
const longDate = event => dateObject(event).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const month = event => dateObject(event).toLocaleDateString('en-US',{month:'short'}).toUpperCase();
const day = event => dateObject(event).getDate();
function timeLabel(time) { return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(':00',''); }
const timeRange = event => `${timeLabel(event.start)} – ${timeLabel(event.end)}`;
function saveState() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); return true; }
  catch { if (!persistenceWarningShown) { persistenceWarningShown = true; setTimeout(() => notify('Browser storage is unavailable. Changes last for this visit.'),1200); } return false; }
}
function notify(message) {
  const toast = $('#toast');
  const topDialog = $$('dialog[open]').at(-1);
  (topDialog || document.body).append(toast);
  $('span',toast).textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'),3300);
}
function applyProfile() {
  const name = state.profile.name;
  if (isDiscoverPage) { document.title = 'Discover · BroncoCircle'; return; }
  $('#profile-name').innerHTML = `${escapeHTML(name)} <span class="verified" aria-label="Campus verified">${icon('check')}</span>`;
  $('#profile-handle').innerHTML = `@${escapeHTML(state.profile.handle)} <span>·</span> he/him`;
  $('#profile-bio').innerHTML = escapeHTML(state.profile.bio).replace(/\n/g,'<br>');
  document.title = `${name} · BroncoCircle`;
  $$('.profile-portrait>img').forEach(img => img.alt = name);
}
function avatarStack() {
  return '<span class="avatar-stack" aria-hidden="true"><img class="mini-avatar" src="assets/friend.jpg" alt=""><span class="mini-avatar avatar-b">AL</span><span class="mini-avatar avatar-c">MK</span></span>';
}
function cardHTML(event,index) {
  const joined = isJoined(event);
  const saved = state.saved.includes(event.id);
  const remaining = spots(event);
  return `<article class="event-card" data-event="${escapeHTML(event.id)}" style="animation-delay:${Math.min(index,5)*35}ms">
    <button class="card-image-button" data-open="${escapeHTML(event.id)}" aria-label="View ${escapeHTML(event.title)} details">
      <img src="assets/${escapeHTML(event.image)}.jpg" alt="${escapeHTML(event.imageAlt || event.title)}" ${index>2?'loading="lazy"':''}>
      <span class="image-shade"></span><span class="date-badge"><small>${month(event)}</small><strong>${day(event)}</strong></span>
      <span class="spots-badge"><span class="dot"></span>${remaining>0?`${remaining} spots left`:'Circle is full'}</span>
      <span class="photo-label">${icon('pin')}${escapeHTML(event.location)}</span><span class="card-open-hint">${icon('arrow')}</span>
    </button>
    <div class="card-body"><div class="card-category"><span class="category-dot"></span>${escapeHTML(categoryLabels[event.category])}</div>
      <div class="card-title-row"><button class="card-title" data-open="${escapeHTML(event.id)}">${escapeHTML(event.title)}</button><button class="save-button ${saved?'saved':''}" data-save="${escapeHTML(event.id)}" aria-pressed="${saved}" aria-label="${saved?'Unsave':'Save'} ${escapeHTML(event.title)}">${icon('bookmark')}</button></div>
      <div class="card-time">${icon('calendar')}<span>${dateObject(event).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span><span class="separator">·</span><span class="time-text">${timeRange(event)}</span></div>
      <div class="card-footer"><div class="attendees">${avatarStack()}<span class="attendee-count"><strong>${attendance(event)}</strong>/${event.capacity} going</span></div><button class="rsvp-small ${joined?'joined':remaining===0?'full':''}" data-rsvp="${escapeHTML(event.id)}" aria-label="${joined?'Cancel RSVP for':'RSVP to'} ${escapeHTML(event.title)}" aria-pressed="${joined}" ${!joined && !remaining?'disabled':''}>${icon(joined?'check':'plus')}${joined?'Going':remaining?'RSVP':'Full'}</button></div>
    </div></article>`;
}
function renderEvents() {
  if (isDiscoverPage) { renderDiscover(); return; }
  const search = $('#search').value.trim().toLowerCase();
  let visible = events().filter(event => (currentTab==='hosting'?!event.host:(currentTab==='going'?state.joined:state.saved).includes(event.id)) && (currentFilter==='All'||event.category===currentFilter) && (!search || `${event.title} ${event.category} ${event.location} ${event.description}`.toLowerCase().includes(search)));
  const sort = $('#sort').value;
  visible.sort((a,b) => sort==='spots'?spots(b)-spots(a):(sort==='latest'?-1:1)*(`${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`)));
  $('#event-grid').innerHTML = visible.map(cardHTML).join('');
  $('#empty-state').hidden = visible.length>0;
  $('#event-grid').hidden = visible.length===0;
  const hostedCount = $('#hosted-count');
  if (hostedCount) hostedCount.textContent = events().filter(event => !event.host).length;
  $('#hosting-count').textContent = events().filter(event => !event.host).length;
  $('#going-count').textContent = events().filter(isJoined).length;
  $('#saved-count').textContent = events().filter(event => state.saved.includes(event.id)).length;
  const headings = {hosting:'Good plans, better company',going:'Your next campus memories',saved:'Keep a little something planned'};
  const subtitles = {hosting:'Something you’re into? There’s a spot for you.',going:'You’re on the list. We’ll meet you there.',saved:'The plans you’re keeping an eye on. Make one happen.'};
  const eventsHeading = $('#events-heading');
  if (eventsHeading) eventsHeading.innerHTML = `${headings[currentTab]}<span class="gold-period">.</span>`;
  const eventsSubtitle = $('#events-subtitle');
  if (eventsSubtitle) eventsSubtitle.textContent = subtitles[currentTab];
  $('#events-panel').setAttribute('aria-labelledby',`tab-${currentTab}`);
  $('#empty-message').textContent = search?'No events match your search. Try a different word.':currentTab==='going'?'Your next memory is one RSVP away. Explore a plan and join in.':currentTab==='saved'?'Tap the bookmark on an event to keep it here.':'Try another hobby or create something of your own.';
  $('#results-summary').textContent = search || currentFilter!=='All' ? `${visible.length} ${visible.length===1?'event':'events'}${currentFilter!=='All'?` for ${currentFilter.toLowerCase()}`:''}${search?` matching “${$('#search').value.trim()}”`:''}` : '';
}
function selectTab(tab,{scroll=false}={}) {
  currentTab = tab;
  $$('.tab').forEach(button => {
    const active = button.dataset.tab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex = active?0:-1;
  });
  renderEvents();
  if(scroll) $('#events').scrollIntoView({behavior:'smooth',block:'start'});
}
function setFilter(filter) {
  currentFilter = filter;
  $$('.filter').forEach(button => {const active = button.dataset.filter===filter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  renderEvents();
}
function toggleSave(id) {
  const event = getEvent(id);
  if (!event) return;
  const saved = state.saved.includes(id);
  state.saved = saved?state.saved.filter(value=>value!==id):[...state.saved,id];
  saveState();
  renderEvents();
  if ($('#event-dialog').open && currentEventId===id) renderDetail(event);
  notify(saved?'Event removed from saved.':'Saved for a future good time.');
}
function toggleRSVP(id) {
  const event = getEvent(id);
  if (!event) return;
  const joined = isJoined(event);
  if (!joined && spots(event)===0) { notify('This circle is full. Try another event.'); return; }
  state.joined = joined?state.joined.filter(value=>value!==id):[...state.joined,id];
  saveState();
  renderEvents();
  if ($('#event-dialog').open && currentEventId===id) renderDetail(event);
  notify(joined?'RSVP canceled. Your spot is open again.':'You’re in! Good company is on the calendar.');
}
function renderDetail(event) {
  const joined = isJoined(event),saved = state.saved.includes(event.id),remaining = spots(event);
  // Keep focus on an action after the dialog content refreshes.
  const focusAction = document.activeElement?.dataset.detailAction;
  $('#event-detail').innerHTML = `<div class="event-detail-layout">
    <button class="dialog-close icon-button" data-close="event-dialog" aria-label="Close event details">${icon('close')}</button>
    <div class="detail-photo"><img src="assets/${escapeHTML(event.image)}.jpg" alt="${escapeHTML(event.imageAlt || event.title)}"><div class="detail-photo-note"><div class="eyebrow">A LITTLE MORE OFFLINE</div><p>${escapeHTML(categoryNotes[event.category]).replace(/\n/g,'<br>')}</p></div></div>
    <div class="detail-content"><div class="detail-host"><img src="assets/${event.host?.image || 'avatar'}.jpg" alt=""><div><strong>${escapeHTML(event.host?.name || state.profile.name)}</strong>is bringing people together</div></div>
      <span class="detail-category">${escapeHTML(categoryLabels[event.category])}</span><h2 id="event-title">${escapeHTML(event.title)}</h2>
      <div class="detail-meta"><div>${icon('calendar')}<div><strong>${longDate(event)}</strong><small>${timeRange(event)} · Pacific time</small></div></div><div>${icon('pin')}<div><strong>${escapeHTML(event.location)}</strong><small>Cal Poly Pomona campus</small></div></div><div>${icon('users')}<div><strong>${attendance(event)} of ${event.capacity} spots filled</strong><small>${remaining?`${remaining} ${remaining===1?'spot':'spots'} left · `:''}${escapeHTML(event.cost || 'Free to join')}</small></div></div></div>
      <p class="detail-description">${escapeHTML(event.description)}</p><div class="host-note"><span>💬</span><div>${escapeHTML(event.note)}</div></div>
      <div class="detail-attendance">${avatarStack()}<span><strong>${attendance(event)} Broncos</strong> are making time for this.</span></div>
      <div class="detail-actions"><button class="button button-green main-rsvp ${joined?'joined':''}" data-detail-action="rsvp" data-rsvp="${escapeHTML(event.id)}" aria-pressed="${joined}" ${!joined&&!remaining?'disabled':''}>${icon(joined?'check':'plus')}${joined?'You’re going · Cancel RSVP':remaining?'Count me in · RSVP':'This circle is full'}</button><button class="icon-button ${saved?'saved':''}" data-detail-action="save" data-save="${escapeHTML(event.id)}" aria-pressed="${saved}" aria-label="${saved?'Unsave':'Save'} event">${icon('bookmark')}</button><button class="icon-button" data-detail-action="share" data-share="${escapeHTML(event.id)}" aria-label="Share event">${icon('share')}</button></div>
      <p class="detail-footnote">${joined?'Your RSVP is saved on this browser. See you there!':'Plans change. You can cancel your RSVP anytime.'}</p><button class="calendar-button" data-calendar="${escapeHTML(event.id)}">${icon('calendar')}Add to calendar</button>
    </div></div>`;
  if (focusAction) $(`[data-detail-action="${focusAction}"]`, $('#event-detail'))?.focus({preventScroll:true});
}
function openEvent(id,{updateHash=true}={}) {
  const event = getEvent(id);
  if(!event) return;
  closeDialogs();
  currentEventId = id;
  renderDetail(event);
  $('#event-dialog').showModal();
  document.body.classList.add('modal-open');
  if(updateHash) replaceHash(`event=${encodeURIComponent(id)}`);
}
function replaceHash(hash='') {
  try { history.replaceState(null,'',`${location.pathname}${location.search}${hash?'#'+hash:''}`); } catch { /* File previews may block history updates. */ }
}
function closeDialogs() { $$('dialog[open]').forEach(dialog => dialog.close()); }
function showForm(content) {
  closeDialogs();
  $('#form-content').innerHTML = content;
  $('#form-dialog').showModal();
  document.body.classList.add('modal-open');
}
function showCreateForm() {
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  showForm(`<div class="eyebrow">YOUR HOBBY. YOUR PEOPLE.</div><h2 id="form-title">Make a little plan<span class="gold-period">.</span></h2><p class="form-intro">It doesn’t have to be a big thing to be a good thing.</p>
    <form id="create-form"><div class="form-field"><label for="event-name">What’s the plan?</label><input id="event-name" name="title" required maxlength="65" placeholder="e.g. Friday night board games"></div>
    <div class="form-row"><div class="form-field"><label for="event-hobby">Hobby</label><select id="event-hobby" name="category">${categories.map(cat=>`<option>${cat}</option>`).join('')}</select></div><div class="form-field"><label for="event-capacity">Total spots, including you</label><input id="event-capacity" type="number" name="capacity" min="2" max="100" value="8" required></div></div>
    <div class="form-field"><label for="event-location">Where on campus?</label><input id="event-location" name="location" required maxlength="60" placeholder="e.g. BSC Games Room"></div>
    <div class="form-field"><label for="event-date">Date</label><input id="event-date" type="date" name="date" min="${minDate}" value="${minDate}" required></div><div class="form-row"><div class="form-field"><label for="event-start">Starts</label><input id="event-start" type="time" name="start" value="16:00" required></div><div class="form-field"><label for="event-end">Ends</label><input id="event-end" type="time" name="end" value="18:00" required></div></div>
    <div class="form-field"><label for="event-description">The details</label><textarea id="event-description" name="description" required maxlength="600" placeholder="What’s happening? What should people bring?"></textarea></div>
    <div class="form-field"><label for="event-note">A note from you (optional)</label><input id="event-note" name="note" maxlength="180" placeholder="All levels welcome. Come as you are!"></div>
    <p class="form-error" id="form-error" role="alert" hidden></p><button class="button button-green submit-button" type="submit">${icon('plus')}Create event</button><p class="form-help">A hobby photo is added for you. Demo events are saved on this browser.</p></form>`);
  $('#create-form').addEventListener('submit',event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const fail = message => { $('#form-error').textContent=message;$('#form-error').hidden=false; };
    if (!data.title.trim() || !data.location.trim() || !data.description.trim()) { fail('Add a title, a campus location, and a few details.');return; }
    if (data.end <= data.start) { fail('Choose an end time after the start time.');$('#event-end').focus();return; }
    if (new Date(`${data.date}T${data.start}`) < new Date()) { fail('Choose a date and time in the future.');$('#event-date').focus();return; }
    if (state.custom.length>=50) { fail('This demo supports up to 50 of your own events.');return; }
    const id = `plan-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    state.custom.push({id,title:data.title.trim(),category:data.category,date:data.date,start:data.start,end:data.end,location:data.location.trim(),description:data.description.trim(),note:data.note.trim()||'Come as you are. Can’t wait to meet you!',capacity:Number(data.capacity),count:1,image:categoryImage[data.category],cost:'Check the host’s details'});
    saveState();
    currentFilter='All';$('#search').value='';$('#sort').value='soonest';
    setFilter('All');if(isDiscoverPage)selectFeedTab('discover');else selectTab('hosting');
    $('#form-dialog').close();openEvent(id);notify('A good plan is born. Your event is ready!');
  });
}
function showEditForm() {
  showForm(`<div class="eyebrow">A LITTLE ABOUT YOU</div><h2 id="form-title">Make yourself at home<span class="gold-period">.</span></h2><p class="form-intro">Give your people a little glimpse of your world.</p><form id="profile-form"><div class="form-field"><label for="edit-name">Name</label><input id="edit-name" name="name" value="${escapeHTML(state.profile.name)}" required maxlength="40"></div><div class="form-field"><label for="edit-handle">Username</label><input id="edit-handle" name="handle" value="${escapeHTML(state.profile.handle)}" required maxlength="30" pattern="[A-Za-z0-9_.]+" title="Use letters, numbers, underscores, or periods."></div><div class="form-field"><label for="edit-bio">Your bio</label><textarea id="edit-bio" name="bio" maxlength="180" rows="3">${escapeHTML(state.profile.bio)}</textarea></div><p id="form-error" class="form-error" role="alert" hidden></p><button type="submit" class="button button-green submit-button">${icon('check')}Save profile</button><p class="form-help">Your edits are saved on this browser.</p></form>`);
  $('#profile-form').addEventListener('submit',event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if(!data.name.trim()) {$('#form-error').textContent='Add a name so your people can find you.';$('#form-error').hidden=false;return;}
    state.profile={name:data.name.trim(),handle:data.handle.trim(),bio:data.bio.trim()};
    saveState();applyProfile();$('#form-dialog').close();notify('Profile updated. Looking like you!');
  });
}
async function shareEvent(id) {
  const event = id?getEvent(id):null;
  const url = `${location.href.split('#')[0]}${event?'#event='+encodeURIComponent(id):''}`;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
    else {
      const input = document.createElement('textarea');input.value=url;input.style.position='fixed';input.style.opacity='0';
      ($$('dialog[open]').at(-1)||document.body).append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw new Error('Clipboard unavailable');
    }
    notify(event?'Event link copied. Bring your people.':'Profile link copied!');
  } catch {
    showInfo('Pass the plan along',`<p class="info-body">Copy this link to share ${event?'the event':'your profile'}. Locally created events are only stored in this browser.</p><div class="form-field"><label for="share-url">${event?'Event':'Profile'} link</label><input id="share-url" value="${escapeHTML(url)}" readonly></div>`);
    $('#share-url').select();
  }
}
function calendarDownload(id) {
  const event = getEvent(id);if(!event)return;
  const icsEscape = text => String(text).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  // The campus is in America/Los_Angeles. VTIMEZONE preserves local event time across DST.
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BroncoCircle//Campus Plans//EN','CALSCALE:GREGORIAN','BEGIN:VTIMEZONE','TZID:America/Los_Angeles','BEGIN:DAYLIGHT','TZOFFSETFROM:-0800','TZOFFSETTO:-0700','TZNAME:PDT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','END:DAYLIGHT','BEGIN:STANDARD','TZOFFSETFROM:-0700','TZOFFSETTO:-0800','TZNAME:PST','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','END:STANDARD','END:VTIMEZONE','BEGIN:VEVENT',`UID:${event.id}@broncocircle.demo`,`DTSTAMP:${stamp}`,`DTSTART;TZID=America/Los_Angeles:${event.date.replaceAll('-','')}T${event.start.replace(':','')}00`,`DTEND;TZID=America/Los_Angeles:${event.date.replaceAll('-','')}T${event.end.replace(':','')}00`,`SUMMARY:${icsEscape(event.title)}`,`LOCATION:${icsEscape(event.location+', Cal Poly Pomona')}`,`DESCRIPTION:${icsEscape(event.description+'\n'+event.note)}`,'END:VEVENT','END:VCALENDAR'];
  // Fold long lines to the iCalendar 75-octet limit without splitting UTF-8 characters.
  const encoder=new TextEncoder();
  const folded=lines.map(line=>{let result='',part='',length=0;for(const char of line){const size=encoder.encode(char).length;if(length+size>75){result+=part+'\r\n';part=' ';length=1;}part+=char;length+=size;}return result+part;}).join('\r\n')+'\r\n';
  downloadFile(new Blob([folded],{type:'text/calendar;charset=utf-8'}),`${event.id}.ics`);
  notify('Calendar invite downloaded. Make time for it.');
}
function downloadFile(blob,name) {const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showInfo(title,content) {closeDialogs();$('#info-content').innerHTML=`<div class="eyebrow">BRONCOCIRCLE</div><h2 id="info-title">${escapeHTML(title)}<span class="gold-period">.</span></h2>${content}`;$('#info-dialog').showModal();document.body.classList.add('modal-open');}

$$('[data-tab]').forEach(button => button.addEventListener('click',()=>selectTab(button.dataset.tab)));
$('.profile-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!event.target.matches('[data-tab]'))return;
  event.preventDefault();const tabs=$$('[data-tab]');let index=tabs.indexOf(event.target);index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[index].dataset.tab);tabs[index].focus();
});
$$('.filter').forEach(button => button.addEventListener('click',()=>setFilter(button.dataset.filter)));
$$('[data-hobby]').forEach(button=>button.addEventListener('click',()=>{selectTab('hosting');setFilter(button.dataset.hobby);$('#events').scrollIntoView({behavior:'smooth'});}));
$('#search').addEventListener('input',renderEvents);
$('#search').addEventListener('keydown',event=>{if(event.key==='Enter')$('#events').scrollIntoView({behavior:'smooth'});});
$('#sort').addEventListener('change',renderEvents);
$('#reset-filters').addEventListener('click',()=>{$('#search').value='';setFilter('All');if(isDiscoverPage)selectFeedTab('discover');else selectTab('hosting');});
['#create-event','#bottom-create','#nav-create'].forEach(selector=>$(selector).addEventListener('click',showCreateForm));
$('#edit-profile')?.addEventListener('click',showEditForm);
$('#share-profile')?.addEventListener('click',()=>shareEvent());
$('#nav-search').addEventListener('click',()=>{
  const panel = $('#nav-search-panel');
  panel.hidden = !panel.hidden;
  $('#nav-search').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) $('#search').focus();
});
$$('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
  const nav=button.dataset.nav;
  $$('[data-nav]').forEach(item=>{const active=item.dataset.nav===nav;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});
  if(nav==='profile'){selectTab('hosting');window.scrollTo({top:0,behavior:'smooth'});return;}
  $('#search').value='';setFilter('All');selectTab(nav==='explore'?'hosting':nav,{scroll:true});
}));
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close){document.getElementById(close.dataset.close).close();return;}
  const open=event.target.closest('[data-open]');if(open){openEvent(open.dataset.open);return;}
  const save=event.target.closest('[data-save]');if(save){const id=save.dataset.save;toggleSave(id);if(!$('#event-dialog').open)$(`[data-save="${CSS.escape(id)}"]`)?.focus({preventScroll:true});return;}
  const rsvp=event.target.closest('[data-rsvp]');if(rsvp){const id=rsvp.dataset.rsvp;toggleRSVP(id);if(!$('#event-dialog').open)$(`[data-rsvp="${CSS.escape(id)}"]`)?.focus({preventScroll:true});return;}
  const share=event.target.closest('[data-share]');if(share){shareEvent(share.dataset.share);return;}
  const calendar=event.target.closest('[data-calendar]');if(calendar){calendarDownload(calendar.dataset.calendar);return;}
  const card=event.target.closest('[data-event]');if(card && !event.target.closest('button'))openEvent(card.dataset.event);
});
$$('dialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    if(dialog.id==='event-dialog'){currentEventId=null;if(location.hash.startsWith('#event='))replaceHash();}
    if(!$$('dialog[open]').length){document.body.classList.remove('modal-open');document.body.append($('#toast'));}
  });
});
$('#about-btn').addEventListener('click',()=>showInfo('Built for a little more offline',`<p class="info-intro">A campus profile concept for finding your people through the things you love.</p><p class="info-body">This is an interactive front-end demo. Events, names, attendance, and profile stats are sample data. RSVPs, saved events, new events, and profile edits are stored only in this browser. Shared links open sample events; custom plans need a backend to be shared between people.</p><p class="info-body">Made with plain HTML, CSS, and JavaScript. Event and profile photography from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>. See the included README for setup and customization.</p>`));
document.addEventListener('keydown',event=>{if(event.key==='/'&&!$$('dialog[open]').length&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#nav-search-panel').hidden=false;$('#nav-search').setAttribute('aria-expanded','true');$('#search').focus();}});
window.addEventListener('hashchange',()=>{const id=location.hash.startsWith('#event=')?decodeURIComponent(location.hash.slice(7)):null;if(id&&getEvent(id))openEvent(id,{updateHash:false});});

applyProfile();
if(!isDiscoverPage){
  const initialTab = new URLSearchParams(location.search).get('tab');
  if(['going','saved'].includes(initialTab))selectTab(initialTab);else renderEvents();
}
if(location.hash.startsWith('#event=')){try{const initialId=decodeURIComponent(location.hash.slice(7));if(getEvent(initialId))openEvent(initialId,{updateHash:false});}catch{/* Ignore a malformed URL fragment. */}}
