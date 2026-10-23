/* Connect the existing profile/discover UI to the authenticated API. */
'use strict';
(() => {
  const api = window.BroncoAPI;
  let profile = null;
  let viewedProfile = null;
  let accountName = '';
  let records = [];
  let dataVersion = 0;
  const samplePlans = [...sampleEvents, ...discoveryEvents].map(event => ({
    ...event, sample: true, host: event.host || { name: 'Los Chulos', initials: 'JP', image: 'avatar' }
  }));
  const pending = new Set();
  const eventImages = new WeakMap();
  let disposeEventImage = () => {};
  const sessionBar = document.createElement('section');
  sessionBar.className = 'session-bar';
  sessionBar.setAttribute('aria-label', 'Account');
  sessionBar.innerHTML = '<p id="session-status" role="status">Connecting…</p><div><a class="button button-outline" href="search.html">Find students &amp; events</a><button class="button button-outline" id="student-friend" hidden>Add to Friends</button><button class="button button-outline" id="session-login">Sign in</button><button class="button button-outline" id="session-refresh" hidden>Refresh</button><button class="button button-outline" id="session-logout" hidden>Sign out</button></div>';
  $('main').prepend(sessionBar);
  const status = text => { $('#session-status').textContent = text; };
  const ownPage = () => !viewedProfile || viewedProfile._id === profile?._id;
  const render = () => {
    applyProfile(); renderEvents();
    if ($('#event-dialog').open && getEvent(currentEventId)) renderDetail(getEvent(currentEventId));
    if (api.mode === 'live') {
      const footnote = $('.detail-footnote');
      if (footnote) footnote.textContent = 'RSVPs are shared with everyone. You can cancel anytime.';
    }
  };
  function sessionUI() {
    $('#session-login').hidden = Boolean(api.token);
    $('#session-logout').hidden = !api.token;
    $('#session-refresh').hidden = !profile;
    status(profile ? `Signed in as ${profile.name}` : api.token ? 'Finish your profile to join campus plans.' : 'Sign in to find and share campus plans.');
  }
  function resetSession() {
    dataVersion++;
    api.setToken(''); profile = null; viewedProfile = null; records = [];
    state.joined = []; state.saved = [];
    state.profile = { name: 'Your profile', handle: '', bio: 'Sign in to make plans with your campus.' };
    closeDialogs(); sessionUI(); render();
  }
  function failure(error) {
    if (error.stale) return;
    if (error.status === 401 && !api.token) resetSession();
    status(error.message); notify(error.message);
  }
  function mapPost(post) {
    const start = api.localParts(post.event.dateTime);
    const end = api.localParts(post.event.endTime || post.event.dateTime);
    const author = post.author || {};
    const category = post.event.category === 'Coffee & Connection' ? 'Coffee' : post.event.category || 'Games';
    return {
      id: post._id, title: post.event.title, category, date: start.date, start: start.time, end: end.time, endDate: end.date,
      location: post.event.location, description: post.text, note: post.event.hostNote || '',
      capacity: post.event.capacity ?? Infinity, count: post.attendeeCount ?? post.event.attendees?.length ?? 0,
      image: post.event.image || categoryImage[category] || 'coffee', imageUrl: post.imageUrl,
      imageAlt: post.event.imageAlt, cost: post.event.cost || 'Check with the host', authorId: author._id || author,
      host: { name: author.name || 'Student', initials: (author.name || 'Student').split(/\s+/).map(word=>word[0]).slice(0,2).join(''), friend: Boolean(post.isFriend), image: undefined },
      attendees: post.event.attendees || [], joined: Boolean(post.isGoing), saved: Boolean(post.isSaved),
      comments: (post.comments || []).map(comment => ({ name: comment.author?.name || 'Student', initials: (comment.author?.name || 'Student').split(/\s+/).map(word=>word[0]).slice(0,2).join(''), text: comment.text }))
    };
  }
  function synchronize() {
    state.joined = records.filter(event=>event.joined).map(event=>event.id);
    state.saved = records.filter(event=>event.saved).map(event=>event.id);
  }
  function upsert(post) {
    const item = mapPost(post);
    const index = records.findIndex(event=>event.id === item.id);
    if (index < 0) records.push(item); else records[index] = item;
    synchronize(); render();
  }
  async function refresh() {
    if (!profile) return;
    const version = ++dataVersion;
    const token = api.token;
    const views = await Promise.all(['discover', 'hosting', 'going', 'saved', 'friends'].map(view=>api.request(`/posts?view=${view}`)));
    const target = new URLSearchParams(location.search).get('student');
    let student = null;
    if (target && !isDiscoverPage) student = await api.request(`/profiles/${encodeURIComponent(target)}`);
    const extra = student && student._id !== profile._id ? await api.request(`/posts?view=discover&author=${student._id}`) : [];
    if (token !== api.token || version !== dataVersion) return;
    viewedProfile = student;
    records = [...new Map([...views.flat(), ...extra].map(post=>[post._id, post])).values()].filter(post=>post.event).map(mapPost);
    synchronize(); render(); sessionUI();
  }
  async function restore() {
    const token = api.token;
    const session = await api.request('/auth/me');
    accountName = session.account.name;
    try { profile = await api.request('/profiles/me'); }
    catch (error) { if (error.status !== 404) throw error; profile = null; }
    if (token !== api.token) return;
    if (!profile) { sessionUI(); showProfileForm(); return; }
    state.profile = profile;
    await refresh();
    const fragment = location.hash.startsWith('#event=') ? decodeURIComponent(location.hash.slice(7)) : null;
    if (fragment && /^[a-f\d]{24}$/i.test(fragment)) {
      if (!getEvent(fragment)) upsert(await api.request(`/posts/${fragment}`));
      openEvent(fragment, { updateHash: false });
    } else if (new URLSearchParams(location.search).get('create') === '1') showCreateForm();
  }
  function ensureProfile() {
    if (api.mode !== 'live') { notify('Still connecting. Please try again.'); return false; }
    if (!api.token) { showAuth(); return false; }
    if (!profile) { showProfileForm(); return false; }
    return true;
  }
  function showAuth() {
    try { sessionStorage.setItem('broncocircle-return-to', location.pathname + location.search + location.hash); } catch { /* Login still returns to your profile. */ }
    location.assign('/login/');
  }
  function formError(message) { $('#form-error').textContent = message; $('#form-error').hidden = false; }
  function setBusy(form, busy) {
    if (busy) form.dataset.busy = '1'; else delete form.dataset.busy;
    $$('button, input, select, textarea', form).forEach(control=>{ control.disabled = busy; });
  }
  function setupEventImage(form) {
    disposeEventImage();
    const input = $('#event-image', form), preview = $('#event-image-preview', form);
    const remove = $('#event-image-remove', form), message = $('#event-image-status', form);
    const draft = { file: null, previewUrl: '', uploadedUrl: '' };
    eventImages.set(form, draft);
    function clear(resetInput = true) {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      draft.file = null; draft.previewUrl = ''; draft.uploadedUrl = '';
      if (resetInput) input.value = '';
      preview.removeAttribute('src'); preview.hidden = true; remove.hidden = true; message.textContent = '';
    }
    input.addEventListener('change', () => {
      const file = input.files[0]; clear(false);
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
        input.value = '';
        message.textContent = 'Choose a nonempty JPEG, PNG, or WebP image up to 5 MB.';
        return;
      }
      draft.file = file; draft.previewUrl = URL.createObjectURL(file);
      preview.src = draft.previewUrl; preview.hidden = false; remove.hidden = false;
      message.textContent = 'Photo ready. It will upload when you create the event.';
    });
    remove.addEventListener('click', () => clear());
    const dialog = $('#form-dialog');
    const closed = () => { if (!dialog.open) dispose(); };
    function dispose() { clear(); eventImages.delete(form); dialog.removeEventListener('close', closed); }
    disposeEventImage = dispose;
    dialog.addEventListener('close', closed);
  }
  function showProfileForm() {
    if (!api.token) { showAuth(); return; }
    const current = profile || { name: accountName, handle: '', bio: '', major: '', pronouns: '', interests: [] };
    const input = (name, label, max, required = false) => `<div class="form-field"><label for="edit-${name}">${label}</label><input id="edit-${name}" name="${name}" value="${escapeHTML(current[name] || '')}" maxlength="${max}" ${required?'required':''} ${name==='handle'?'pattern="[A-Za-z0-9_.]+"':''}></div>`;
    showForm(`<div class="eyebrow">A LITTLE ABOUT YOU</div><h2 id="form-title">${profile?'Edit your profile':'Create your profile'}.</h2><form id="profile-form">${input('name','Name',100,true)}${input('handle','Username',30,true)}${input('major','Major',100,true)}${input('pronouns','Pronouns (optional)',50)}<div class="form-field"><label for="edit-bio">Your bio</label><textarea id="edit-bio" name="bio" maxlength="180">${escapeHTML(current.bio || '')}</textarea></div><fieldset class="interest-options"><legend>Your hobbies</legend>${categories.map(category=>`<label><input type="checkbox" name="interests" value="${category}" ${(current.interests || []).includes(category)?'checked':''}> ${category}</label>`).join('')}</fieldset><p class="form-error" id="form-error" role="alert" hidden></p><button class="button button-green" type="submit">Save profile</button></form>`);
    $('#profile-form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget;
      if (form.dataset.busy) return;
      const values = new FormData(form); const body = Object.fromEntries(values);
      body.interests = values.getAll('interests');
      setBusy(form, true);
      try {
        profile = await api.request(profile ? '/profiles/me' : '/profiles', { method: profile ? 'PATCH' : 'POST', body });
        state.profile = profile; viewedProfile = null;
        $('#form-dialog').close(); await refresh(); notify('Profile saved.');
      } catch (error) { if ($('#form-dialog').open) formError(error.message); failure(error); }
      finally { setBusy(form, false); }
    });
  }
  async function createEvent(data, form) {
    if (form.dataset.busy || !ensureProfile()) return;
    dataVersion++;
    let created;
    setBusy(form, true);
    try {
      const dateTime = api.pacificTime(data.date, data.start);
      const endTime = api.pacificTime(data.date, data.end);
      if (dateTime <= new Date().toISOString()) throw new Error('Choose a date and time in the future.');
      if (endTime <= dateTime) throw new Error('Choose an end time after the start time.');
      const capacity = Number(data.capacity);
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) throw new Error('Choose between 2 and 100 total spots.');
      const photo = eventImages.get(form);
      if (photo?.file && !photo.uploadedUrl) {
        $('#event-image-status', form).textContent = 'Uploading your photo…';
        const upload = new FormData(); upload.append('image', photo.file);
        const result = await api.request('/uploads/image', { method: 'POST', body: upload, timeoutMs: 45000 });
        photo.uploadedUrl = result.imageUrl;
        $('#event-image-status', form).textContent = 'Photo uploaded. Publishing your event…';
      }
      created = await api.request('/posts', { method: 'POST', body: {
        text: data.description.trim(), ...(photo?.uploadedUrl ? { imageUrl: photo.uploadedUrl } : {}), event: { title: data.title.trim(), location: data.location.trim(), category: data.category, dateTime, endTime,
          capacity, hostNote: data.note.trim(), image: categoryImage[data.category], cost: 'Check with the host', includeHost: true }
      } });
      $('#form-dialog').close();
      const full = await api.request(`/posts/${created._id}`);
      upsert(full);
      currentFilter = 'All'; $('#search').value = ''; setFilter('All');
      if (isDiscoverPage) selectFeedTab('discover'); else selectTab('hosting');
      openEvent(created._id); notify('Your event is published. Invite your people!');
    } catch (error) {
      if (error.stale) return;
      if (created) { status('Your event was created. Refresh to load its details.'); notify('Event created. Refresh to load it.'); }
      else {
        const photo = eventImages.get(form);
        if (photo?.file) $('#event-image-status', form).textContent = photo.uploadedUrl ? 'Photo uploaded. Your draft is ready to try publishing again.' : 'Your photo is still selected. Try again or remove it to use a hobby photo.';
        if ($('#form-dialog').open) formError(error.message); failure(error);
      }
    } finally { setBusy(form, false); }
  }
  async function changeEvent(id, action) {
    if (!ensureProfile() || pending.has(id)) return;
    const item = getEvent(id); if (!item) return;
    if (item.sample) { notify('This is a sample plan. Create a new event to share real RSVPs and saved plans.'); return; }
    dataVersion++;
    pending.add(id);
    try {
      const removing = action === 'rsvp' ? item.joined : item.saved;
      const result = await api.request(`/posts/${id}/${action}`, { method: removing ? 'DELETE' : 'PUT' });
      if (action === 'rsvp') upsert(result);
      else { profile.savedPosts = result.savedPosts; item.saved = result.savedPosts.includes(id); synchronize(); render(); }
      notify(action === 'rsvp' ? removing ? 'RSVP canceled.' : 'You’re on the list!' : removing ? 'Event unsaved.' : 'Event saved.');
    } catch (error) {
      if (error.status === 409) await refreshDetail(id).catch(()=>{});
      failure(error);
    } finally { pending.delete(id); }
  }
  async function refreshDetail(id) {
    if (!profile) return;
    if (getEvent(id)?.sample) return;
    const version = dataVersion;
    try { const post = await api.request(`/posts/${id}`); if (version === dataVersion) upsert(post); }
    catch (error) { failure(error); }
  }
  async function addComment(form, id, text) {
    if (!text || !ensureProfile() || form.dataset.busy) return;
    if (getEvent(id)?.sample) { notify('This is a sample plan. Comments are available on newly created events.'); return; }
    setBusy(form, true);
    try {
      await api.request(`/posts/${id}/comments`, { method: 'POST', body: { text } });
      commentDrafts.delete(id); form.reset();
      await refreshDetail(id); notify('Comment posted.');
    } catch (error) { failure(error); }
    finally { setBusy(form, false); }
  }
  function applyLiveProfile() {
    if (isDiscoverPage) { document.title = 'Discover · BroncoCircle'; return; }
    const shown = viewedProfile || profile || state.profile;
    $('#profile-name').textContent = shown.name || 'Your profile';
    $('#profile-handle').textContent = [shown.handle ? `@${shown.handle}` : '', shown.pronouns].filter(Boolean).join(' · ');
    $('#profile-bio').textContent = shown.bio || '';
    $('.profile-hobbies').innerHTML = (shown.interests || []).map(hobby=>`<span class="live-hobby">${escapeHTML(hobby)}</span>`).join('');
    $('.profile-hobbies').setAttribute('aria-label', 'Hobbies');
    $('.profile-portrait img').src = shown.avatarUrl || imageSrc('avatar');
    $('.profile-portrait img').alt = shown.name || 'Your profile';
    $('.online-dot').hidden = true;
    $('#edit-profile').hidden = !ownPage();
    $('#student-friend').hidden = !profile || ownPage();
    $('#student-friend').textContent = (profile?.friends || []).includes(shown._id) ? 'Remove from Friends' : 'Add to Friends';
    document.title = `${shown.name || 'Your profile'} · BroncoCircle`;
  }
  window.LiveApp = { get events() { return profile ? [...records, ...samplePlans] : []; }, isHosted: event=>event.authorId === (viewedProfile || profile)?._id,
    ensureProfile, applyProfile: applyLiveProfile, showProfileForm, createEvent, setupEventImage,
    toggleSave: id=>changeEvent(id,'save'), toggleRSVP: id=>changeEvent(id,'rsvp'), refreshDetail, addComment };
  $('#session-login').onclick = showAuth;
  $('#session-logout').onclick = resetSession;
  $('#session-refresh').onclick = () => refresh().catch(failure);
  $('#student-friend').onclick = async () => {
    if (!profile || !viewedProfile || pending.has('friend')) return;
    pending.add('friend');
    try {
      const removing = (profile.friends || []).includes(viewedProfile._id);
      const result = await api.request(`/profiles/${viewedProfile._id}/friend`, { method: removing ? 'DELETE' : 'PUT' });
      profile.friends = result.friends; await refresh(); notify(removing ? 'Removed from Friends.' : 'Added to your Friends feed.');
    } catch (error) { failure(error); }
    finally { pending.delete('friend'); }
  };
  $('#about-btn').addEventListener('click', event => {
    if (api.mode !== 'live') return;
    event.stopImmediatePropagation();
    showInfo('Make time for your campus', '<p class="info-body">Create an event, invite people, and keep your plans together. Events, comments, RSVPs, and saved plans are shared through your account. Event times are shown in Pacific time.</p>');
  }, { capture: true });
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden && profile) refresh().catch(failure); });
  api.ready.then(async () => {
    if (api.mode === 'demo') {
      status('Demo preview — plans and changes stay in this browser.');
      $('#session-login').hidden = true; render(); return;
    }
    state.joined = []; state.saved = [];
    $('#about-btn').textContent = 'About BroncoCircle';
    state.profile = { name: 'Your profile', handle: '', bio: 'Sign in to make plans with your campus.' };
    sessionUI(); render();
    if (api.token) {
      let returnTo = '';
      try { returnTo = sessionStorage.getItem('broncocircle-return-to') || ''; sessionStorage.removeItem('broncocircle-return-to'); } catch { /* Open your profile if storage is unavailable. */ }
      if (returnTo) {
        const target = new URL(returnTo, location.origin);
        if (target.origin === location.origin && ['/index.html', '/discover.html'].includes(target.pathname) && target.href !== location.href) {
          location.replace(target.href); return;
        }
      }
      try { await restore(); } catch (error) { failure(error); }
    }
    else showAuth();
  });
})();
