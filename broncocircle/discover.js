/* Feed interactions share event data, RSVP, saving, and dialogs with app.js. */
'use strict';

let currentFeedTab = 'discover';
const expandedInvites = new Set();
const openCommentThreads = new Set();
const commentDrafts = new Map();
const COMMENTS_KEY = 'broncocircle-comments-v1';
const sampleComments = {
  'bowling-night': [
    {name:'Alex Rivera',initials:'AR',text:'I’m in! Ready to celebrate every gutter ball.'},
    {name:'Maya Chen',initials:'MC',text:'Can I bring a friend? This sounds so fun.'}
  ],
  'pool-between-classes': [{name:'Maya Chen',initials:'MC',text:'The perfect break between classes. See you there!'}]
};
const savedComments = loadComments();

function loadComments() {
  const result = Object.create(null);
  try {
    const stored = JSON.parse(localStorage.getItem(COMMENTS_KEY));
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const [id, comments] of Object.entries(stored).slice(0,100)) {
        if (Array.isArray(comments)) result[id] = comments.filter(comment => comment && typeof comment.name === 'string' && typeof comment.text === 'string').slice(-100).map(comment => ({name:comment.name.slice(0,40),text:comment.text.slice(0,400),initials:initialsFor(comment.name)}));
      }
    }
  } catch { /* Comments still work for this visit when storage is unavailable. */ }
  return result;
}
function initialsFor(name) { return name.trim().split(/\s+/).slice(0,2).map(part => Array.from(part)[0] || '').join('').toUpperCase(); }
function commentsFor(id) { return [...(sampleComments[id] || []), ...(savedComments[id] || [])]; }
function eventHost(event) { return event.host || {name:state.profile.name,initials:initialsFor(state.profile.name),image:'avatar'}; }
function hostAvatar(host) {
  return host.image
    ? `<img class="host-avatar" src="assets/${escapeHTML(host.image)}.jpg" alt="">`
    : `<span class="host-avatar avatar-${escapeHTML(host.initials.toLowerCase())}" aria-hidden="true">${escapeHTML(host.initials)}</span>`;
}
function feedCardHTML(event) {
  const id = escapeHTML(event.id);
  const host = eventHost(event);
  const joined = isJoined(event), saved = state.saved.includes(event.id), remaining = spots(event);
  const expanded = expandedInvites.has(event.id), commenting = openCommentThreads.has(event.id);
  const comments = commentsFor(event.id);
  const shortDate = dateObject(event).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  return `<article class="feed-card ${expanded?'expanded':''}" aria-labelledby="feed-title-${id}">
    <div class="feed-host">${hostAvatar(host)}<div class="feed-host-copy"><strong>${escapeHTML(host.name)}</strong> is inviting students to<small>${event.host?.friend?'In your circle':'Around campus'} · ${escapeHTML(event.category)}</small></div><button class="save-button ${saved?'saved':''}" data-save="${id}" aria-pressed="${saved}" aria-label="${saved?'Unsave':'Save'} ${escapeHTML(event.title)}">${icon('bookmark')}</button></div>
    <div class="feed-overview"><div class="feed-category"><span class="category-dot"></span>${escapeHTML(categoryLabels[event.category])}</div><h2 id="feed-title-${id}"><button class="feed-title" data-expand="${id}" aria-expanded="${expanded}" aria-controls="invite-${id}" aria-label="${expanded?'Hide':'Show'} details for ${escapeHTML(event.title)}">${escapeHTML(event.title)}</button></h2><p class="feed-location">${icon('pin')}${escapeHTML(event.location)}</p></div>
    <button class="feed-image" data-expand="${id}" aria-expanded="${expanded}" aria-controls="invite-${id}" aria-label="${expanded?'Hide':'Show'} invite for ${escapeHTML(event.title)}"><img src="assets/${escapeHTML(event.image)}.jpg" alt="${escapeHTML(event.imageAlt || event.title)}" ${event.id==='bowling-night'?'fetchpriority="high"':'loading="lazy"'}><span class="image-shade"></span><span class="date-badge"><small>${month(event)}</small><strong>${day(event)}</strong></span><span class="feed-photo-hint">${expanded?'A little less':'See the plan'}${icon('chevron')}</span></button>
    <div class="feed-actions"><div class="feed-when">${icon('calendar')}<span>${shortDate}</span><span class="separator">·</span><span class="feed-time">${timeRange(event)}</span></div><div class="feed-going"><span class="attendee-count"><strong>${attendance(event)}</strong>/${event.capacity} going</span><button class="rsvp-small ${joined?'joined':!remaining?'full':''}" data-rsvp="${id}" aria-pressed="${joined}" aria-label="${joined?'Cancel RSVP for':'RSVP to'} ${escapeHTML(event.title)}" ${!joined&&!remaining?'disabled':''}>${icon(joined?'check':'plus')}${joined?'Going':remaining?'RSVP':'Full'}</button></div></div>
    <div class="feed-expanded" id="invite-${id}" ${expanded?'':'hidden'}><p class="feed-description">${escapeHTML(event.description)}</p><div class="host-note"><span aria-hidden="true">💬</span><div>${escapeHTML(event.note)}</div></div><div class="feed-extra-actions"><button class="feed-text-action" data-open="${id}">${icon('compass')}Full event details</button><button class="feed-text-action" data-calendar="${id}">${icon('calendar')}Add to calendar</button><button class="feed-text-action" data-share="${id}">${icon('share')}Share invite</button></div></div>
    <div class="feed-bottom"><button class="feed-comments-toggle" data-comments="${id}" aria-expanded="${commenting}" aria-controls="comments-${id}">${icon('comment')}${comments.length?`${comments.length} ${comments.length===1?'comment':'comments'}`:'Say hello'}</button><button class="feed-details-toggle" data-expand="${id}" aria-expanded="${expanded}" aria-controls="invite-${id}">${expanded?'Less details':'More details'}${icon('chevron')}</button></div>
    <p class="feed-caption"><strong>${escapeHTML(host.name.split(' ')[0])}</strong>${escapeHTML(event.note)}</p>
    <section class="feed-comments" id="comments-${id}" aria-labelledby="comments-title-${id}" ${commenting?'':'hidden'}><h3 id="comments-title-${id}">A little conversation</h3><div class="comment-list">${comments.length?comments.map(comment=>`<div class="feed-comment">${hostAvatar(comment)}<div class="comment-copy"><strong>${escapeHTML(comment.name)}</strong><p>${escapeHTML(comment.text)}</p></div></div>`).join(''):'<p class="no-comments">Be the first to say hello.</p>'}</div><form class="comment-form" data-comment-form="${id}">${hostAvatar({name:state.profile.name,image:'avatar'})}<div class="comment-input-wrap"><label class="sr-only" for="comment-input-${id}">Add a comment to ${escapeHTML(event.title)}</label><textarea id="comment-input-${id}" name="comment" maxlength="400" rows="1" required placeholder="Say you’re in. Ask a question. Say hello.">${escapeHTML(commentDrafts.get(event.id)||'')}</textarea></div><button class="button button-green" type="submit">Post comment</button></form></section>
  </article>`;
}
function renderDiscover() {
  // Preserve keyboard focus and unfinished comments when an RSVP refreshes the feed.
  const active = document.activeElement;
  const focusAttribute = ['data-rsvp','data-save','data-expand','data-comments'].find(attribute => active?.hasAttribute(attribute));
  const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : null;
  const focusIndex = focusAttribute ? $$(`[${focusAttribute}]`).filter(item=>item.getAttribute(focusAttribute)===focusValue).indexOf(active) : -1;
  const search = $('#search').value.trim().toLowerCase();
  const all = events();
  const visible = all.filter(event => (currentFeedTab==='discover'||(currentFeedTab==='friends'?event.host?.friend:state.saved.includes(event.id))) && (currentFilter==='All'||event.category===currentFilter) && (!search||`${event.title} ${event.category} ${event.location} ${event.description} ${eventHost(event).name}`.toLowerCase().includes(search)));
  const sort = $('#sort').value;
  visible.sort((a,b)=>sort==='spots'?spots(b)-spots(a):(sort==='latest'?-1:1)*`${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
  $('#campus-feed').innerHTML = visible.map(feedCardHTML).join('');
  $('#empty-state').hidden = visible.length > 0;
  $('#feed-end').hidden = !visible.length;
  $('#empty-message').textContent = search?'No events match your search. Try a different word.':currentFeedTab==='saved'?'Tap the bookmark on an event to keep it here.':'Try another hobby or make a plan of your own.';
  $('#results-summary').textContent = `${visible.length} ${visible.length===1?'plan':'plans'}${currentFeedTab==='friends'?' from friends':currentFeedTab==='saved'?' saved for later':' around campus'}${currentFilter!=='All'?` · ${currentFilter}`:''}${search?` matching “${$('#search').value.trim()}”`:''}`;
  $('#discover-count').textContent = all.length;
  $('#friends-count').textContent = all.filter(event=>event.host?.friend).length;
  $('#feed-saved-count').textContent = all.filter(event=>state.saved.includes(event.id)).length;
  renderNextPlan();
  if (focusAttribute) $$(`[${focusAttribute}]`).filter(item=>item.getAttribute(focusAttribute)===focusValue)[focusIndex]?.focus({preventScroll:true});
}
function renderNextPlan() {
  const next = events().filter(isJoined).sort((a,b)=>`${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`))[0];
  $('#next-plan').innerHTML = next?`<button class="next-plan-link" data-open="${escapeHTML(next.id)}"><img src="assets/${escapeHTML(next.image)}.jpg" alt="" loading="lazy"><strong>${escapeHTML(next.title)}</strong><span class="next-plan-meta">${icon('calendar')}${dateObject(next).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · ${timeLabel(next.start)}</span><span class="next-plan-meta">${icon('pin')}${escapeHTML(next.location)}</span></button>`:'<p class="next-plan-empty">A little time between classes? RSVP to something you’re into and find your next plan here.</p>';
}
function selectFeedTab(tab) {
  currentFeedTab = tab;
  $$('[data-feed-tab]').forEach(button=>{
    const active = button.dataset.feedTab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex = active?0:-1;
  });
  $('#feed-panel').setAttribute('aria-labelledby',`feed-tab-${tab}`);
  renderDiscover();
}

$$('[data-feed-tab]').forEach(button=>button.addEventListener('click',()=>selectFeedTab(button.dataset.feedTab)));
$('.feed-tab-list').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!event.target.matches('[data-feed-tab]'))return;
  event.preventDefault();
  const tabs = $$('[data-feed-tab]');
  const current = tabs.indexOf(event.target);
  const next = event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  selectFeedTab(tabs[next].dataset.feedTab);tabs[next].focus();
});
$('#sidebar-create').addEventListener('click',showCreateForm);
$('#campus-feed').addEventListener('click',event=>{
  const expand = event.target.closest('[data-expand]');
  if (expand) {
    const id = expand.dataset.expand;
    expandedInvites.has(id)?expandedInvites.delete(id):expandedInvites.add(id);
    renderDiscover();return;
  }
  const comment = event.target.closest('[data-comments]');
  if (comment) {
    const id = comment.dataset.comments;
    openCommentThreads.has(id)?openCommentThreads.delete(id):openCommentThreads.add(id);
    renderDiscover();
    if(openCommentThreads.has(id))document.getElementById(`comment-input-${id}`).focus({preventScroll:true});
  }
});
$('#campus-feed').addEventListener('input',event=>{
  const form = event.target.closest('[data-comment-form]');
  if(form)commentDrafts.set(form.dataset.commentForm,event.target.value);
});
$('#campus-feed').addEventListener('submit',event=>{
  const form = event.target.closest('[data-comment-form]');
  if(!form)return;
  event.preventDefault();
  const id = form.dataset.commentForm;
  const input = form.elements.comment;
  const text = input.value.trim();
  if(!text){input.setCustomValidity('Add a little something before posting.');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}
  savedComments[id] = [...(savedComments[id]||[]),{name:state.profile.name,initials:initialsFor(state.profile.name),text:text.slice(0,400)}].slice(-100);
  let persisted = true;
  try { localStorage.setItem(COMMENTS_KEY,JSON.stringify(savedComments)); } catch { persisted = false; }
  commentDrafts.delete(id);
  renderDiscover();
  document.getElementById(`comment-input-${id}`).focus({preventScroll:true});
  notify(persisted?'Comment added. A little hello goes a long way.':'Comment added for this visit. Browser storage is unavailable.');
});

renderDiscover();
